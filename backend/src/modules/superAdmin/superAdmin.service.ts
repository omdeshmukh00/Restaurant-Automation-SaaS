// src/modules/superAdmin/superAdmin.service.ts
// All DB logic for super admin operations.
// Controllers stay thin — everything lives here.

import mongoose, { FilterQuery } from 'mongoose';
import { RestaurantModel } from '../restaurants/restaurants.model';
import { UserModel } from '../users/users.model';
import { PlatformPlanModel, FeatureFlagModel, SystemAlertModel } from './superAdmin.model';
import { getPlatformSettings } from './platformSettings.model';
import { EmailLogModel } from '../notifications/emailLog.model';
import { AuditLogModel } from '../auditLogs/auditLogs.schema';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { RestaurantStatus } from '../../constants/statuses';
import type {
  RestaurantListQuery,
  CreatePlanInput,
  UpdatePlanInput,
  UpdateFeatureFlagInput,
  AnalyticsQuery,
  SuperAdminAuditLogQuery,
  CreateRestaurantInput,
} from './superAdmin.schema';

// ── Helpers ───────────────────────────────────────────────────────────

function getDateRange(groupBy: string, from?: string, to?: string) {
  const now = new Date();
  let start: Date;
  const end = to ? new Date(to) : now;

  if (from) {
    start = new Date(from);
  } else {
    // Default ranges when no from/to provided
    switch (groupBy) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      default: // day
        start = new Date(now);
        start.setDate(now.getDate() - 1);
        break;
    }
  }

  return { start, end };
}

