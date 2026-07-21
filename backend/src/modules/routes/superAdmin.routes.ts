import mongoose from 'mongoose';
import { Router } from 'express';
import { ok } from '../../utils/responses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';

import { RestaurantModel } from '../restaurants/restaurants.model';
import { AuditLogModel } from '../auditLogs/auditLogs.schema';
import { FeatureFlagModel, PlatformPlanModel } from '../superAdmin/superAdmin.model';
import { RestaurantRequestModel } from '../superAdmin/restaurantRequest.model';
import { SubscriptionPaymentModel, SubscriptionModel } from '../subscriptions/subscriptions.model';
import { PaymentModel } from '../payments/payments.model';
import { OrderModel } from '../orders/orders.model';
import { getPlatformSettings } from '../superAdmin/platformSettings.model';
import { TableModel } from '../tables/tables.model';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { QueueEntryModel } from '../queue/queue.model';
import { ReservationModel } from '../reservations/reservations.model';
import { UserModel } from '../users/users.model';
import { sendRestaurantDeletedEmail } from '../../services/mail.service';

import { RestaurantStatus, SessionStatus, OrderStatus, QueueStatus, ReservationStatus } from '../../constants/statuses';

import { updateRestaurantCommissionRate } from '../superAdmin/superAdmin.service';

export const superAdminRouter = Router();

