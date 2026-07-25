import { Types } from 'mongoose';
import { OrderModel } from './orders.model';
import { Cart } from '../cart/cart.model';
import { PlaceOrderInput, AdminOrderCreateInput, AdminOrderUpdateInput, OrderStatus, PaymentStatus } from './orders.schema';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { Priority, SessionStatus, TableStatus } from '../../constants/statuses';
import { TableModel } from '../tables/tables.model';
import mongoose from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../constants/roles';
import { NotificationCategory, NotificationPriority } from '../notifications/notifications.schema';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { socketService } from '../../sockets/socket.service';
import { SocketEvent } from '../../constants/events';
import { creditPoints } from '../loyalty/loyalty.service';
import { InventoryService } from '../inventory/inventory.service';
import { assertPlanLimit, recordSubscriptionUsage } from '../subscriptions/subscriptionEnforcement.service';

const ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.COMPLETED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.DELAYED, OrderStatus.CANCELLED, OrderStatus.COMPLETED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.DELAYED, OrderStatus.COMPLETED],
  [OrderStatus.DELAYED]: [OrderStatus.READY, OrderStatus.PREPARING, OrderStatus.COMPLETED],
  [OrderStatus.READY]: [OrderStatus.PICKED, OrderStatus.SERVED, OrderStatus.COMPLETED],
  [OrderStatus.PICKED]: [OrderStatus.SERVED, OrderStatus.COMPLETED],
  [OrderStatus.SERVED]: [OrderStatus.BILLED, OrderStatus.COMPLETED],
  [OrderStatus.BILLED]: [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.COMPLETED],
  [OrderStatus.PAID]: [OrderStatus.COMPLETED, OrderStatus.CONFIRMED],
};

function ensureOrderTransition(currentStatus: OrderStatus, nextStatus: OrderStatus, message: string): void {
  const allowed = ORDER_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(message, 400, ErrorCode.ORDER_NOT_MODIFIABLE);
  }
}