function getGroupByFormat(groupBy: string) {
  switch (groupBy) {
    case 'week':
      return { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
    case 'month':
      return { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
    case 'year':
      return { year: { $year: '$createdAt' } };
    default: // day
      return {
        year:  { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day:   { $dayOfMonth: '$createdAt' },
      };
  }
}

// ──────────────────────────────────────────────────────────────────────
// RESTAURANT MANAGEMENT
// ──────────────────────────────────────────────────────────────────────

export async function listRestaurants(filters: RestaurantListQuery) {
  const { status, plan, search, page = 1, limit = 20 } = filters;

  const query: FilterQuery<typeof RestaurantModel> = { isDeleted: { $ne: true } };

  if (status) query.status = status;
  if (plan)   query.plan   = plan;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [restaurants, total] = await Promise.all([
    RestaurantModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    RestaurantModel.countDocuments(query),
  ]);

  // Calculate remaining cooldown in seconds for each restaurant
  const recipientEmails = restaurants.map((r: any) => r.email).filter(Boolean);
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const recentLogs = await EmailLogModel.find({
    recipient: { $in: recipientEmails },
    status: 'SENT',
    sentAt: { $gte: oneMinuteAgo }
  }).lean();

  const cooldownMap: Record<string, number> = {};
  recentLogs.forEach((log: any) => {
    const elapsedSeconds = Math.floor((Date.now() - log.sentAt.getTime()) / 1000);
    const remaining = 60 - elapsedSeconds;
    if (remaining > 0) {
      cooldownMap[log.recipient] = Math.max(cooldownMap[log.recipient] || 0, remaining);
    }
  });

  const enrichedRestaurants = restaurants.map((r: any) => {
    const email = r.email;
    const cooldown = email ? (cooldownMap[email] || 0) : 0;
    return {
      ...r,
      cooldownRemaining: cooldown,
    };
  });

  return {
    restaurants: enrichedRestaurants,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRestaurantById(id: string) {
  const restaurant = await RestaurantModel.findById(id)
    .populate('onboardingRequestId')
    .lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  let cooldown = 0;
  if (restaurant.email) {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentEmail = await EmailLogModel.findOne({
      recipient: restaurant.email,
      status: 'SENT',
      sentAt: { $gte: oneMinuteAgo }
    }).sort({ sentAt: -1 }).lean();
    if (recentEmail) {
      cooldown = Math.max(0, 60 - Math.floor((Date.now() - recentEmail.sentAt.getTime()) / 1000));
    }
  }

  return {
    ...restaurant,
    cooldownRemaining: cooldown,
  };
}

export async function approveRestaurant(id: string) {
  const restaurant = await RestaurantModel.findByIdAndUpdate(
    id,
    { status: RestaurantStatus.ACTIVE },
    { new: true },
  ).lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  return restaurant;
}

export async function suspendRestaurant(id: string) {
  const restaurant = await RestaurantModel.findByIdAndUpdate(
    id,
    { status: RestaurantStatus.SUSPENDED },
    { new: true },
  ).lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  return restaurant;
}

export async function deleteRestaurant(id: string) {
  const { RestaurantStatus } = await import('../../constants/statuses');
  const restaurant = await RestaurantModel.findByIdAndUpdate(
    id,
    { 
      isDeleted: true,
      status: RestaurantStatus.SUSPENDED
    },
    { new: true }
  ).lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  // Deactivate all users of this restaurant so they cannot log in
  const { UserModel } = await import('../users/users.model');
  await UserModel.updateMany({ restaurantId: id }, { status: 'INACTIVE' });

  return restaurant;
}

// ──────────────────────────────────────────────────────────────────────
// PLANS
// ──────────────────────────────────────────────────────────────────────

let cachedPlans: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 120_000; // 120 seconds (2 minutes)

export function clearPlansCache() {
  cachedPlans = null;
  cacheTimestamp = 0;
}

export async function createPlan(input: CreatePlanInput) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existing = await PlatformPlanModel.findOne({ name: input.name }).session(session);
    if (existing) {
      throw new AppError('Plan with this name already exists', 409, ErrorCode.CONFLICT);
    }

    const created = await PlatformPlanModel.create([input], { session });
    await session.commitTransaction();
    clearPlansCache();
    return created[0];
  } catch (error) {
    await session.abortTransaction();
    const anyErr = error as any;
    if (anyErr?.code === 11000) {
      throw new AppError('Plan with this name already exists', 409, ErrorCode.CONFLICT);
    }
    throw error;
  } finally {
    session.endSession();
  }
}

export async function listPlans(activeOnly = false) {
  const now = Date.now();
  if (!cachedPlans || now - cacheTimestamp > CACHE_TTL_MS) {
    cachedPlans = await PlatformPlanModel.find().sort({ priceMonthly: 1 }).lean();
    cacheTimestamp = now;
  }

  if (activeOnly) {
    return cachedPlans.filter((plan: any) => plan.isActive !== false);
  }
  return cachedPlans;
}

export async function updatePlan(id: string, input: UpdatePlanInput) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const plan = await PlatformPlanModel.findByIdAndUpdate(
      id,
      input,
      { new: true, runValidators: true, session },
    ).lean();

    if (!plan) {
      throw new AppError('Plan not found', 404, ErrorCode.NOT_FOUND);
    }

    await session.commitTransaction();
    clearPlansCache();
    return plan;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function deletePlan(id: string) {
  const plan = await PlatformPlanModel.findByIdAndDelete(id).lean();
  if (!plan) {
    throw new AppError('Plan not found', 404, ErrorCode.NOT_FOUND);
  }
  clearPlansCache();
  return plan;
}

export async function applyBulkOffers(input: { yearlyDiscountPercentage?: number | null; monthlyDiscountPercentage?: number | null }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const plans = await PlatformPlanModel.find().session(session);

    for (const plan of plans) {
      // 1. Update yearlyDiscountPercentage if passed
      if (input.yearlyDiscountPercentage !== undefined && input.yearlyDiscountPercentage !== null) {
        plan.yearlyDiscountPercentage = input.yearlyDiscountPercentage;
      }

      // 2. Update monthlyDiscountPercentage if passed
      if (input.monthlyDiscountPercentage !== undefined && input.monthlyDiscountPercentage !== null) {
        const discPct = input.monthlyDiscountPercentage;
        if (discPct === 0) {
          if (plan.originalPriceMonthly) {
            plan.priceMonthly = plan.originalPriceMonthly;
          }
          plan.originalPriceMonthly = null;
        } else {
          if (plan.name.toLowerCase() !== 'free' && plan.priceMonthly > 0) {
            const orig = plan.originalPriceMonthly || plan.priceMonthly;
            plan.originalPriceMonthly = orig;
            plan.priceMonthly = Math.round(orig * (1 - discPct / 100));
          }
        }
      }

      await plan.save({ session });
    }

    await session.commitTransaction();
    clearPlansCache();
    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// ──────────────────────────────────────────────────────────────────────
// FEATURE FLAGS
// ──────────────────────────────────────────────────────────────────────

export async function listFeatureFlags() {
  return FeatureFlagModel.find().sort({ key: 1 }).lean();
}

export async function updateFeatureFlag(id: string, input: UpdateFeatureFlagInput) {
  const flag = await FeatureFlagModel.findByIdAndUpdate(
    id,
    { enabled: input.enabled },
    { new: true },
  ).lean();

  if (!flag) {
    throw new AppError('Feature flag not found', 404, ErrorCode.NOT_FOUND);
  }

  return flag;
}

// ──────────────────────────────────────────────────────────────────────
// ANALYTICS
// ──────────────────────────────────────────────────────────────────────

export async function getPlatformOverview() {
  const { OrderModel } = await import('../orders/orders.model');
  const { PaymentModel } = await import('../payments/payments.model');
  const { RestaurantRequestModel } = await import('./restaurantRequest.model');
  const { SubscriptionPaymentModel } = await import('../subscriptions/subscriptions.model');

  const now = new Date();
  
  // Start of this month
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Start of last month
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // End of last month
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // 6 months ago (for trend chart)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    restaurantResult,
    orderResult,
    paymentResult,
    onboardingResult,
    subscriptionResult,
  ] = await Promise.all([
    // 1. Restaurant Stats & status counts
    RestaurantModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          beforeThisMonth: [
            { $match: { createdAt: { $lt: startOfThisMonth } } },
            { $count: 'count' }
          ],
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]
        }
      }
    ]),

    // 2. Order Stats
    OrderModel.aggregate([
      {
        $facet: {
          thisMonth: [
            {
              $match: {
                createdAt: { $gte: startOfThisMonth },
                status: { $in: ['COMPLETED', 'SERVED'] }
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$finalAmount' },
                orders: { $sum: 1 }
              }
            }
          ],
          lastMonth: [
            {
              $match: {
                createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
                status: { $in: ['COMPLETED', 'SERVED'] }
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$finalAmount' },
                orders: { $sum: 1 }
              }
            }
          ],
          trend: [
            {
              $match: {
                createdAt: { $gte: sixMonthsAgo },
                status: { $in: ['COMPLETED', 'SERVED'] }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                orders: { $sum: 1 }
              }
            }
          ],
          topRestaurants: [
            {
              $match: {
                createdAt: { $gte: startOfThisMonth },
                status: { $in: ['COMPLETED', 'SERVED'] }
              }
            },
            {
              $group: {
                _id: '$restaurantId',
                orders: { $sum: 1 },
                revenue: { $sum: '$finalAmount' }
              }
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]),

    // 3. Payment Stats (Commissions)
    PaymentModel.aggregate([
      {
        $facet: {
          thisMonth: [
            {
              $match: {
                createdAt: { $gte: startOfThisMonth },
                status: 'COMPLETED'
              }
            },
            {
              $group: {
                _id: null,
                commission: { $sum: '$commission' }
              }
            }
          ],
          lastMonth: [
            {
              $match: {
                createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
                status: 'COMPLETED'
              }
            },
            {
              $group: {
                _id: null,
                commission: { $sum: '$commission' }
              }
            }
          ],
          trend: [
            {
              $match: {
                createdAt: { $gte: sixMonthsAgo },
                status: 'COMPLETED'
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                commission: { $sum: '$commission' }
              }
            }
          ]
        }
      }
    ]),

    // 4. Onboarding Stats (Restaurant Request payments)
    RestaurantRequestModel.aggregate([
      {
        $facet: {
          thisMonth: [
            {
              $match: {
                paymentStatus: 'CAPTURED',
                paymentTimestamp: { $gte: startOfThisMonth }
              }
            },
            {
              $group: {
                _id: null,
                amount: { $sum: '$paymentAmount' }
              }
            }
          ],
          lastMonth: [
            {
              $match: {
                paymentStatus: 'CAPTURED',
                paymentTimestamp: { $gte: startOfLastMonth, $lte: endOfLastMonth }
              }
            },
            {
              $group: {
                _id: null,
                amount: { $sum: '$paymentAmount' }
              }
            }
          ],
          trend: [
            {
              $match: {
                paymentStatus: 'CAPTURED',
                paymentTimestamp: { $gte: sixMonthsAgo }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$paymentTimestamp' },
                  month: { $month: '$paymentTimestamp' }
                },
                amount: { $sum: '$paymentAmount' }
              }
            }
          ]
        }
      }
    ]),

    // 5. Subscription Stats
    SubscriptionPaymentModel.aggregate([
      {
        $facet: {
          thisMonth: [
            {
              $match: {
                status: 'completed',
                paidAt: { $gte: startOfThisMonth }
              }
            },
            {
              $group: {
                _id: null,
                amount: { $sum: '$amount' }
              }
            }
          ],
          lastMonth: [
            {
              $match: {
                status: 'completed',
                paidAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
              }
            },
            {
              $group: {
                _id: null,
                amount: { $sum: '$amount' }
              }
            }
          ],
          trend: [
            {
              $match: {
                status: 'completed',
                paidAt: { $gte: sixMonthsAgo }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$paidAt' },
                  month: { $month: '$paidAt' }
                },
                amount: { $sum: '$amount' }
              }
            }
          ]
        }
      }
    ]),
  ]);

  // Extract from facets
  const totalRestaurants = restaurantResult[0]?.total[0]?.count || 0;
  const restaurantsBeforeThisMonth = restaurantResult[0]?.beforeThisMonth[0]?.count || 0;
  const statusCounts = restaurantResult[0]?.statusCounts || [];

  const monthlyOrderStats = orderResult[0]?.thisMonth || [];
  const lastMonthOrderStats = orderResult[0]?.lastMonth || [];
  const ordersCountTrend = orderResult[0]?.trend || [];
  const topRestaurantsStats = orderResult[0]?.topRestaurants || [];

  const monthlyOrderPaymentsCommission = paymentResult[0]?.thisMonth || [];
  const lastMonthOrderPaymentsCommission = paymentResult[0]?.lastMonth || [];
  const diningCommissionsTrend = paymentResult[0]?.trend || [];

  const monthlyOnboardingPayments = onboardingResult[0]?.thisMonth || [];
  const lastMonthOnboardingPayments = onboardingResult[0]?.lastMonth || [];
  const onboardingFeesTrend = onboardingResult[0]?.trend || [];

  const monthlySubscriptionPayments = subscriptionResult[0]?.thisMonth || [];
  const lastMonthSubscriptionPayments = subscriptionResult[0]?.lastMonth || [];
  const subscriptionFeesTrend = subscriptionResult[0]?.trend || [];

  // Populate names for top restaurants
  const topRestaurants = [];
  if (topRestaurantsStats.length > 0) {
    const restaurantIds = topRestaurantsStats.map((item: any) => item._id);
    const restaurantDocs = await RestaurantModel.find({ _id: { $in: restaurantIds } }).lean();
    const restNameMap = new Map();
    restaurantDocs.forEach((r: any) => {
      restNameMap.set(r._id.toString(), r.name);
    });

    for (const item of topRestaurantsStats) {
      const name = restNameMap.get(item._id.toString()) || 'Unknown Restaurant';
      topRestaurants.push({
        name,
        orders: item.orders,
        revenue: `₹${item.revenue.toLocaleString()}`,
        growth: '+10%'
      });
    }
  }

  // Parse status counts
  let activeCount = 0;
  let trialCount = 0;
  let inactiveCount = 0;
  let blockedCount = 0;

  statusCounts.forEach((sc: any) => {
    const status = sc._id;
    if (status === 'ACTIVE') {
      activeCount += sc.count;
    } else if (['ONBOARDING', 'PENDING_APPROVAL', 'APPLICATION_APPROVED', 'ADMIN_SETUP_PENDING', 'PLAN_SELECTION_PENDING', 'PAYMENT_PENDING'].includes(status)) {
      trialCount += sc.count;
    } else if (status === 'SUSPENDED') {
      blockedCount += sc.count;
    } else {
      inactiveCount += sc.count;
    }
  });

  const pieData = [
    { name: 'Active', value: activeCount, color: '#10B981' },
    { name: 'Trial', value: trialCount, color: '#F97316' },
    { name: 'Inactive', value: inactiveCount, color: '#64748B' },
    { name: 'Blocked', value: blockedCount, color: '#EF4444' },
  ];

  // Calculate Superadmin Monthly Revenue and growth (Commissions + Onboarding + Subscriptions)
  const monthlyRevenue = (monthlyOrderPaymentsCommission[0]?.commission || 0) + (monthlyOnboardingPayments[0]?.amount || 0) + (monthlySubscriptionPayments[0]?.amount || 0);
  const lastMonthSuperadminRevenue = (lastMonthOrderPaymentsCommission[0]?.commission || 0) + (lastMonthOnboardingPayments[0]?.amount || 0) + (lastMonthSubscriptionPayments[0]?.amount || 0);
  const revenueGrowthVal = lastMonthSuperadminRevenue > 0 ? ((monthlyRevenue - lastMonthSuperadminRevenue) / lastMonthSuperadminRevenue) * 100 : 0;
  const revenueGrowth = (revenueGrowthVal >= 0 ? '+' : '') + Math.round(revenueGrowthVal * 10) / 10 + '%';

  // Calculate Total Orders and growth
  const thisMonthOrders = monthlyOrderStats[0]?.orders || 0;
  const lastMonthOrders = lastMonthOrderStats[0]?.orders || 0;
  const ordersGrowthVal = lastMonthOrders > 0 ? ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100 : 0;
  const ordersGrowth = (ordersGrowthVal >= 0 ? '+' : '') + Math.round(ordersGrowthVal * 10) / 10 + '%';

  // Calculate Dining Commission Earned specifically
  const commissionEarned = monthlyOrderPaymentsCommission[0]?.commission || 0;
  const lastMonthDiningCommission = lastMonthOrderPaymentsCommission[0]?.commission || 0;
  const commissionGrowthVal = lastMonthDiningCommission > 0 ? ((commissionEarned - lastMonthDiningCommission) / lastMonthDiningCommission) * 100 : 0;
  const commissionGrowth = (commissionGrowthVal >= 0 ? '+' : '') + Math.round(commissionGrowthVal * 10) / 10 + '%';

  // Restaurant growth
  const restaurantGrowthVal = restaurantsBeforeThisMonth > 0 ? ((totalRestaurants - restaurantsBeforeThisMonth) / restaurantsBeforeThisMonth) * 100 : 0;
  const restaurantGrowth = (restaurantGrowthVal >= 0 ? '+' : '') + Math.round(restaurantGrowthVal * 10) / 10 + '%';

  // Format 6-month trend data based on superadmin monthly revenue
  const monthsAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedTrend = [];
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthLabel = monthsAbbr[d.getMonth()];
    
    const matchedCommission = diningCommissionsTrend.find((item: any) => item._id.year === year && item._id.month === month);
    const matchedOnboarding = onboardingFeesTrend.find((item: any) => item._id.year === year && item._id.month === month);
    const matchedSubscription = subscriptionFeesTrend.find((item: any) => item._id.year === year && item._id.month === month);
    const matchedOrders = ordersCountTrend.find((item: any) => item._id.year === year && item._id.month === month);

    const totalRevenue = 
      (matchedCommission?.commission || 0) + 
      (matchedOnboarding?.amount || 0) + 
      (matchedSubscription?.amount || 0);

    formattedTrend.push({
      month: monthLabel,
      revenue: totalRevenue,
      orders: matchedOrders?.orders || 0
    });
  }

  return {
    stats: {
      totalRestaurants,
      restaurantGrowth,
      monthlyRevenue,
      revenueGrowth,
      totalOrders: thisMonthOrders,
      ordersGrowth,
      commissionEarned,
      commissionGrowth,
    },
    pieData,
    revenueData: formattedTrend,
    topRestaurants,
  };
}