superAdminRouter.get('/restaurants', async (req, res, next) => {
  try {
    const { status, plan, search } = req.query;
    const query: Record<string, unknown> = {};

    if (status) {
      query.status =
        String(status) === 'PENDING' ? RestaurantStatus.PENDING_APPROVAL : String(status);
    }
    if (plan) query.plan = String(plan);
    if (search) query.name = { $regex: String(search), $options: 'i' };

    const restaurants = await RestaurantModel.find(query).sort({ createdAt: -1 }).lean();

    // Fetch total revenue (sum of finalAmount for completed orders) grouped by restaurantId
    const revenueStats = await OrderModel.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          totalRevenue: { $sum: '$finalAmount' }
        }
      }
    ]);

    const revenueMap = new Map(revenueStats.map(s => [s?._id?.toString() || '', s.totalRevenue]));

    const subscriptions = await SubscriptionModel.find().lean();
    const subMap = new Map(subscriptions.map(s => [s.restaurantId.toString(), s]));

    const enrichedRestaurants = restaurants.map(r => {
      const sub = subMap.get(r._id.toString());
      return {
        ...r,
        revenue: revenueMap.get(r._id.toString()) || 0,
        mrr: sub ? (sub.priceMonthly ?? 0) : 0,
        subscriptionPlan_id: sub ? sub.planId : (r.subscriptionPlan_id || null),
        customCommissionRate: r.customCommissionRate ?? null,
      };
    });

    ok(res, { restaurants: enrichedRestaurants, count: enrichedRestaurants.length });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/restaurants/:id', async (req, res, next) => {
  try {
    const restaurant = await RestaurantModel.findById(req.params.id).populate('onboardingRequestId').lean();
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
    }
    const subscription = await SubscriptionModel.findOne({ restaurantId: req.params.id }).lean();
    const payments = await SubscriptionPaymentModel.find({ restaurantId: req.params.id }).sort({ createdAt: -1 }).lean();

    const totalOrderRevenue = await OrderModel.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(req.params.id),
          paymentStatus: 'PAID',
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' }
        }
      }
    ]);

    const revenue = totalOrderRevenue[0]?.totalRevenue || 0;
    const enrichedRestaurant = {
      ...restaurant,
      revenue,
      mrr: subscription ? (subscription.priceMonthly ?? 0) : 0,
      subscriptionPlan_id: subscription ? subscription.planId : (restaurant.subscriptionPlan_id || null),
    };

    ok(res, { restaurant: enrichedRestaurant, subscription, payments });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.patch('/restaurants/:id/approve', async (req, res, next) => {
  try {
    const restaurant = await RestaurantModel.findByIdAndUpdate(
      req.params.id,
      { status: RestaurantStatus.ACTIVE },
      { new: true },
    );

    ok(res, { restaurant, approvedBy: req.body?.actorId ?? req.user?.id ?? null });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.patch('/restaurants/:id/suspend', async (req, res, next) => {
  try {
    const restaurant = await RestaurantModel.findByIdAndUpdate(
      req.params.id,
      { status: RestaurantStatus.SUSPENDED },
      { new: true },
    );

    ok(res, { restaurant, suspendedBy: req.body?.actorId ?? req.user?.id ?? null });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.patch('/restaurants/:id/commission', async (req, res, next) => {
  try {
    const { customCommissionRate } = req.body;
    if (typeof customCommissionRate !== 'number' || customCommissionRate < 0 || customCommissionRate > 100) {
      throw new AppError('Invalid commission rate. Must be a number between 0 and 100.', 400, ErrorCode.INVALID_REQUEST);
    }
    const restaurant = await updateRestaurantCommissionRate(req.params.id, customCommissionRate);
    ok(res, { message: 'Restaurant custom commission rate updated successfully', restaurant });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.post('/subscriptions/:id/addons', async (req, res, next) => {
  try {
    const { name, priceMonthly } = req.body;
    if (!name || typeof priceMonthly !== 'number') {
      throw new AppError('Add-on name and monthly price are required.', 400, ErrorCode.INVALID_REQUEST);
    }
    const sub = await SubscriptionModel.findById(req.params.id);
    if (!sub) {
      throw new AppError('Subscription not found', 404, ErrorCode.NOT_FOUND);
    }
    if (!sub.addons) sub.addons = [];
    sub.addons.push({ name, priceMonthly, addedAt: new Date() });
    await sub.save();
    ok(res, { message: 'Add-on added to subscription successfully', subscription: sub });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.delete('/restaurants/:id', async (req, res, next) => {
  try {
    const restaurant = await RestaurantModel.findById(req.params.id);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
    }
    const reason = String(req.query.reason || 'No reason provided');

    // 1. Delete all users associated with this restaurant
    await UserModel.deleteMany({ restaurantId: req.params.id });

    // 2. Delete the restaurant itself
    await RestaurantModel.findByIdAndDelete(req.params.id);

    // 3. Send deletion email to the owner
    if (restaurant.email) {
      await sendRestaurantDeletedEmail(
        restaurant.email,
        restaurant.ownerName || restaurant.email,
        restaurant.name,
        reason
      );
    }

    ok(res, { deletedRestaurantId: req.params.id });
  } catch (error) {
    next(error);
  }
});

import { createPlan, listPlans, updatePlan, deletePlan } from '../superAdmin/superAdmin.service';

superAdminRouter.post('/plans', async (req, res, next) => {
  try {
    const plan = await createPlan({
      name: req.body?.name,
      priceMonthly: Number(req.body?.priceMonthly ?? 0),
      originalPriceMonthly: req.body?.originalPriceMonthly ? Number(req.body.originalPriceMonthly) : null,
      tenantLimit: Number(req.body?.tenantLimit ?? 5),
      description: req.body?.description || '',
      features: Array.isArray(req.body?.features) ? req.body.features : [],
      isActive: req.body?.isActive !== false,
      tableLimit: req.body?.tableLimit ? Number(req.body.tableLimit) : undefined,
      monthlyOrderLimit: req.body?.monthlyOrderLimit ? Number(req.body.monthlyOrderLimit) : undefined,
      staffLimit: req.body?.staffLimit ? Number(req.body.staffLimit) : undefined,
      inventoryLimit: req.body?.inventoryLimit ? Number(req.body.inventoryLimit) : undefined,
      reservationAccess: req.body?.reservationAccess !== false,
      queueAccess: req.body?.queueAccess !== false,
      advancedAnalytics: req.body?.advancedAnalytics === true,
      smartAutomation: req.body?.smartAutomation === true,
      dynamicDiscountEngine: req.body?.dynamicDiscountEngine === true,
    });

    ok(res, { plan }, 201);
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await listPlans();
    ok(res, { plans });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.patch('/plans/:id', async (req, res, next) => {
  try {
    const plan = await updatePlan(req.params.id, req.body);
    ok(res, { plan });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.delete('/plans/:id', async (req, res, next) => {
  try {
    await deletePlan(req.params.id);
    ok(res, { deletedPlanId: req.params.id });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/analytics/revenue', async (_req, res, next) => {
  try {
    const activeRestaurants = await RestaurantModel.find({ status: RestaurantStatus.ACTIVE }).lean();
    const plans = await PlatformPlanModel.find().lean();
    const planPriceMap = new Map(plans.map((plan) => [plan.name, plan.priceMonthly]));
    const currentMrr = activeRestaurants.reduce((sum, restaurant) => sum + (planPriceMap.get(restaurant.plan || '') ?? 0), 0);

    ok(res, {
      revenue: [
        { month: '2026-03', mrr: Math.round(currentMrr * 0.92) },
        { month: '2026-04', mrr: Math.round(currentMrr * 0.97) },
        { month: '2026-05', mrr: currentMrr },
      ],
    });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/analytics/tenants', async (_req, res, next) => {
  try {
    const [active, suspended, pending] = await Promise.all([
      RestaurantModel.countDocuments({ status: RestaurantStatus.ACTIVE }),
      RestaurantModel.countDocuments({ status: RestaurantStatus.SUSPENDED }),
      RestaurantModel.countDocuments({ status: RestaurantStatus.PENDING_APPROVAL }),
    ]);

    ok(res, {
      tenants: {
        active,
        suspended,
        pending,
      },
    });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/system/monitoring', async (_req, res, next) => {
  try {
    ok(res, {
      system: {
        apiLatencyMsP95: 148,
        socketConnections: 0,
        errorRatePercent: 0.3,
        dbStatus: mongoose.connection.readyState === 1 ? 'healthy' : 'disconnected',
      },
    });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const { actorId, action, from, to } = req.query;
    const query: Record<string, unknown> = {};

    if (actorId) query.actorId = String(actorId);
    if (action) query.action = String(action);
    if (from || to) {
      query.createdAt = {};
      if (from) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(String(from));
      }
      if (to) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(String(to));
      }
    }

    const auditLogs = await AuditLogModel.find(query)
      .populate('restaurantId', 'name city slug logo')
      .populate('actorId', 'name email phone role')
      .sort({ createdAt: -1 })
      .lean();
    ok(res, { auditLogs });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/feature-flags', async (_req, res, next) => {
  try {
    const featureFlags = await FeatureFlagModel.find().sort({ key: 1 });
    ok(res, { featureFlags });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.patch('/feature-flags/:id', async (req, res, next) => {
  try {
    const featureFlag = await FeatureFlagModel.findByIdAndUpdate(
      req.params.id,
      { enabled: Boolean(req.body?.enabled) },
      { new: true },
    );

    ok(res, { featureFlag });
  } catch (error) {
    next(error);
  }
});

function formatTimestamp(date?: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

superAdminRouter.get('/transactions', async (_req, res, next) => {
  try {
    const [onboardingRequests, subscriptionPayments, orderPayments, settings] = await Promise.all([
      RestaurantRequestModel.find({
        paymentStatus: 'CAPTURED',
        paymentAmount: { $gt: 0 }
      }).setOptions({ bypassTenant: true }).lean(),
      
      SubscriptionPaymentModel.find()
        .populate('restaurantId')
        .setOptions({ bypassTenant: true })
        .lean(),
      
      PaymentModel.find()
        .populate('restaurantId')
        .setOptions({ bypassTenant: true })
        .lean(),

      getPlatformSettings()
    ]);

    const commissionRate = settings.platformCommissionRate ?? 10;
    const transactions: any[] = [];

    // 1. Map onboarding fee payments
    onboardingRequests.forEach((r: any) => {
      transactions.push({
        id: r.paymentId || `ONB-${r._id}`,
        restaurant: r.restaurantName,
        restaurantId: r.restaurantId ? r.restaurantId.toString() : r._id.toString(),
        amount: r.paymentAmount || 0,
        commission: r.paymentAmount || 0,
        commissionRate: 100,
        paymentMethod: 'UPI / Wallet',
        status: 'Completed',
        timestamp: formatTimestamp(r.paymentTimestamp || r.updatedAt),
        city: r.city || 'Onboarding',
        ordersCount: 0,
        note: 'Onboarding Fee'
      });
    });

    // 2. Map subscription plan payments
    subscriptionPayments.forEach((sp: any) => {
      const restName = sp.restaurantId?.name || 'Unknown Restaurant';
      const restCity = sp.restaurantId?.city || 'Platform';
      transactions.push({
        id: sp.providerPaymentId || `SUB-${sp._id}`,
        restaurant: restName,
        restaurantId: sp.restaurantId?._id?.toString() || sp.restaurantId?.toString() || '',
        amount: sp.amount || 0,
        commission: sp.amount || 0,
        commissionRate: 100,
        paymentMethod: sp.provider === 'razorpay' ? 'UPI / Wallet' : 'Credit Card',
        status: sp.status === 'completed' ? 'Completed' : sp.status === 'failed' ? 'Failed' : 'Pending',
        timestamp: formatTimestamp(sp.paidAt || sp.createdAt),
        city: restCity,
        ordersCount: 0,
        note: 'Subscription renewal'
      });
    });

    // 3. Map dining order payments
    orderPayments.forEach((op: any) => {
      const restName = op.restaurantId?.name || 'Unknown Restaurant';
      const restCity = op.restaurantId?.city || 'Unknown';
      let method: any = 'UPI / Wallet';
      if (op.method === 'CASH') method = 'Cash';
      else if (op.method === 'CREDIT_CARD') method = 'Credit Card';
      else if (op.method === 'NET_BANKING') method = 'Net Banking';
      else if (op.method === 'CRYPTO') method = 'Crypto';

      const storedCommissionRate = op.commissionRate !== undefined && op.commissionRate !== null ? op.commissionRate : commissionRate;
      const storedCommission = op.commission !== undefined && op.commission !== null ? op.commission : Math.round((op.amount || 0) * (storedCommissionRate / 100) * 100) / 100;

      transactions.push({
        id: op.providerPaymentId || op.razorpayPaymentId || `ORD-${op._id}`,
        restaurant: restName,
        restaurantId: op.restaurantId?._id?.toString() || op.restaurantId?.toString() || '',
        amount: op.amount || 0,
        commission: storedCommission,
        commissionRate: storedCommissionRate,
        paymentMethod: method,
        status: op.status === 'COMPLETED' ? 'Completed' : op.status === 'FAILED' ? 'Failed' : 'Pending',
        timestamp: formatTimestamp(op.verifiedAt || op.createdAt),
        city: restCity,
        ordersCount: 1,
        note: 'Dining Order Payment'
      });
    });

    // Sort descending by timestamp
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    ok(res, { transactions });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.get('/analytics/orders', async (_req, res, next) => {
  try {
    const [orders, settings] = await Promise.all([
      OrderModel.find()
        .populate('restaurantId')
        .setOptions({ bypassTenant: true })
        .sort({ createdAt: -1 })
        .lean(),
      getPlatformSettings()
    ]);

    const commissionRate = settings.platformCommissionRate ?? 10;

    // Fetch matching payments to retrieve stored commission values
    const orderIds = orders.map((o: any) => o._id);
    const payments = await PaymentModel.find({ orderId: { $in: orderIds } })
      .setOptions({ bypassTenant: true })
      .lean();

    const paymentMap = new Map<string, any>();
    payments.forEach((p: any) => {
      paymentMap.set(p.orderId.toString(), p);
    });

    const mappedOrders = orders.map((o: any) => {
      const restName = o.restaurantId?.name || 'Unknown Restaurant';
      let status: any = 'Processing';
      if (o.paymentStatus === 'PAID' || o.status === 'SERVED' || o.status === 'COMPLETED') {
        status = 'Settled';
      } else if (o.status === 'CANCELLED' || o.status === 'REJECTED') {
        status = 'Disputed';
      }

      // Format date for visual representation on dashboard
      const date = new Date(o.createdAt);
      let timeStr = 'Awaiting backend sync';
      if (!isNaN(date.getTime())) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        
        const pad = (n: number) => String(n).padStart(2, '0');
        const formattedTime = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        
        if (date.toDateString() === today.toDateString()) {
          timeStr = `Today, ${formattedTime}`;
        } else if (date.toDateString() === yesterday.toDateString()) {
          timeStr = `Yesterday, ${formattedTime}`;
        } else {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          timeStr = `${months[date.getMonth()]} ${date.getDate()}, ${formattedTime}`;
        }
      }

      const grossAmount = o.finalAmount || o.totalAmount || 0;
      const associatedPayment = paymentMap.get(o._id.toString());
      
      const storedCommissionRate = associatedPayment?.commissionRate !== undefined && associatedPayment?.commissionRate !== null
        ? associatedPayment.commissionRate
        : commissionRate;

      const storedCommission = associatedPayment?.commission !== undefined && associatedPayment?.commission !== null
        ? associatedPayment.commission
        : Math.round(grossAmount * (storedCommissionRate / 100) * 100) / 100; // fallback calculation

      return {
        id: o.orderNumber || o._id.toString(),
        restaurant: restName,
        type: 'Dine-In',
        grossAmount,
        commission: storedCommission,
        commissionRate: storedCommissionRate,
        status,
        timestamp: timeStr
      };
    });

    ok(res, { orders: mappedOrders, commissionRate });
  } catch (error) {
    next(error);
  }
});

// GET /super-admin/restaurants/:id/live-activity
superAdminRouter.get('/restaurants/:id/live-activity', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid restaurant ID', 400, ErrorCode.VALIDATION_ERROR);
    }

    const restaurant = await RestaurantModel.findById(id).lean();
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
    }

    const restaurantId = new mongoose.Types.ObjectId(id);

    // Today's date boundaries (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [
      tableStatusAgg,
      activeSessions,
      todayOrdersAgg,
      activeOrderCount,
      recentOrders,
      queueWaiting,
      todayReservations,
    ] = await Promise.all([
      // 1. Table breakdown by status
      TableModel.aggregate([
        { $match: { restaurantId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // 2. Active sessions
      TableSessionModel.countDocuments({ restaurantId, status: SessionStatus.ACTIVE }),

      // 3. Today's orders — count + revenue
      OrderModel.aggregate([
        { $match: { restaurantId, createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$finalAmount' } } },
      ]),

      // 4. Active orders (in-progress)
      OrderModel.countDocuments({
        restaurantId,
        status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
      }),

      // 5. All orders
      OrderModel.find({ restaurantId })
        .sort({ createdAt: -1 })
        .select('orderNumber status finalAmount tableId createdAt customerName')
        .lean(),

      // 6. Queue waiting
      QueueEntryModel.countDocuments({ restaurantId, status: QueueStatus.WAITING }),

      // 7. Today's reservations
      ReservationModel.countDocuments({
        restaurantId,
        status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        date: { $gte: todayStart, $lte: todayEnd },
      }),
    ]);

    // Build table breakdown map
    const tables: Record<string, number> = {};
    let totalTables = 0;
    for (const row of tableStatusAgg) {
      tables[row._id] = row.count;
      totalTables += row.count;
    }

    const todayData = todayOrdersAgg[0] || { count: 0, revenue: 0 };

    ok(res, {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        ownerName: restaurant.ownerName,
        status: restaurant.status,
        plan: restaurant.plan || 'Basic',
      },
      tables: {
        total: totalTables,
        breakdown: tables,
        occupied: (tables['OCCUPIED'] || 0) + (tables['ORDERING'] || 0) + (tables['BILL_PENDING'] || 0) + (tables['PAYMENT_PENDING'] || 0) + (tables['Occupied'] || 0),
        reserved: (tables['RESERVED'] || 0) + (tables['Reserved'] || 0),
        available: (tables['AVAILABLE'] || 0) + (tables['Available'] || 0),
        cleaning: (tables['NEEDS_CLEANING'] || 0) + (tables['CLEANING_IN_PROGRESS'] || 0) + (tables['CLEANING'] || 0) + (tables['Cleaning'] || 0),
        maintenance: (tables['MAINTENANCE'] || 0) + (tables['BLOCKED'] || 0) + (tables['Blocked'] || 0) + (tables['Maintenance'] || 0),
      },
      sessions: {
        active: activeSessions,
      },
      orders: {
        todayCount: todayData.count,
        todayRevenue: todayData.revenue,
        activeCount: activeOrderCount,
        recent: recentOrders.map((o: any) => ({
          id: o._id,
          orderNumber: o.orderNumber,
          status: o.status,
          amount: o.finalAmount,
          customerName: o.customerName || 'Walk-in',
          createdAt: o.createdAt,
        })),
      },
      queue: {
        waiting: queueWaiting,
      },
      reservations: {
        todayCount: todayReservations,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /super-admin/users - List all database users with SuperAdmin as first card
superAdminRouter.get('/users', async (_req, res, next) => {
  try {
    const rawUsers = await UserModel.find({ isDeleted: { $ne: true } })
      .populate('restaurantId', 'name city slug logo')
      .setOptions({ bypassTenant: true })
      .sort({ createdAt: -1 })
      .lean();

    // Sort: SUPER_ADMIN role comes FIRST always
    const superAdminUsers = rawUsers.filter((u: any) => u.role === 'SUPER_ADMIN');
    const otherUsers = rawUsers.filter((u: any) => u.role !== 'SUPER_ADMIN');

    const sortedUsers = [...superAdminUsers, ...otherUsers];

    const users = sortedUsers.map((u: any) => {
      const restName = u.restaurantId?.name || 'Platform Level / System';
      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        mobile: u.mobile || u.phone || 'N/A',
        role: u.role,
        subRole: u.kitchen_role || u.staff_role || u.cleaning_role || undefined,
        status: u.status || 'ACTIVE',
        restaurantName: restName,
        restaurantId: u.restaurantId?._id?.toString() || u.restaurantId?.toString(),
        isEmailVerified: !!u.isEmailVerified,
        isMobileVerified: !!u.isMobileVerified,
        createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A',
        lastActive: u.updatedAt ? new Date(u.updatedAt).toLocaleString() : 'N/A',
        avatar: u.avatar || undefined,
        rawUser: u,
      };
    });

    ok(res, { users });
  } catch (error) {
    next(error);
  }
});

// Mount module-level superAdmin routes (restaurant-requests, etc.)
import superAdminModuleRouter from '../superAdmin/superAdmin.routes';
superAdminRouter.use('/', superAdminModuleRouter);