function toNullableObjectId(value?: string | Types.ObjectId | null): Types.ObjectId | null {
  if (!value) {
    return null;
  }

  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function enforceOrderLimits(restaurantId: string | Types.ObjectId) {
  const now = new Date();
  const [dailyOrders, monthlyOrders] = await Promise.all([
    OrderModel.countDocuments({ restaurantId, createdAt: { $gte: startOfDay(now) } }),
    OrderModel.countDocuments({ restaurantId, createdAt: { $gte: startOfMonth(now) } }),
  ]);

  await assertPlanLimit(restaurantId, 'dailyOrderLimit', dailyOrders + 1, 'daily orders');
  await assertPlanLimit(restaurantId, 'monthlyOrderLimit', monthlyOrders + 1, 'monthly orders');

  return { dailyOrderCount: dailyOrders + 1, monthlyOrderCount: monthlyOrders + 1 };
}
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function normalizeAdminOrderStatusFilter(status?: string): string | string[] | undefined {
  if (!status) return undefined;
  switch (status.toUpperCase()) {
    case OrderStatus.PENDING:
      return OrderStatus.PENDING;
    case OrderStatus.CONFIRMED:
      return OrderStatus.CONFIRMED;
    case OrderStatus.PREPARING:
      return [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.DELAYED,
        OrderStatus.READY,
      ];
    case OrderStatus.DELAYED:
      return OrderStatus.DELAYED;
    case OrderStatus.READY:
      return OrderStatus.READY;
    case OrderStatus.PICKED:
      return OrderStatus.PICKED;
    case OrderStatus.SERVED:
      return OrderStatus.SERVED;
    case OrderStatus.BILLED:
      return OrderStatus.BILLED;
    case OrderStatus.PAID:
      return OrderStatus.PAID;
    case OrderStatus.COMPLETED:
      return [
        OrderStatus.BILLED,
        OrderStatus.PAID,
        OrderStatus.COMPLETED,
      ];
    case OrderStatus.CANCELLED:
      return [OrderStatus.CANCELLED, OrderStatus.REJECTED];
    case OrderStatus.REJECTED:
      return OrderStatus.REJECTED;
    default:
      return undefined;
  }
}

export interface DynamicEtaContext {
  items: any[]; // Order items
  kitchenLoadMultiplier: number;
  batchMultiplier?: number;
  manualOverride?: number;
}

export class OrdersService {
  /**
   * Calculates the dynamic ETA based on context inputs.
   */
  private static calculateDynamicETA(context: DynamicEtaContext): number {
    if (context.manualOverride) {
      return context.manualOverride;
    }

    let maxPrepTime = 0;
    let maxComplexity = 1;

    for (const item of context.items) {
      const prepTime = item.preparationTime || 15;
      const complexity = item.preparationComplexity || 1;

      if (prepTime > maxPrepTime) maxPrepTime = prepTime;
      if (complexity > maxComplexity) maxComplexity = complexity;
    }

    const loadMultiplier = context.kitchenLoadMultiplier || 1.0;
    const batchMultiplier = context.batchMultiplier || 1.0;
    const complexityFactor = 1 + (maxComplexity * 0.1); // e.g. complexity 5 = 1.5x

    const eta = Math.ceil(maxPrepTime * complexityFactor * loadMultiplier * batchMultiplier);
    
    // Ensure a minimum ETA of 5 minutes just in case
    return Math.max(eta, 5);
  }

  /**
   * Helper method to map cart items to the structure required by OrderModel.
   * Resolves ingredients from MenuItem references.
   */
  private static async mapCartItemsToOrderItems(
    restaurantId: string | Types.ObjectId,
    cartItems: any[],
    session?: mongoose.ClientSession | null
  ) {
    const menuItemIds = cartItems.map((i: any) => i.menuItem);
    const menuItems = await mongoose.model('MenuItem').find({
      _id: { $in: menuItemIds },
      restaurantId: typeof restaurantId === 'string' ? new mongoose.Types.ObjectId(restaurantId) : restaurantId
    }).populate('ingredients.inventoryItemId').session(session ? session : null as any);

    const menuItemMap = new Map(menuItems.map(m => [m._id.toString(), m]));

    return cartItems.map((item: any) => {
      const menuItemIdStr = item.menuItem.toString();
      const fullMenuItem = menuItemMap.get(menuItemIdStr);
      if (!fullMenuItem) {
        throw new AppError('Invalid menu item in cart', 400, ErrorCode.VALIDATION_ERROR);
      }
      const ingredientsSnapshot = fullMenuItem.ingredients ? fullMenuItem.ingredients.map((ing: any) => ({
        inventoryItemId: ing.inventoryItemId && ing.inventoryItemId._id ? ing.inventoryItemId._id : ing.inventoryItemId,
        inventoryItemName: (ing.inventoryItemId && ing.inventoryItemId.name) || 'Unknown Item',
        quantity: ing.quantity
      })) : [];

      return {
        menuItemId: fullMenuItem._id,
        name: fullMenuItem.name,
        quantity: item.quantity,
        price: item.unitPrice,
        totalPrice: item.subtotal,
        preparationTime: fullMenuItem.preparationTime || 15,
        preparationComplexity: fullMenuItem.preparationComplexity || 1,
        notes: item.notes || '',
        ingredients: ingredientsSnapshot,
      };
    });
  }

  /**
   * Reusable order creation logic extracted from PaymentsService.
   * Supports both Pre-Paid and Post-Paid workflows by accepting paymentStatus.
   */
  public static async createOrder(
    restaurantId: string | Types.ObjectId,
    sessionId: string | Types.ObjectId,
    paymentStatus: PaymentStatus | 'PAID' | 'UNPAID',
    session?: mongoose.ClientSession | null,
    specialInstructions: string = ''
  ) {
    const options = session ? { session } : undefined;
    const restId = typeof restaurantId === 'string' ? new mongoose.Types.ObjectId(restaurantId) : restaurantId;
    const sessId = typeof sessionId === 'string' ? new mongoose.Types.ObjectId(sessionId) : sessionId;

    // 1. Fetch Cart
    const cart = await Cart.findOne({
      restaurantId: restId,
      sessionId: sessId
    }).session(session ? session : null as any);

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError('Cart empty or not found during order creation', 400, ErrorCode.VALIDATION_ERROR);
    }

    // 2. Map Items & Resolve Ingredients
    const orderItems = await this.mapCartItemsToOrderItems(restId, cart.items, session);

    // 3. Generate Order Number
    const timestamp = Date.now().toString().slice(-6);
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${randomChars}`;

    // 4. Fetch Table Session
    const sessionDoc = await TableSessionModel.findById(sessId).session(session ? session : null as any);
    if (!sessionDoc) {
      throw new AppError('Table session not found', 404, ErrorCode.NOT_FOUND);
    }

    // 5. Create Order — include customer name from the session
    // 5. Calculate Dynamic ETA
    // IMPORTANT: Do NOT run countDocuments inside the transaction to avoid WriteConflicts and high latency
    const activeOrdersCount = await OrderModel.countDocuments({
      restaurantId: restId,
      status: { $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.DELAYED] }
    });

    let kitchenLoadMultiplier = 1.0;
    if (activeOrdersCount >= 20) kitchenLoadMultiplier = 1.5;
    else if (activeOrdersCount >= 10) kitchenLoadMultiplier = 1.2;

    const estimatedPreparationTime = this.calculateDynamicETA({
      items: orderItems,
      kitchenLoadMultiplier
    });

    // 6. Create Order
    const order = await OrderModel.create([{
      restaurantId: restId,
      tableId: sessionDoc.tableId,
      sessionId: sessId,
      orderNumber,
      customerName: sessionDoc.customerName || 'Guest',
      items: orderItems,
      totalAmount: cart.subtotal,
      taxAmount: cart.tax,
      discountAmount: cart.discount,
      finalAmount: cart.grandTotal,
      status: OrderStatus.PENDING,
      paymentStatus,
      priority: 'NORMAL',
      specialInstructions,
      estimatedPreparationTime,
    }], options);

    const createdOrder = order[0];

    // 6. Transition table status to ORDERING if it is OCCUPIED
    const table = await TableModel.findById(createdOrder.tableId).session(session ? session : null as any);
    if (table && table.status === TableStatus.OCCUPIED) {
      table.status = TableStatus.ORDERING;
      await table.save(options);
    }

    // 7. Clear cart
    cart.items = [] as any;
    cart.subtotal = 0;
    cart.tax = 0;
    cart.discount = 0;
    cart.grandTotal = 0;
    await cart.save(options);

    return createdOrder;
  }

  static async getAdminOrders(
    restaurantId: string | Types.ObjectId,
    options: {
      status?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      table?: string;
      dateRange?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Number(options.page ?? 1);
    const limit = Number(options.limit ?? 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      restaurantId,
    };

    if (options.status) {
      const statusFilter = normalizeAdminOrderStatusFilter(options.status);
      if (Array.isArray(statusFilter)) {
        query.status = { $in: statusFilter };
      } else if (statusFilter) {
        query.status = statusFilter;
      }
    }

    if (options.paymentStatus) {
      query.paymentStatus = options.paymentStatus;
    }

    if (options.paymentMethod) {
      query.paymentMethod = options.paymentMethod;
    }

    if (options.table) {
      const tableRegex = new RegExp(`^${escapeRegex(options.table)}`, 'i');
      const tableIds = await TableModel.find({
        restaurantId,
        tableNumber: tableRegex,
      }).distinct('_id');

      query.tableId = tableIds.length > 0 ? { $in: tableIds } : new mongoose.Types.ObjectId();
    }

    // Date range filtering (today, yesterday, last7, last30)
    if (options.dateRange) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let start: Date | null = null;
      let end: Date | null = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

      switch ((options.dateRange || '').toLowerCase()) {
        case 'today':
          start = startOfToday;
          break;
        case 'yesterday':
          start = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
          end = startOfToday;
          break;
        case 'last7':
          start = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
          break;
        case 'last30':
          start = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = null;
      }

      if (start && end) {
        query.createdAt = { $gte: start, $lt: end };
      } else if (start) {
        query.createdAt = { $gte: start };
      }
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .populate('tableId', 'tableNumber')
        .populate('serviceStaffId', 'name')
        .populate('kitchenStaffId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OrderModel.countDocuments(query),
    ]);

    // Backfill customerName from the table session for orders where it is
    // missing (legacy data that predates the customerName field).  This is a
    // one-shot bulk lookup — only sessions whose orders lack a name are read.
    const emptyNameOrders = orders.filter((o) => !o.customerName);
    if (emptyNameOrders.length > 0) {
      const sessionIds = emptyNameOrders
        .map((o) => o.sessionId)
        .filter((id): id is mongoose.Types.ObjectId => !!id);
      if (sessionIds.length > 0) {
        const sessions = await TableSessionModel.find(
          { _id: { $in: sessionIds } },
          { customerName: 1 },
        ).lean();
        const nameBySession = new Map(
          sessions.map((s) => [s._id.toString(), s.customerName]),
        );
        for (const order of orders) {
          if (!order.customerName && order.sessionId) {
            const name = nameBySession.get(order.sessionId.toString());
            if (name) order.customerName = name;
          }
        }
      }
    }

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  static async getAdminOrderById(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
  ) {
    const order = await OrderModel.findOne({ _id: orderId, restaurantId })
      .populate('tableId', 'tableNumber')
      .populate('serviceStaffId', 'name')
      .populate('kitchenStaffId', 'name');
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }

    // Backfill customerName from the table session if missing (legacy data)
    if (!order.customerName && order.sessionId) {
      const session = await TableSessionModel.findById(order.sessionId, { customerName: 1 }).lean();
      if (session?.customerName) {
        order.customerName = session.customerName;
      }
    }

    return order;
  }

  static async createAdminOrder(
    restaurantId: string | Types.ObjectId,
    payload: AdminOrderCreateInput,
    _actorId?: string | Types.ObjectId | null,
  ) {
    const table = await TableModel.findOne({ restaurantId, tableNumber: payload.table });
    if (!table) {
      throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
    }

    const orderItems = payload.items.map((item) => ({
      menuItemId: item.menuItemId
        ? new mongoose.Types.ObjectId(item.menuItemId)
        : new mongoose.Types.ObjectId(),
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.quantity * item.price,
      notes: item.notes || '',
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order = await OrderModel.create({
      restaurantId,
      customerName: payload.customerName,
      tableId: table._id,
      orderNumber,
      items: orderItems,
      totalAmount,
      taxAmount: 0,
      discountAmount: 0,
      finalAmount: totalAmount,
      status: OrderStatus.PENDING,
      paymentStatus: payload.paymentStatus ?? (payload.paymentMethod ? PaymentStatus.PAID : PaymentStatus.PENDING),
      paymentMethod: payload.paymentMethod ?? null,
      priority: Priority.NORMAL,
      specialInstructions: payload.specialInstructions || '',
      serviceStaffId:
        payload.assignedStaff && mongoose.Types.ObjectId.isValid(payload.assignedStaff)
          ? new mongoose.Types.ObjectId(payload.assignedStaff)
          : null,
    });

    await order.populate([
      { path: 'tableId', select: 'tableNumber' },
      { path: 'serviceStaffId', select: 'name' },
      { path: 'kitchenStaffId', select: 'name' },
    ]);

    return order;
  }

  static async updateAdminOrder(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    updates: AdminOrderUpdateInput,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await OrderModel.findOne({ _id: orderId, restaurantId });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }

    if (updates.table !== undefined) {
      const table = await TableModel.findOne({ restaurantId, tableNumber: updates.table });
      if (!table) {
        throw new AppError('Table not found', 404, ErrorCode.NOT_FOUND);
      }
      order.tableId = table._id;
    }

    if (updates.paymentStatus !== undefined) {
      order.paymentStatus = updates.paymentStatus;
      // An unpaid order cannot carry a payment method.
      if (updates.paymentStatus !== PaymentStatus.PAID) {
        order.paymentMethod = null;
      }
    }

    if (updates.paymentMethod !== undefined) {
      order.paymentMethod = updates.paymentMethod;
    }

    if (updates.specialInstructions !== undefined) {
      order.specialInstructions = updates.specialInstructions;
    }

    if (updates.status !== undefined) {
      if (!updates.adminOverride) {
        ensureOrderTransition(order.status as OrderStatus, updates.status, 'Order cannot be updated to requested status');
      }
      order.status = updates.status;

      if (updates.status === OrderStatus.CANCELLED) {
        order.cancelledAt = new Date();
        if (order.stockDeducted) {
          await InventoryService.restoreStock(restaurantId, order.items, order._id, actorId || undefined);
          order.stockDeducted = false;
        }
      }

      if (updates.status === OrderStatus.COMPLETED) {
        order.completedAt = new Date();
      }
    }

    await order.save();
    return order;
  }

  static async deleteAdminOrder(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
  ) {
    const order = await OrderModel.findOne({ _id: orderId, restaurantId });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }

    // Restore any inventory that was deducted when the order was started.
    if (order.stockDeducted) {
      await InventoryService.restoreStock(restaurantId, order.items, order._id, undefined);
    }

    await OrderModel.deleteOne({ _id: order._id });

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, {
      orderId: order._id,
      status: 'DELETED',
    });

    return { deleted: true, orderId: order._id };
  }

  static async placeOrder(
    restaurantId: string | Types.ObjectId,
    sessionId: string | Types.ObjectId,
    tableId: string | Types.ObjectId,
    _customerName: string | undefined,
    data: PlaceOrderInput
  ) {
    const orderUsage = await enforceOrderLimits(restaurantId);
    const sessionObjectId = typeof sessionId === 'string' ? new mongoose.Types.ObjectId(sessionId) : sessionId;

    // 1. Acquire atomic order lock on session
    const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
    const lockedSession = await TableSessionModel.findOneAndUpdate(
      {
        _id: sessionObjectId,
        status: SessionStatus.ACTIVE,
        $or: [
          { isOrdering: false },
          { isOrdering: { $exists: false } },
          { isOrdering: true, lastOrderAttemptAt: { $lt: fifteenSecondsAgo } },
        ],
      },
      {
        $set: {
          isOrdering: true,
          lastOrderAttemptAt: new Date(),
        },
      },
      { new: true }
    );

    if (!lockedSession) {
      throw new AppError(
        'Parallel order creation in progress. Please wait.',
        409,
        ErrorCode.DUPLICATE_ORDER_ATTEMPT
      );
    }

    let dbSession: mongoose.ClientSession | null = null;
    try {
      dbSession = await mongoose.startSession();
      dbSession.startTransaction();
    } catch (e) {
      dbSession = null;
    }

    let order: any;

    try {
      // PHASE A: Database Operations
      order = await OrdersService.createOrder(
        restaurantId,
        sessionId,
        PaymentStatus.PENDING,
        dbSession,
        data.specialInstructions
      );

      await Promise.all([
        recordSubscriptionUsage(restaurantId, 'dailyOrderCount', orderUsage.dailyOrderCount),
        recordSubscriptionUsage(restaurantId, 'monthlyOrderCount', orderUsage.monthlyOrderCount),
      ]);

      if (dbSession && dbSession.inTransaction()) {
        await dbSession.commitTransaction();
      }

      // 7. Emit Realtime Event for Kitchen
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_NEW, { orderId: order._id });

      // 8. Notify admin about new order
      const orderTotal = order.finalAmount ?? order.totalAmount ?? 0;
      const largeOrderThreshold = 5000; // configurable threshold for large-value order
      const isLargeValue = orderTotal >= largeOrderThreshold;

      if (isLargeValue) {
        NotificationsService.createNotification({
          restaurantId,
          recipientRole: UserRole.RESTAURANT_ADMIN,
          title: 'Large Value Order',
          message: `Order #${order.orderNumber} placed for ₹${orderTotal.toFixed(2)}.`,
          type: 'ORDER_LARGE_VALUE',
          entityId: order._id.toString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }).catch(() => {});
      } else {
        NotificationsService.createNotification({
          restaurantId,
          recipientRole: UserRole.RESTAURANT_ADMIN,
          title: 'New Order Placed',
          message: `Order #${order.orderNumber} has been placed for table. Total: ₹${orderTotal.toFixed(2)}.`,
          type: 'ORDER_NEW',
          entityId: order._id.toString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }).catch(() => {});
      }

      return order;
    } catch (error) {
      if (dbSession && dbSession.inTransaction()) {
        try {
          await dbSession.abortTransaction();
        } catch (abortErr) {
          console.error('Failed to abort transaction:', abortErr);
        }
      }
      throw error;
    } finally {
      if (dbSession) {
        dbSession.endSession();
      }
      // 8. Always release the lock
      await TableSessionModel.findByIdAndUpdate(sessionObjectId, {
        $set: { isOrdering: false },
      });
    }

    // PHASE B: Post-Transaction Side Effects
    try {
      // 7. Emit Realtime Event for Kitchen
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_NEW, { order });
    } catch (sideEffectError) {
      console.error('Failed to emit SocketEvent.ORDER_NEW', sideEffectError);
    }

    try {
      await NotificationsService.createNotification({
        restaurantId,
        title: 'New Order Received',
        message: `Order #${order.orderNumber} has been placed.`,
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.HIGH,
        recipientRole: UserRole.KITCHEN_STAFF,
        type: 'NEW_ORDER',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
        metadata: { orderId: order._id, link: `/kitchen/orders?orderId=${order._id}` },
      });
    } catch (sideEffectError) {
      console.error('Failed to create notification', sideEffectError);
    }

    return order;
  }

  static async getCustomerOrders(
    restaurantId: string | Types.ObjectId,
    sessionId: string | Types.ObjectId,
    options: { status?: string; page?: number; limit?: number } = {},
  ) {
    const page = Number(options.page ?? 1);
    const limit = Number(options.limit ?? 10);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { restaurantId, sessionId };
    if (options.status) {
      query.status = options.status;
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      OrderModel.countDocuments(query),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  static async getCustomerOrderById(
    restaurantId: string | Types.ObjectId,
    sessionId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
  ) {
    const order = await OrderModel.findOne({ _id: orderId, restaurantId, sessionId });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }

    return order;
  }

  static async reorder(
    restaurantId: string | Types.ObjectId,
    sessionId: string | Types.ObjectId,
    tableId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
  ) {
    const original = await this.getCustomerOrderById(restaurantId, sessionId, orderId);

    if (original.status === OrderStatus.CANCELLED || original.status === OrderStatus.REJECTED) {
      throw new AppError('Cancelled or rejected orders cannot be reordered', 400, ErrorCode.ORDER_NOT_MODIFIABLE);
    }

    const timestamp = Date.now().toString().slice(-6);
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${randomChars}`;
    const orderUsage = await enforceOrderLimits(restaurantId);

    // Fetch session to get current customer name
    const sessionDoc = await TableSessionModel.findById(sessionId);
    const customerName = sessionDoc?.customerName || original.customerName || 'Guest';

    const order = await OrderModel.create({
      restaurantId,
      tableId,
      sessionId,
      orderNumber,
      customerName,
      items: original.items,
      totalAmount: original.totalAmount,
      taxAmount: original.taxAmount,
      discountAmount: original.discountAmount,
      finalAmount: original.finalAmount,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      priority: original.priority ?? Priority.NORMAL,
      specialInstructions: original.specialInstructions,
    });

    await Promise.all([
      recordSubscriptionUsage(restaurantId, 'dailyOrderCount', orderUsage.dailyOrderCount),
      recordSubscriptionUsage(restaurantId, 'monthlyOrderCount', orderUsage.monthlyOrderCount),
    ]);

    const table = await TableModel.findById(tableId);
    if (table && table.status === TableStatus.OCCUPIED) {
      table.status = TableStatus.ORDERING;
      await table.save();
    }

    return order;
  }

  static async cancelOrder(
    restaurantId: string | Types.ObjectId,
    sessionId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
  ) {
    const order = await this.getCustomerOrderById(restaurantId, sessionId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.CANCELLED, 'Order cannot be cancelled in its current state');

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();

    if (order.stockDeducted) {
      await InventoryService.restoreStock(restaurantId, order.items);
      order.stockDeducted = false;
    }

    await order.save();

    if (order.tableId) {
      await TableModel.findByIdAndUpdate(order.tableId, {
        status: TableStatus.AVAILABLE,
        currentSessionId: null,
        occupiedAt: null,
        currentBill: 0,
      }).catch(() => {});

      socketService.emitToRestaurant(restaurantId.toString(), 'table.updated', {
        tableId: order.tableId,
        status: TableStatus.AVAILABLE,
      });
    }

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(sessionId.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(sessionId.toString(), 'order.cancelled', { order });

    // Notify admin about cancelled order
    NotificationsService.createNotification({
      restaurantId,
      recipientRole: UserRole.RESTAURANT_ADMIN,
      title: 'Order Cancelled',
      message: `Order #${order.orderNumber} has been cancelled by the customer.`,
      type: 'ORDER_CANCELLED',
      entityId: order._id.toString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).catch(() => {});

    return order;
  }

  static async cancelStaffOrder(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    cancelledByStaffId?: string,
  ) {
    const order = await OrderModel.findOne({
      _id: orderId,
      restaurantId,
    });
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();

    if (order.stockDeducted) {
      await InventoryService.restoreStock(restaurantId, order.items).catch(() => {});
      order.stockDeducted = false;
    }

    await order.save();

    if (order.tableId) {
      await TableModel.findByIdAndUpdate(order.tableId, {
        status: TableStatus.AVAILABLE,
        currentSessionId: null,
        occupiedAt: null,
        currentBill: 0,
      }).catch(() => {});

      socketService.emitToRestaurant(restaurantId.toString(), 'table.updated', {
        tableId: order.tableId,
        status: TableStatus.AVAILABLE,
      });
    }

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    if (order.sessionId) {
      socketService.emitToSession(order.sessionId.toString(), 'order.updated', { orderId: order._id, status: order.status });
      socketService.emitToSession(order.sessionId.toString(), 'order.cancelled', { order });
    }

    return order;
  }

  // --- Kitchen Order APIs ---

  static async getKitchenOrders(
    restaurantId: string | Types.ObjectId,
    options: {
      status?: string;
      priority?: string;
      table?: string;
      batch?: boolean;
    } = {}
  ) {
    const matchQuery: Record<string, unknown> = {
      restaurantId: typeof restaurantId === 'string' ? new mongoose.Types.ObjectId(restaurantId) : restaurantId,
      status: options.status
        ? options.status
        : {
            $in: [
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.DELAYED,
              OrderStatus.READY,
            ],
          },
    };

    if (options.priority) {
      matchQuery.priority = options.priority;
    }

    if (options.batch) {
      matchQuery.batchId = { $ne: null };
    }

    if (options.table) {
      if (Types.ObjectId.isValid(options.table)) {
        matchQuery.tableId = new Types.ObjectId(options.table);
      } else {
        const tableIds = await TableModel.find({
          restaurantId,
          tableNumber: options.table,
        }).distinct('_id');
        matchQuery.tableId = tableIds.length > 0 ? { $in: tableIds } : null;
      }
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $addFields: {
          priorityWeight: {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'URGENT'] }, then: 4 },
                { case: { $eq: ['$priority', 'HIGH'] }, then: 3 },
                { case: { $eq: ['$priority', 'NORMAL'] }, then: 2 },
                { case: { $eq: ['$priority', 'LOW'] }, then: 1 }
              ],
              default: 2
            }
          },
          orderComplexity: { 
            $ifNull: [
              { $max: '$items.preparationComplexity' }, 
              1 
            ] 
          }
        }
      },
      {
        $sort: {
          priorityWeight: -1,
          orderComplexity: -1,
          createdAt: 1
        }
      }
    ];

    const aggregatedOrders = await OrderModel.aggregate(pipeline as any);
    
    // Convert back to Mongoose documents and populate tableId
    const orders = aggregatedOrders.map(doc => OrderModel.hydrate(doc));
    return OrderModel.populate(orders, { path: 'tableId' });
  }

  static async getKitchenOrderDetails(restaurantId: string | Types.ObjectId, orderId: string | Types.ObjectId) {
    let order = null;
    if (Types.ObjectId.isValid(orderId)) {
      order = await OrderModel.findOne({ _id: orderId, restaurantId }).populate('items.menuItemId');
    }
    if (!order) {
      order = await OrderModel.findOne({ orderNumber: orderId, restaurantId }).populate('items.menuItemId');
    }
    if (!order) {
      throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
    }
    return order;
  }

  static async acceptOrder(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    estimatedTime?: number,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.CONFIRMED, 'Only pending orders can be accepted');

    order.status = OrderStatus.CONFIRMED;
    order.acceptedAt = new Date();
    order.kitchenStaffId = toNullableObjectId(actorId);
    if (estimatedTime) {
      order.estimatedPreparationTime = estimatedTime;
    }

    await order.save();

    // Trigger persistent notification targeting CUSTOMER
    await NotificationsService.createNotification({
      restaurantId: order.restaurantId,
      tableSessionId: order.sessionId,
      recipientRole: UserRole.CUSTOMER,
      title: 'Order Confirmed',
      message: `Your order ${order.orderNumber} has been confirmed.`,
      type: 'ORDER_CONFIRMED',
      category: NotificationCategory.SYSTEM,
      priority: NotificationPriority.NORMAL,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.accepted', { order });

    return order;
  }

  static async startCooking(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.PREPARING, 'Order cannot be prepared from current status');

    order.status = OrderStatus.PREPARING;
    order.preparingStartedAt = new Date();
    order.kitchenStaffId = toNullableObjectId(actorId);

    if (!order.stockDeducted) {
      await InventoryService.deductStock(restaurantId, order.items, order._id, actorId || undefined);
      order.stockDeducted = true;
    }

    await order.save();

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.preparing', { order });

    return order;
  }

  static async markReady(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.READY, 'Only preparing orders can be marked ready');

    order.status = OrderStatus.READY;
    order.readyAt = new Date();
    order.kitchenStaffId = toNullableObjectId(actorId);
    await order.save();

    // Trigger persistent notification targeting SERVICE_STAFF
    await NotificationsService.createNotification({
      restaurantId: order.restaurantId,
      tableSessionId: order.sessionId,
      recipientRole: UserRole.SERVICE_STAFF,
      title: 'Order Ready for Pickup',
      message: `Order ${order.orderNumber} is ready to be served.`,
      type: 'ORDER_READY',
      category: NotificationCategory.STAFF,
      priority: NotificationPriority.HIGH,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.ready', { order });
    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_READY, { orderId: order._id });

    return order;
  }

  static async rejectOrder(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    reason: string,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.REJECTED, 'Only pending orders can be rejected');

    order.status = OrderStatus.REJECTED;
    order.cancelledAt = new Date();
    order.rejectedAt = new Date();
    order.kitchenStaffId = toNullableObjectId(actorId);
    order.rejectionReason = reason;

    if (order.stockDeducted) {
      await InventoryService.restoreStock(restaurantId, order.items, order._id, actorId || undefined);
      order.stockDeducted = false;
    }

    await order.save();

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.rejected', { order, reason });

    return order;
  }

  static async delayOrder(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    delayMinutes: number,
    reason: string = 'OTHER',
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.DELAYED, 'Cannot delay order in current status');

    order.status = OrderStatus.DELAYED;
    if (order.estimatedPreparationTime) {
      order.estimatedPreparationTime += delayMinutes;
    } else {
      order.estimatedPreparationTime = delayMinutes;
    }
    order.delayedAt = new Date();
    order.kitchenStaffId = toNullableObjectId(actorId);

    if (!order.delayHistory) {
      order.delayHistory = [];
    }
    order.delayHistory.push({
      delayMinutes,
      reason,
      actorId: toNullableObjectId(actorId),
      createdAt: new Date()
    });

    await order.save();

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });

    return order;
  }

  static async addInternalNote(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    content: string,
    actor: { id: string; name: string; role: string }
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    if (!order.internalNotes) {
      order.internalNotes = [];
    }

    order.internalNotes.push({
      authorId: new Types.ObjectId(actor.id),
      authorName: actor.name,
      role: actor.role,
      content,
      createdAt: new Date(),
    });

    await order.save();
    return order;
  }

  static async getReadyOrders(restaurantId: string | Types.ObjectId) {
    return OrderModel.find({ restaurantId, status: OrderStatus.READY }).populate('tableId').sort({ updatedAt: 1 });
  }

  static async pickFood(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.PICKED, 'Only ready orders can be picked');

    order.status = OrderStatus.PICKED;
    order.pickedAt = new Date();
    order.serviceStaffId = toNullableObjectId(actorId);
    await order.save();

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.serving', { order });

    return order;
  }

  static async markServed(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    // Only ready orders can transition to served (since PICKED is retired as a status)
    ensureOrderTransition(order.status as OrderStatus, OrderStatus.SERVED, 'Only ready orders can be served');

    order.status = OrderStatus.SERVED;
    order.servedAt = new Date();
    order.serviceStaffId = toNullableObjectId(actorId);
    await order.save();

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.served', { order });

    return order;
  }

  static async markCompleted(
    restaurantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId | null,
  ) {
    const order = await this.getKitchenOrderDetails(restaurantId, orderId);

    ensureOrderTransition(order.status as OrderStatus, OrderStatus.COMPLETED, 'Only paid orders can be completed');

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.serviceStaffId = toNullableObjectId(actorId);
    await order.save();
    await creditPoints(order);

    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.updated', { orderId: order._id, status: order.status });
    socketService.emitToSession(order.sessionId!.toString(), 'order.completed', { order });

    return order;
  }

  /**
   * Marks all unpaid/uncompleted orders in a session as PAID.
   * This is exclusively called by BillingService during settlement.
   * Modifies only the Orders domain. Does not emit sockets.
   */
  static async markOrdersPaid(
    sessionId: string | Types.ObjectId,
    dbSession?: mongoose.ClientSession,
    paymentMethod?: string | null,
  ) {
    const unpaidStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.DELAYED,
      OrderStatus.READY,
      OrderStatus.PICKED,
      OrderStatus.SERVED,
      OrderStatus.BILLED,
    ];

    const updatedOrders = await OrderModel.find(
      { sessionId, status: { $in: unpaidStatuses } },
      null,
      { session: dbSession }
    );

    if (updatedOrders.length > 0) {
      const setFields: Record<string, unknown> = { 
        paymentStatus: PaymentStatus.PAID,
      };
      if (paymentMethod) {
        setFields.paymentMethod = paymentMethod as import('./orders.schema').PaymentMethod;
      }

      // 1. Mark ALL unpaid orders as paymentStatus = PAID universally
      await OrderModel.updateMany(
        { sessionId, status: { $in: unpaidStatuses } },
        { $set: setFields },
        { session: dbSession }
      );

      // 2. Only advance the kitchen status to PAID if it was already BILLED.
      // This ensures kitchen workflows (PREPARING, READY, etc.) are strictly untouched.
      await OrderModel.updateMany(
        { sessionId, status: OrderStatus.BILLED },
        { 
          $set: { 
            status: OrderStatus.PAID,
          }
        },
        { session: dbSession }
      );
      
      // Update in-memory objects to return correctly
      updatedOrders.forEach(o => {
        o.paymentStatus = PaymentStatus.PAID;
        if (paymentMethod) {
          (o as any).paymentMethod = paymentMethod;
        }
        if (o.status === OrderStatus.BILLED) {
          o.status = OrderStatus.PAID;
        }
      });
    }

    return updatedOrders;
  }
}