export async function getRevenueAnalytics(query: AnalyticsQuery) {
  const { groupBy = 'day', from, to } = query;
  const { start, end } = getDateRange(groupBy, from, to);
  const groupFormat = getGroupByFormat(groupBy);

  const { PaymentModel } = await import('../payments/payments.model');
  const { RestaurantRequestModel } = await import('./restaurantRequest.model');
  const { SubscriptionPaymentModel } = await import('../subscriptions/subscriptions.model');

  // We want to fetch all three types of platform earnings in the date range
  const [commissions, onboarding, subscriptions] = await Promise.all([
    // Dining commissions
    PaymentModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'COMPLETED',
        },
      },
      {
        $group: {
          _id:          groupFormat,
          totalRevenue: { $sum: '$commission' },
          totalOrders:  { $sum: 1 },
        },
      },
    ]),

    // Onboarding fees
    RestaurantRequestModel.aggregate([
      {
        $match: {
          paymentStatus: 'CAPTURED',
          paymentTimestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id:          {
            year: { $year: '$paymentTimestamp' },
            month: { $month: '$paymentTimestamp' },
            day: { $dayOfMonth: '$paymentTimestamp' }
          },
          totalRevenue: { $sum: '$paymentAmount' },
          totalOrders:  { $sum: 0 },
        },
      },
    ]),

    // Subscription charges
    SubscriptionPaymentModel.aggregate([
      {
        $match: {
          status: 'completed',
          paidAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id:          {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            day: { $dayOfMonth: '$paidAt' }
          },
          totalRevenue: { $sum: '$amount' },
          totalOrders:  { $sum: 0 },
        },
      },
    ]),
  ]);

  // Combine them in memory
  const mergedMap = new Map<string, { year: number, month: number, day?: number, totalRevenue: number, totalOrders: number }>();

  const getMapKey = (id: any) => {
    if (!id) return '';
    return `${id.year}-${id.month}-${id.day || 1}`;
  };

  const addItems = (list: any[]) => {
    for (const item of list) {
      const key = getMapKey(item._id);
      if (!key) continue;
      const existing = mergedMap.get(key);
      if (existing) {
        existing.totalRevenue += (item.totalRevenue || 0);
        existing.totalOrders += (item.totalOrders || 0);
      } else {
        mergedMap.set(key, {
          year: item._id.year,
          month: item._id.month,
          day: item._id.day,
          totalRevenue: item.totalRevenue || 0,
          totalOrders: item.totalOrders || 0,
        });
      }
    }
  };

  addItems(commissions);
  addItems(onboarding);
  addItems(subscriptions);

  const data = Array.from(mergedMap.values()).map(item => {
    const _id: any = { year: item.year, month: item.month };
    if (item.day !== undefined) {
      _id.day = item.day;
    }
    return {
      _id,
      totalRevenue: item.totalRevenue,
      totalOrders: item.totalOrders,
    };
  });

  // Sort chronologically
  data.sort((a: any, b: any) => {
    if (a._id.year !== b._id.year) return a._id.year - b._id.year;
    if (a._id.month !== b._id.month) return a._id.month - b._id.month;
    return (a._id.day || 0) - (b._id.day || 0);
  });

  return {
    groupBy,
    from: start.toISOString(),
    to:   end.toISOString(),
    data,
  };
}

export async function getActiveTenantAnalytics(query: AnalyticsQuery) {
  const { groupBy = 'day', from, to } = query;
  const { start, end } = getDateRange(groupBy, from, to);
  const groupFormat = getGroupByFormat(groupBy);

  const tenants = await RestaurantModel.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id:   groupFormat,
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  return {
    groupBy,
    from: start.toISOString(),
    to:   end.toISOString(),
    data: tenants,
  };
}

export async function getSystemMonitoring() {
  const [
    totalRestaurants,
    totalUsers,
    activeSessions,
    totalAuditLogs,
  ] = await Promise.all([
    RestaurantModel.countDocuments({ isDeleted: { $ne: true } }),
    UserModel.countDocuments(),
    TableSessionModel.countDocuments({ status: 'ACTIVE' }),
    AuditLogModel.countDocuments(),
  ]);

  return {
    totalRestaurants,
    totalUsers,
    activeSessions,
    totalAuditLogs,
    timestamp: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────
// AUDIT LOGS (platform-wide — no restaurant scope)
// ──────────────────────────────────────────────────────────────────────

export async function getPlatformAuditLogs(filters: SuperAdminAuditLogQuery) {
  const { actorId, action, from, to, page = 1, limit = 20 } = filters;

  const query: FilterQuery<typeof AuditLogModel> = {};

  if (actorId) query.actorId = actorId;
  if (action)  query.action  = action;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to)   query.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLogModel.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── Partner Onboarding Request Services ──────────────────────────────────
import { RestaurantRequestModel } from './restaurantRequest.model';
import { logAuditRaw } from '../auditLogs/auditLogs.helper';
import {AuditEntity, AuditAction } from '../auditLogs/auditLogs.types';
import crypto from 'crypto';
import { slugify, uniqueSlug } from '../../utils/slugify';
import { hashPassword } from '../../utils/crypto';
import { sendRestaurantApprovalEmail, sendRestaurantRejectionEmail, sendRestaurantPlanUpdatedEmail, sendRestaurantSuspendedEmail, sendRestaurantActivatedEmail, sendRestaurantDirectOnboardingEmail } from '../../services/mail.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

async function isEmailOnCooldown(recipient: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const recentEmail = await EmailLogModel.findOne({
    recipient,
    status: 'SENT',
    sentAt: { $gte: oneMinuteAgo }
  });
  return !!recentEmail;
}

export async function listRestaurantRequests() {
  const requests = await RestaurantRequestModel.find({
    status: { $in: ['APPLICATION_PENDING', 'APPLICATION_APPROVED', 'REJECTED', 'PENDING_PAYMENT'] }
  })
    .sort({ submittedAt: -1 })
    .setOptions({ bypassTenant: true })
    .lean();

  return requests.map((req: any) => ({
    id: req._id.toString(),
    name: req.restaurantName,
    owner: req.ownerName,
    email: req.email,
    phone: req.phone,
    location: `${req.city}, ${req.state}, ${req.country}`,
    plan: req.selectedPlan || (req.paymentId ? 'Paid Onboarding' : 'Free Onboarding'),
    requestedAt: req.submittedAt ? req.submittedAt.toISOString() : new Date().toISOString(),
    message: req.message ?? '',
    latitude: req.latitude,
    longitude: req.longitude,
    googleMapsUrl: req.googleMapsUrl ?? '',
    address: req.address,
    city: req.city,
    state: req.state,
    country: req.country,
    pinCode: req.pinCode,
    gstNumber: req.gstNumber ?? '',
    cuisine: req.cuisine,
    branches: req.branches,
    expectedMonthlyOrders: req.expectedMonthlyOrders,
    paymentId: req.paymentId ?? '',
    paymentAmount: req.paymentAmount ?? 0,
    paymentStatus: req.paymentStatus ?? '',
    paymentSignature: req.paymentSignature ?? '',
    paymentTimestamp: req.paymentTimestamp ? req.paymentTimestamp.toISOString() : undefined,
    billingFrequency: req.billingFrequency ?? 'monthly',
    status: req.status,
    rejectionReason: req.rejectionReason ?? '',
  }));
}

export async function approveRestaurantRequest(requestId: string, reviewerId: string) {
  const request = await RestaurantRequestModel.findById(requestId).setOptions({ bypassTenant: true });
  if (!request) {
    throw new AppError('Restaurant request not found', 404, ErrorCode.NOT_FOUND);
  }
  if (request.status !== 'APPLICATION_PENDING') {
    throw new AppError('Request is already processed or not fully submitted', 400, ErrorCode.INVALID_REQUEST);
  }

  // Check if admin user already exists with this email or mobile
  const existingUserByEmail = await UserModel.findOne({ email: request.email }).setOptions({ bypassTenant: true });
  if (existingUserByEmail) {
    throw new AppError(`An administrator account with email '${request.email}' already exists. Please reject this request or ask them to use a different email.`, 400, ErrorCode.INVALID_REQUEST);
  }

  const existingUserByPhone = await UserModel.findOne({ mobile: request.phone }).setOptions({ bypassTenant: true });
  if (existingUserByPhone) {
    throw new AppError(`An administrator account with mobile number '${request.phone}' already exists. Please reject this request or ask them to use a different mobile number.`, 400, ErrorCode.INVALID_REQUEST);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const restaurantId = new mongoose.Types.ObjectId();
    const adminUserId = new mongoose.Types.ObjectId();
    const tenantId = `tenant_${crypto.randomBytes(6).toString('hex')}`;
    
    // Generate unique slug
    let slug = slugify(request.restaurantName);
    const existingRest = await RestaurantModel.findOne({ slug }).setOptions({ bypassTenant: true });
    if (existingRest) {
      slug = uniqueSlug(request.restaurantName);
    }

    // Step 1: Create Restaurant with status ONBOARDING
    // Preserve ALL onboarding details from request.
    const [restaurant] = await RestaurantModel.create([{
      _id: restaurantId,
      slug,
      name: request.restaurantName,
      status: 'ONBOARDING' as any,
      cuisine: request.cuisine,
      city: request.city,
      rating: 4.5,
      tenantId: tenantId,
      ownerName: request.ownerName,
      email: request.email,
      phone: request.phone,
      address: request.address,
      state: request.state,
      country: request.country,
      pinCode: request.pinCode,
      gstNumber: request.gstNumber,
      branches: request.branches,
      expectedMonthlyOrders: request.expectedMonthlyOrders,
      latitude: request.latitude,
      longitude: request.longitude,
      googleMapsUrl: request.googleMapsUrl,
      onboardingRequestId: request._id,
      adminUserId: adminUserId,
      subscriptionId: null,
      revenue: 0,
      lastActive: new Date(),
      joinedDate: new Date(),
      tags: ['New'],
    }], { session });

    // Step 2: Generate temporary password
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^*()_+-=';
    const allChars = lowercase + uppercase + numbers + symbols;

    let tempPassword = '';
    tempPassword += lowercase[crypto.randomInt(lowercase.length)];
    tempPassword += uppercase[crypto.randomInt(uppercase.length)];
    tempPassword += numbers[crypto.randomInt(numbers.length)];
    tempPassword += symbols[crypto.randomInt(symbols.length)];

    for (let i = 4; i < 18; i++) {
      tempPassword += allChars[crypto.randomInt(allChars.length)];
    }
    // Shuffle temp password
    tempPassword = tempPassword.split('').sort(() => crypto.randomInt(3) - 1).join('');

    const hashedPassword = await hashPassword(tempPassword);

    // Step 3: Create Restaurant Admin User (temporary password welcome credentials)
    const [adminUser] = await UserModel.create([{
      _id: adminUserId,
      name: request.ownerName,
      email: request.email,
      mobile: request.phone,
      password: hashedPassword,
      role: 'restaurant-admin',
      status: 'ACTIVE',
      restaurantId: restaurantId,
      tenantId: tenantId,
      isEmailVerified: true,
      isMobileVerified: true,
      mustResetPassword: true,
      firstLogin: true,
      mustChangePassword: true,
    }], { session });

    // Step 4: Update RestaurantRequest status
    request.status = 'APPLICATION_APPROVED';
    request.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
    request.reviewedAt = new Date();
    request.restaurantId = restaurantId;
    await request.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`Partner Request Approved: ${requestId} -> Restaurant: ${restaurantId}`);
    logger.info(`Restaurant Created: ${restaurantId}`);

    // Log Audits
    void logAuditRaw({
      actorId: reviewerId,
      actorRole: 'super-admin',
      entityType: AuditEntity.RESTAURANT,
      entityId: restaurantId.toString(),
      action: AuditAction.SUPER_RESTAURANT_APPROVED,
      metadata: { requestId, tenantId, slug },
    });

    void logAuditRaw({
      actorId: adminUser._id.toString(),
      actorRole: 'restaurant-admin',
      restaurantId: restaurantId.toString(),
      entityType: AuditEntity.USER,
      entityId: adminUser._id.toString(),
      action: AuditAction.ADMIN_CREATED,
      metadata: { source: 'onboarding_approval' },
    });

    // Send welcome email in background to avoid blocking request approval
    const loginUrl = `${env.CLIENT_URL}/auth/admin`;
    void sendRestaurantApprovalEmail(
      request.email,
      request.ownerName,
      request.restaurantName,
      tempPassword,
      loginUrl
    ).then((emailSent) => {
      if (emailSent) {
        void logAuditRaw({
          actorId: reviewerId,
          actorRole: 'super-admin',
          entityType: AuditEntity.USER,
          entityId: request.email,
          action: AuditAction.APPROVAL_EMAIL_SENT,
          metadata: { recipient: request.email },
        });
      }
    }).catch((err) => {
      logger.error('Failed to send restaurant approval email:', { error: err, email: request.email });
    });

    return { restaurant, adminUser };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

export async function registerRestaurantDirectly(input: any, reviewerId: string) {
  // Check if admin user already exists with this email or mobile
  const existingUserByEmail = await UserModel.findOne({ email: input.email }).setOptions({ bypassTenant: true });
  if (existingUserByEmail) {
    throw new AppError(`An administrator account with email '${input.email}' already exists. Please use a different email.`, 400, ErrorCode.INVALID_REQUEST);
  }

  const existingUserByPhone = await UserModel.findOne({ mobile: input.phone }).setOptions({ bypassTenant: true });
  if (existingUserByPhone) {
    throw new AppError(`An administrator account with mobile number '${input.phone}' already exists. Please use a different mobile number.`, 400, ErrorCode.INVALID_REQUEST);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const restaurantId = new mongoose.Types.ObjectId();
    const adminUserId = new mongoose.Types.ObjectId();
    const tenantId = `tenant_${crypto.randomBytes(6).toString('hex')}`;
    
    // Generate unique slug
    let slug = slugify(input.restaurantName);
    const existingRest = await RestaurantModel.findOne({ slug }).setOptions({ bypassTenant: true });
    if (existingRest) {
      slug = uniqueSlug(input.restaurantName);
    }

    // Map status: Trial -> ONBOARDING, Active -> ACTIVE, Inactive -> CLOSED
    let statusVal = RestaurantStatus.ONBOARDING;
    if (input.status === 'Active') {
      statusVal = RestaurantStatus.ACTIVE;
    } else if (input.status === 'Inactive') {
      statusVal = RestaurantStatus.CLOSED;
    }

    // Step 1: Create Restaurant
    const [restaurant] = await RestaurantModel.create([{
      _id: restaurantId,
      slug,
      name: input.restaurantName,
      status: statusVal,
      plan: input.plan,
      cuisine: input.cuisine,
      city: input.city,
      rating: 4.5,
      tenantId: tenantId,
      ownerName: input.ownerName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      state: input.state,
      country: input.country,
      pinCode: input.pinCode,
      gstNumber: input.gstNumber || undefined,
      branches: input.branches || 1,
      expectedMonthlyOrders: input.expectedMonthlyOrders || 0,
      latitude: input.latitude || 0,
      longitude: input.longitude || 0,
      googleMapsUrl: input.googleMapsUrl || undefined,
      adminUserId: adminUserId,
      subscriptionId: null,
      revenue: 0,
      lastActive: new Date(),
      joinedDate: new Date(),
      tags: ['New'],
    }], { session });

    // Step 2: Generate temporary password
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^*()_+-=';
    const allChars = lowercase + uppercase + numbers + symbols;

    let tempPassword = '';
    tempPassword += lowercase[crypto.randomInt(lowercase.length)];
    tempPassword += uppercase[crypto.randomInt(uppercase.length)];
    tempPassword += numbers[crypto.randomInt(numbers.length)];
    tempPassword += symbols[crypto.randomInt(symbols.length)];

    for (let i = 4; i < 18; i++) {
      tempPassword += allChars[crypto.randomInt(allChars.length)];
    }
    // Shuffle temp password
    tempPassword = tempPassword.split('').sort(() => crypto.randomInt(3) - 1).join('');

    const hashedPassword = await hashPassword(tempPassword);

    // Step 3: Create Restaurant Admin User
    const [adminUser] = await UserModel.create([{
      _id: adminUserId,
      name: input.ownerName,
      email: input.email,
      mobile: input.phone,
      password: hashedPassword,
      role: 'restaurant-admin',
      status: 'ACTIVE',
      restaurantId: restaurantId,
      tenantId: tenantId,
      isEmailVerified: true,
      isMobileVerified: true,
      mustResetPassword: true,
      firstLogin: true,
      mustChangePassword: true,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`Restaurant Created Directly by Super Admin: ${restaurantId}`);

    // Log Audits
    void logAuditRaw({
      actorId: reviewerId,
      actorRole: 'super-admin',
      entityType: AuditEntity.RESTAURANT,
      entityId: restaurantId.toString(),
      action: AuditAction.SUPER_RESTAURANT_APPROVED,
      metadata: { tenantId, slug, source: 'direct_registration' },
    });

    void logAuditRaw({
      actorId: adminUser._id.toString(),
      actorRole: 'restaurant-admin',
      restaurantId: restaurantId.toString(),
      entityType: AuditEntity.USER,
      entityId: adminUser._id.toString(),
      action: AuditAction.ADMIN_CREATED,
      metadata: { source: 'direct_registration' },
    });

    // Send welcome email in background
    const loginUrl = `${env.CLIENT_URL}/auth/admin`;
    void sendRestaurantDirectOnboardingEmail(
      input.email,
      input.ownerName,
      input.restaurantName,
      input.plan,
      tempPassword,
      loginUrl
    ).then((emailSent) => {
      if (emailSent) {
        void logAuditRaw({
          actorId: reviewerId,
          actorRole: 'super-admin',
          entityType: AuditEntity.USER,
          entityId: input.email,
          action: AuditAction.APPROVAL_EMAIL_SENT,
          metadata: { recipient: input.email },
        });
      }
    }).catch((err) => {
      logger.error('Failed to send restaurant welcome email:', { error: err, email: input.email });
    });

    return { restaurant, adminUser };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

export async function rejectRestaurantRequest(
  requestId: string,
  reviewerId: string,
  rejectionReason: string,
  refund = false
) {
  const request = await RestaurantRequestModel.findById(requestId).setOptions({ bypassTenant: true });
  if (!request) {
    throw new AppError('Restaurant request not found', 404, ErrorCode.NOT_FOUND);
  }
  if (request.status !== 'APPLICATION_PENDING') {
    throw new AppError('Request is already processed or not fully submitted', 400, ErrorCode.INVALID_REQUEST);
  }

  request.status = 'REJECTED';
  request.rejectionReason = rejectionReason;
  request.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
  request.reviewedAt = new Date();

  let refundDetails: any = {};
  if (refund && request.paymentId && request.paymentAmount && request.paymentAmount > 0) {
    try {
      const { createRazorpayRefund } = await import('../../services/razorpay.service');
      const refundResult = await createRazorpayRefund(request.paymentId, request.paymentAmount, {
        requestId,
        restaurantName: request.restaurantName,
        reason: rejectionReason,
      });

      request.paymentStatus = 'REFUNDED';
      refundDetails = {
        refundId: refundResult.id,
        refundStatus: refundResult.status,
      };

      // Log the refunded event in history collection
      const { RestaurantSubscriptionHistoryModel, RestaurantSubscriptionHistoryEventType } = await import('../subscriptions/restaurantSubscriptionHistory.model');
      await RestaurantSubscriptionHistoryModel.create({
        restaurantId: request._id, // request level reference since restaurant was never created
        plan: request.selectedPlan || 'Free Onboarding',
        billingCycle: request.billingFrequency || 'monthly',
        startDate: request.submittedAt || new Date(),
        endDate: new Date(),
        paymentId: request.paymentId,
        amount: request.paymentAmount,
        status: 'REFUNDED',
        changedBy: reviewerId,
        eventType: RestaurantSubscriptionHistoryEventType.REFUNDED,
        metadata: {
          requestId,
          refundId: refundResult.id,
          rejectionReason,
        },
      });

      // Send Refund Email
      const { sendRefundEmail } = await import('../../services/mail.service');
      void sendRefundEmail(
        request.email,
        request.ownerName,
        request.paymentAmount,
        request.paymentId,
        true
      );
    } catch (err: any) {
      logger.error('Failed to trigger Razorpay refund for partner request rejection:', err);
      request.paymentStatus = 'REFUND_FAILED';
    }
  }

  await request.save();

  logger.info(`Partner Request Rejected: ${requestId}, Reason: ${rejectionReason}`);

  // Log Audit
  void logAuditRaw({
    actorId: reviewerId,
    actorRole: 'super-admin',
    entityType: AuditEntity.RESTAURANT,
    entityId: requestId,
    action: AuditAction.RESTAURANT_REJECTED,
    metadata: { reason: rejectionReason, refundInitiated: refund, ...refundDetails },
  });

  // Send Rejection Email
  void sendRestaurantRejectionEmail(
    request.email,
    request.ownerName,
    request.restaurantName,
    rejectionReason
  ).then((emailSent) => {
    if (emailSent) {
      void logAuditRaw({
        actorId: reviewerId,
        actorRole: 'super-admin',
        entityType: AuditEntity.USER,
        entityId: request.email,
        action: AuditAction.REJECTION_EMAIL_SENT,
        metadata: { recipient: request.email, reason: rejectionReason },
      });
    }
  }).catch((err) => {
    logger.error('Failed to send restaurant rejection email:', { error: err, email: request.email });
  });

  return request;
export async function updateRestaurantStatus(id: string, statusStr: 'Active' | 'Trial' | 'Inactive', blockReason?: string) {
  let status: RestaurantStatus;
  if (statusStr === 'Active') {
    status = RestaurantStatus.ACTIVE;
  } else if (statusStr === 'Trial') {
    status = RestaurantStatus.ONBOARDING;
  } else {
    status = RestaurantStatus.SUSPENDED;
  }

  const oldRestaurant = await RestaurantModel.findById(id).lean();
  if (!oldRestaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  if (oldRestaurant.status === status) {
    return oldRestaurant;
  }

  if (oldRestaurant.email) {
    const onCooldown = await isEmailOnCooldown(oldRestaurant.email);
    if (onCooldown) {
      throw new AppError('This restaurant is on email cooldown. Please wait 60s before updating again.', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    }
  }

  const updateFields: any = { status };
  if (status === RestaurantStatus.SUSPENDED) {
    updateFields.blockReason = blockReason || 'No reason specified';
  } else {
    updateFields.blockReason = null;
  }

  const restaurant = await RestaurantModel.findByIdAndUpdate(
    id,
    updateFields,
    { new: true }
  ).lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  // Trigger emails asynchronously with a 60s cooldown check
  if (restaurant.email) {
    const onCooldown = await isEmailOnCooldown(restaurant.email);
    if (!onCooldown) {
      if (status === RestaurantStatus.SUSPENDED) {
        void sendRestaurantSuspendedEmail(
          restaurant.email,
          restaurant.ownerName || 'Owner',
          restaurant.name,
          updateFields.blockReason
        );
      } else if (oldRestaurant.status === RestaurantStatus.SUSPENDED && status === RestaurantStatus.ACTIVE) {
        void sendRestaurantActivatedEmail(
          restaurant.email,
          restaurant.ownerName || 'Owner',
          restaurant.name
        );
      }
    } else {
      logger.info(`Throttling status change email to ${restaurant.email} due to 60s cooldown`);
    }
  }

  return restaurant;
}

export async function updateRestaurantPlan(id: string, planNameOrId: string) {
  const restaurant = await RestaurantModel.findById(id);
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  // Resolve plan document
  let newPlanDoc = null;
  if (mongoose.Types.ObjectId.isValid(planNameOrId)) {
    newPlanDoc = await PlatformPlanModel.findById(planNameOrId);
  }
  if (!newPlanDoc) {
    newPlanDoc = await PlatformPlanModel.findOne({ name: { $regex: new RegExp(`^${planNameOrId}$`, 'i') } });
  }
  if (!newPlanDoc) {
    throw new AppError(`Subscription plan '${planNameOrId}' not found`, 400, ErrorCode.INVALID_REQUEST);
  }

  const oldPlan = restaurant.plan || 'Basic';
  if (oldPlan.toLowerCase() === newPlanDoc.name.toLowerCase() && restaurant.subscriptionPlan_id?.toString() === newPlanDoc._id.toString()) {
    return restaurant.toObject();
  }

  if (restaurant.email) {
    const onCooldown = await isEmailOnCooldown(restaurant.email);
    if (onCooldown) {
      throw new AppError('This restaurant is on email cooldown. Please wait 60s before updating again.', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    }
  }

  restaurant.plan = newPlanDoc.name;
  restaurant.subscriptionPlan_id = newPlanDoc._id;
  await restaurant.save();

  // Determine upgrade vs demotion based on plan pricing
  let isUpgrade = true;
  let oldPlanDoc = null;
  try {
    oldPlanDoc = await PlatformPlanModel.findOne({ name: { $regex: new RegExp(`^${oldPlan}$`, 'i') } });
    if (oldPlanDoc) {
      isUpgrade = newPlanDoc.priceMonthly >= oldPlanDoc.priceMonthly;
    }
  } catch (err) {
    logger.error('Failed to compare plan prices', err);
  }

  // Update subscription and write history payment record
  try {
    const newPlanId = newPlanDoc._id;
    const monthlyPrice = 0; // manual updates by superadmin are rewarded, so count as 0 revenue!

    const {
      SubscriptionModel,
      SubscriptionPaymentModel,
      SubscriptionStatus,
      SubscriptionPaymentProvider,
      SubscriptionPaymentStatus,
      BillingCycle
    } = await import('../subscriptions/subscriptions.model');

    let sub = await SubscriptionModel.findOne({ restaurantId: restaurant._id });
    if (!sub) {
      sub = await SubscriptionModel.create({
        restaurantId: restaurant._id,
        plan: newPlanDoc.name,
        planId: newPlanId,
        priceMonthly: 0, // Manual update counts as 0 MRR
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } else {
      sub.plan = newPlanDoc.name;
      sub.planId = newPlanId as any;
      sub.priceMonthly = 0; // Manual update counts as 0 MRR
      sub.status = SubscriptionStatus.ACTIVE;
      sub.currentPeriodStart = new Date();
      sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sub.save();
    }

    await SubscriptionPaymentModel.create({
      subscriptionId: sub._id,
      restaurantId: restaurant._id,
      planId: newPlanId,
      provider: SubscriptionPaymentProvider.MANUAL,
      status: SubscriptionPaymentStatus.COMPLETED,
      billingCycle: BillingCycle.MONTHLY,
      amount: monthlyPrice, // 0 for superadmin manual reward
      currency: 'INR',
      paidAt: new Date(),
      metadata: {
        updatedBy: 'Super Admin',
        reason: 'Plan changed by Super Admin',
        oldPlan,
        newPlan: newPlanDoc.name,
      },
    });
  } catch (err) {
    logger.error('Failed to update subscription on plan change', err);
  }

  if (restaurant.email) {
    const onCooldown = await isEmailOnCooldown(restaurant.email);
    if (!onCooldown) {
      void sendRestaurantPlanUpdatedEmail(
        restaurant.email,
        restaurant.ownerName || 'Owner',
        restaurant.name,
        oldPlan,
        newPlanDoc.name,
        isUpgrade
      );
    } else {
      logger.info(`Throttling plan update email to ${restaurant.email} due to 60s cooldown`);
    }
  }

  return restaurant.toObject();
}

// ── Reservation & Queue Analytics ──────────────────────────────────────────
import { ReservationModel } from '../reservations/reservations.model';
import { QueueEntryModel } from '../queue/queue.model';
import { ReservationStatus, QueueStatus } from '../../constants/statuses';

export async function getReservationQueueAnalytics() {
  // ── Summary counts ──────────────────────────────────────────────────────
  const [
    totalReservations,
    confirmedReservations,
    cancelledReservations,
    noShows,
    completedReservations,
    totalQueueEntries,
    seatedFromQueue,
    cancelledQueue,
    expiredQueue,
  ] = await Promise.all([
    ReservationModel.countDocuments().setOptions({ bypassTenant: true }),
    ReservationModel.countDocuments({ status: ReservationStatus.CONFIRMED }).setOptions({ bypassTenant: true }),
    ReservationModel.countDocuments({ status: ReservationStatus.CANCELLED }).setOptions({ bypassTenant: true }),
    ReservationModel.countDocuments({ status: ReservationStatus.NO_SHOW }).setOptions({ bypassTenant: true }),
    ReservationModel.countDocuments({ status: ReservationStatus.COMPLETED }).setOptions({ bypassTenant: true }),
    QueueEntryModel.countDocuments().setOptions({ bypassTenant: true }),
    QueueEntryModel.countDocuments({ status: QueueStatus.SEATED }).setOptions({ bypassTenant: true }),
    QueueEntryModel.countDocuments({ status: QueueStatus.CANCELLED }).setOptions({ bypassTenant: true }),
    QueueEntryModel.countDocuments({ status: QueueStatus.EXPIRED }).setOptions({ bypassTenant: true }),
  ]);

  // Average wait time from queue entries (etaMinutes)
  const avgWaitAgg = await QueueEntryModel.aggregate([
    { $group: { _id: null, avgWait: { $avg: '$etaMinutes' } } },
  ]).option({ bypassTenant: true });
  const avgWaitMinutes = avgWaitAgg.length > 0 ? Math.round((avgWaitAgg[0].avgWait || 0) * 10) / 10 : 0;

  const reservationSuccessRate = totalReservations > 0
    ? Math.round((completedReservations / totalReservations) * 1000) / 10
    : 0;

  const queueConversionRate = totalQueueEntries > 0
    ? Math.round((seatedFromQueue / totalQueueEntries) * 1000) / 10
    : 0;

  // ── Daily trends (last 7 days) ──────────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const reservationTrends = await ReservationModel.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).option({ bypassTenant: true });

  const queueTrends = await QueueEntryModel.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).option({ bypassTenant: true });

  // Merge trends into unified array
  const trendMap: Record<string, { reservations: number; queueEntries: number }> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trendMap[key] = { reservations: 0, queueEntries: 0 };
  }
  for (const r of reservationTrends) {
    if (trendMap[r._id]) trendMap[r._id].reservations = r.count;
  }
  for (const q of queueTrends) {
    if (trendMap[q._id]) trendMap[q._id].queueEntries = q.count;
  }
  const trends = Object.entries(trendMap).map(([date, vals]) => ({ date, ...vals }));

  // ── Peak hours (all-time, hourly distribution) ──────────────────────────
  const reservationPeakHours = await ReservationModel.aggregate([
    {
      $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).option({ bypassTenant: true });

  const queuePeakHours = await QueueEntryModel.aggregate([
    {
      $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).option({ bypassTenant: true });

  const peakHoursMap: Record<number, { reservations: number; queueEntries: number }> = {};
  for (let h = 0; h < 24; h++) {
    peakHoursMap[h] = { reservations: 0, queueEntries: 0 };
  }
  for (const r of reservationPeakHours) {
    peakHoursMap[r._id].reservations = r.count;
  }
  for (const q of queuePeakHours) {
    peakHoursMap[q._id].queueEntries = q.count;
  }
  const peakHours = Object.entries(peakHoursMap).map(([hour, vals]) => ({
    hour: Number(hour),
    ...vals,
  }));

  // ── Restaurant leaderboard ──────────────────────────────────────────────
  const reservationsByRestaurant = await ReservationModel.aggregate([
    {
      $group: {
        _id: '$restaurantId',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', ReservationStatus.COMPLETED] }, 1, 0] },
        },
      },
    },
  ]).option({ bypassTenant: true });

  const queueByRestaurant = await QueueEntryModel.aggregate([
    {
      $group: {
        _id: '$restaurantId',
        total: { $sum: 1 },
        seated: {
          $sum: { $cond: [{ $eq: ['$status', QueueStatus.SEATED] }, 1, 0] },
        },
        avgWait: { $avg: '$etaMinutes' },
      },
    },
  ]).option({ bypassTenant: true });

  // Get restaurant names
  const restaurantIds = [
    ...new Set([
      ...reservationsByRestaurant.map((r: any) => r._id?.toString()),
      ...queueByRestaurant.map((q: any) => q._id?.toString()),
    ]),
  ].filter(Boolean);

  const restaurants = await RestaurantModel.find({
    _id: { $in: restaurantIds },
  })
    .select('name')
    .setOptions({ bypassTenant: true })
    .lean();

  const restaurantNameMap: Record<string, string> = {};
  for (const r of restaurants) {
    restaurantNameMap[r._id.toString()] = r.name;
  }

  // Merge leaderboard data
  const leaderboardMap: Record<string, any> = {};
  for (const r of reservationsByRestaurant) {
    const id = r._id?.toString();
    if (!id) continue;
    leaderboardMap[id] = {
      restaurantId: id,
      restaurantName: restaurantNameMap[id] || 'Unknown',
      totalReservations: r.total,
      successRate: r.total > 0 ? Math.round((r.completed / r.total) * 1000) / 10 : 0,
      avgWaitMinutes: 0,
      totalQueueEntries: 0,
      queueConversionRate: 0,
    };
  }
  for (const q of queueByRestaurant) {
    const id = q._id?.toString();
    if (!id) continue;
    if (!leaderboardMap[id]) {
      leaderboardMap[id] = {
        restaurantId: id,
        restaurantName: restaurantNameMap[id] || 'Unknown',
        totalReservations: 0,
        successRate: 0,
        avgWaitMinutes: 0,
        totalQueueEntries: 0,
        queueConversionRate: 0,
      };
    }
    leaderboardMap[id].totalQueueEntries = q.total;
    leaderboardMap[id].avgWaitMinutes = Math.round((q.avgWait || 0) * 10) / 10;
    leaderboardMap[id].queueConversionRate = q.total > 0
      ? Math.round((q.seated / q.total) * 1000) / 10
      : 0;
  }

  const restaurantLeaderboard = Object.values(leaderboardMap)
    .sort((a: any, b: any) => b.totalReservations - a.totalReservations);

  return {
    summary: {
      totalReservations,
      confirmedReservations,
      cancelledReservations,
      noShows,
      completedReservations,
      totalQueueEntries,
      seatedFromQueue,
      cancelledQueue,
      expiredQueue,
      avgWaitMinutes,
      reservationSuccessRate,
      queueConversionRate,
    },
    trends,
    peakHours,
    restaurantLeaderboard,
  };
}

export async function getAnalyticsCharts() {
  const { OrderModel } = await import('../orders/orders.model');
  const { RestaurantModel } = await import('../restaurants/restaurants.model');

  // 1. Daily Orders Trend (Last 7 Days) for Bar Chart
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyOrdersAgg = await OrderModel.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        status: { $in: ['COMPLETED', 'SERVED'] },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$createdAt' },
        count: { $sum: 1 },
      },
    },
  ]).option({ bypassTenant: true });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyOrdersMap: Record<string, number> = {};
  
  // Initialize map with days in order of the past 7 days
  const chartDays: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const name = dayNames[d.getDay()];
    chartDays.push(name);
    dailyOrdersMap[name] = 0;
  }

  dailyOrdersAgg.forEach((item) => {
    const dayName = dayNames[item._id - 1];
    if (dayName && dailyOrdersMap[dayName] !== undefined) {
      dailyOrdersMap[dayName] = item.count;
    }
  });

  const maxOrders = Math.max(...Object.values(dailyOrdersMap));
  const targetCapacity = Math.max(50, Math.round(maxOrders * 1.5));

  const barSeries = chartDays.map((day) => ({
    period: day,
    load: dailyOrdersMap[day],
    capacity: targetCapacity,
  }));

  // 2. Subscription Plan Distribution for Pie Chart
  const planCounts = await RestaurantModel.aggregate([
    {
      $match: { isDeleted: { $ne: true } }
    },
    {
      $group: {
        _id: '$plan',
        count: { $sum: 1 },
      },
    },
  ]).option({ bypassTenant: true });

  const totalRestaurants = await RestaurantModel.countDocuments({ isDeleted: { $ne: true } }).setOptions({ bypassTenant: true });

  const planColors: Record<string, string> = {
    'Basic': '#3b82f6',
    'Standard': '#8b5cf6',
    'Premium': '#f97316',
    'Enterprise': '#10b981',
  };

  const planMap: Record<string, number> = {
    'Basic': 0,
    'Standard': 0,
    'Premium': 0,
    'Enterprise': 0,
  };

  planCounts.forEach((item) => {
    const name = item._id || 'Basic';
    planMap[name] = (planMap[name] || 0) + item.count;
  });

  const distributionSeries = Object.entries(planMap).map(([planName, count]) => {
    const percentage = totalRestaurants > 0 ? Math.round((count / totalRestaurants) * 100) : 0;
    return {
      division: planName,
      allocation: percentage,
      Hex: planColors[planName] || '#64748b',
    };
  });

  // 3. Feature Adoption Analytics
  const plans = await PlatformPlanModel.find().lean();
  const activeRestaurants = await RestaurantModel.find({ status: 'ACTIVE' }).lean();

  const featureAdoption = {
    reservations: 0,
    queues: 0,
    discounts: 0,
    analytics: 0,
    automation: 0,
  };

  if (activeRestaurants.length > 0) {
    let resCount = 0;
    let qCount = 0;
    let discCount = 0;
    let anaCount = 0;
    let autoCount = 0;

    activeRestaurants.forEach((r: any) => {
      const planDoc = plans.find((p: any) => p.name === r.plan || p._id.toString() === r.planId?.toString());
      if (planDoc) {
        if (planDoc.reservationAccess) resCount++;
        if (planDoc.queueAccess) qCount++;
        if (planDoc.dynamicDiscountEngine) discCount++;
        if (planDoc.advancedAnalytics) anaCount++;
        if (planDoc.smartAutomation) autoCount++;
      }
    });

    const totalActive = activeRestaurants.length;
    featureAdoption.reservations = Math.round((resCount / totalActive) * 100);
    featureAdoption.queues = Math.round((qCount / totalActive) * 100);
    featureAdoption.discounts = Math.round((discCount / totalActive) * 100);
    featureAdoption.analytics = Math.round((anaCount / totalActive) * 100);
    featureAdoption.automation = Math.round((autoCount / totalActive) * 100);
  }

  return {
    barSeries,
    distributionSeries,
    featureAdoption,
  };
}

export async function createSystemAlert(alertData: any) {
  const alert = await SystemAlertModel.create({
    ...alertData,
    timestamp: alertData.timestamp || new Date(),
    status: 'new',
  });
  
  try {
    const { socketService } = await import('../../sockets/socket.service');
    socketService.emitToSuperAdmin('system_alert_created', alert.toJSON());
  } catch (err) {
    // Ignore socket error if it fails
  }
  
  return alert;
}

export async function getPlatformAlerts(filter: any) {
  return SystemAlertModel.find(filter).sort({ timestamp: -1 }).lean();
}

export async function updatePlatformAlert(id: string, status: string) {
  const alert = await SystemAlertModel.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true }
  ).lean();
  if (!alert) {
    throw new AppError('Alert not found', 404, ErrorCode.NOT_FOUND);
  }
  return alert;
}

export async function deletePlatformAlert(id: string) {
  const alert = await SystemAlertModel.findByIdAndDelete(id).lean();
  if (!alert) {
    throw new AppError('Alert not found', 404, ErrorCode.NOT_FOUND);
  }
  return alert;
}

// ── Custom Commission & Automated Background Analyzers ──────────────────────────

export async function calculateEffectiveCommissionRate(restaurantId: string | mongoose.Types.ObjectId): Promise<number> {
  const restaurant = await RestaurantModel.findById(restaurantId).lean();
  if (restaurant && typeof restaurant.customCommissionRate === 'number' && restaurant.customCommissionRate >= 0) {
    return restaurant.customCommissionRate;
  }
  if (restaurant && (restaurant.subscriptionPlan_id || restaurant.plan)) {
    let planDoc = null;
    if (restaurant.subscriptionPlan_id) {
      planDoc = await PlatformPlanModel.findById(restaurant.subscriptionPlan_id).lean();
    }
    if (!planDoc && restaurant.plan) {
      planDoc = await PlatformPlanModel.findOne({ name: { $regex: new RegExp(`^${restaurant.plan}$`, 'i') } }).lean();
    }
    if (planDoc && typeof planDoc.commissionRate === 'number' && planDoc.commissionRate >= 0) {
      return planDoc.commissionRate;
    }
  }
  const settings = await getPlatformSettings();
  return settings.platformCommissionRate ?? 8;
}

export async function updateRestaurantCommissionRate(id: string, customCommissionRate: number): Promise<any> {
  const restaurant = await RestaurantModel.findByIdAndUpdate(
    id,
    { customCommissionRate },
    { new: true }
  ).lean();
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }
  return restaurant;
}

export async function detectSuddenActivityDrops(): Promise<void> {
  try {
    const OrderModel = mongoose.model('Order');
    const restaurants = await RestaurantModel.find({ isDeleted: { $ne: true } }).lean();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    for (const r of restaurants) {
      const pastWeekOrdersCount = await OrderModel.countDocuments({
        restaurantId: r._id,
        createdAt: { $gte: eightDaysAgo, $lt: oneDayAgo }
      });
      const avgDailyOrders = pastWeekOrdersCount / 7;
      
      const last24hOrdersCount = await OrderModel.countDocuments({
        restaurantId: r._id,
        createdAt: { $gte: oneDayAgo }
      });

      if (avgDailyOrders >= 5 && last24hOrdersCount < 0.3 * avgDailyOrders) {
        const dropPercent = Math.round((1 - last24hOrdersCount / avgDailyOrders) * 100);
        await SystemAlertModel.create({
          title: `Sudden Activity Drop detected for ${r.name}`,
          type: 'SUDDEN_ACTIVITY_DROP',
          severity: 'HIGH',
          restaurantName: r.name,
          details: `Order volume dropped by ${dropPercent}% in the last 24h compared to 7-day average.`,
        });
      }
    }
  } catch (err) {
    console.error('Failed to run detectSuddenActivityDrops detector', err);
  }
}

export async function checkUsageLimitsAndNotify(): Promise<void> {
  try {
    const { SubscriptionModel } = await import('../subscriptions/subscriptions.model');
    const activeSubs = await SubscriptionModel.find().lean();
    for (const sub of activeSubs) {
      const planDoc = sub.planId ? await PlatformPlanModel.findById(sub.planId).lean() : await PlatformPlanModel.findOne({ name: sub.plan }).lean();
      const limit = planDoc?.monthlyOrderLimit || planDoc?.tenantLimit || 1000;
      const currentUsage = sub.monthlyOrderCount || sub.usageCount || 0;
      const rest = await RestaurantModel.findById(sub.restaurantId).lean();

      if (currentUsage >= limit) {
        await SystemAlertModel.create({
          title: `Plan Limit Exceeded for ${rest?.name || 'Restaurant'}`,
          type: 'LIMIT_BREACH',
          severity: 'CRITICAL',
          restaurantName: rest?.name || 'Restaurant',
          details: `Monthly limit of ${limit} orders exceeded (Current: ${currentUsage}).`,
        });
      } else if (currentUsage >= 0.8 * limit) {
        await SystemAlertModel.create({
          title: `80% Plan Usage Warning for ${rest?.name || 'Restaurant'}`,
          type: 'LIMIT_WARNING',
          severity: 'MEDIUM',
          restaurantName: rest?.name || 'Restaurant',
          details: `Restaurant has reached 80% of monthly order limit (${currentUsage}/${limit}).`,
        });
      }
    }
  } catch (err) {
    console.error('Failed to run checkUsageLimitsAndNotify scanner', err);
  }
}

export async function createRestaurant(input: CreateRestaurantInput) {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  // Check if slug is already used
  const existingRestaurant = await RestaurantModel.findOne({ slug });
  if (existingRestaurant) {
    throw new AppError('A restaurant with this name or slug already exists', 409, ErrorCode.CONFLICT);
  }

  const existingUser = await UserModel.findOne({ email: input.email });
  if (existingUser) {
    throw new AppError('A user with this email already exists', 409, ErrorCode.CONFLICT);
  }

  const restaurantId = new mongoose.Types.ObjectId();
  const tenantId = restaurantId.toString();

  // Map plan to backend formats
  let backendPlan = 'STARTER';
  if (input.plan === 'Standard') backendPlan = 'PRO';
  if (input.plan === 'Premium') backendPlan = 'PREMIUM';
  if (input.plan === 'Free') backendPlan = 'FREE';

  // Map status to backend formats
  let backendStatus = RestaurantStatus.PENDING_APPROVAL;
  if (input.status === 'Active') backendStatus = RestaurantStatus.ACTIVE;
  if (input.status === 'Inactive') backendStatus = RestaurantStatus.SUSPENDED;

  // Create Restaurant
  const [restaurant] = await RestaurantModel.create([{
    _id: restaurantId,
    slug,
    name: input.name,
    ownerName: input.owner,
    email: input.email,
    phone: input.phone,
    cuisine: 'Multi-Cuisine',
    city: input.location,
    state: 'Maharashtra',
    country: 'India',
    pinCode: '400001',
    plan: backendPlan,
    status: backendStatus,
    branches: input.branches || 1,
    expectedMonthlyOrders: 0,
    latitude: 0,
    longitude: 0,
  }]);

  // Create Admin User
  const bcrypt = await import('bcryptjs');
  const tempPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const [adminUser] = await UserModel.create([{
    name: input.owner,
    email: input.email,
    password: hashedPassword,
    role: 'restaurant-admin',
    status: 'ACTIVE',
    restaurantId: restaurantId,
    tenantId: tenantId,
    isEmailVerified: true,
    isMobileVerified: true,
    mustResetPassword: true,
    firstLogin: true,
    mustChangePassword: true,
  }]);

  restaurant.adminUserId = adminUser._id as any;
  await restaurant.save();

  return {
    id: restaurant._id,
    name: restaurant.name,
    owner: restaurant.ownerName,
    email: restaurant.email,
    phone: restaurant.phone,
    location: restaurant.city,
    plan: input.plan,
    status: input.status,
    revenue: input.revenue,
    branches: restaurant.branches,
  };
}