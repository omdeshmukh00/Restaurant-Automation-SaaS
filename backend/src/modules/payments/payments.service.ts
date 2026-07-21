import mongoose from 'mongoose';
import { ErrorCode } from '../../constants/errors';
import { PaymentStatus } from '../../constants/statuses';
import { AppError } from '../../utils/AppError';
import { BillingModel } from '../billing/billing.model';
import {
  PaymentMethod,
  PaymentStatus as BillingPaymentStatus,
} from '../billing/billing.schema';
import { BillingService } from '../billing/billing.service';
import { PaymentModel } from './payments.model';
import type { IPayment } from './payments.model'; // used for explicit document casting below
import type { ListPaymentsQuery, VerifyPaymentInput } from './payments.schema';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  createRazorpayRefund,
} from '../../services/razorpay.service';
import { env } from '../../config/env';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { TableModel } from '../tables/tables.model';
import { TableStatus } from '../../constants/statuses';
import { socketService } from '../../sockets/socket.service';
import { SocketEvent } from '../../constants/events';
import { logger } from '../../config/logger';

function toObjectId(value: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError('Invalid id', 400, ErrorCode.INVALID_REQUEST);
  }

  return new mongoose.Types.ObjectId(value);
}

function mapVerificationStatus(status?: VerifyPaymentInput['simulateStatus']): BillingPaymentStatus | undefined {
  if (!status) {
    return undefined;
  }

  if (status === 'COMPLETED' || status === 'PAID') {
    return undefined;
  }

  return status as BillingPaymentStatus;
}

function buildPaymentFilter(restaurantId: string, query: ListPaymentsQuery) {
  const filter: Record<string, unknown> = {
    restaurantId: toObjectId(restaurantId),
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.method) {
    filter.method = query.method;
  }

  if (query.sessionId) {
    filter.sessionId = toObjectId(query.sessionId);
  }

  if (query.orderId) {
    filter.orderId = toObjectId(query.orderId);
  }

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from && { $gte: query.from }),
      ...(query.to && { $lte: query.to }),
    };
  }

  return filter;
}

export class PaymentsService {
  static async createCustomerPayment(restaurantId: string, sessionId: string, method: PaymentMethod) {
    const { Cart } = await import('../cart/cart.model');
    const cart = await Cart.findOne({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId)
    });

    const isCashPayment = method === PaymentMethod.CASH;
    const isRazorpayEnabled = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

    let amount = 0;
    let isCartCheckout = false;

    if (cart && cart.items && cart.items.length > 0) {
      amount = cart.grandTotal;
      isCartCheckout = true;
    } else {
      // Fallback: cumulative bill for already placed orders
      const liveBill = await BillingService.getLiveBill(restaurantId, sessionId);
      amount = liveBill.finalAmount;
    }

    if (amount <= 0) {
      throw new AppError('Cannot create a payment for ₹0 or empty cart/bill', 400, ErrorCode.INVALID_REQUEST);
    }

    let razorpayOrderId: string | null = null;
    let providerPaymentId = `pay_mock_${restaurantId}_${Date.now()}`;

    // Create Razorpay order if enabled
    if (!isCashPayment && isRazorpayEnabled) {
      const rzpOrder = await createRazorpayOrder({
        amount: amount,
        currency: 'INR',
        receipt: `rcpt_${sessionId.slice(-6)}_${Date.now().toString().slice(-4)}`,
        notes: {
          restaurantId,
          sessionId,
          method,
          isCartCheckout: String(isCartCheckout),
        },
      });

      razorpayOrderId = rzpOrder.id;
      providerPaymentId = rzpOrder.id;
    }

    // Get active platform settings for commission
    let commissionRate = 10;
    let commission = 0;
    try {
      const { getPlatformSettings } = await import('../superAdmin/platformSettings.model');
      const settings = await getPlatformSettings();
      commissionRate = settings?.platformCommissionRate ?? 10;
      commission = Math.round(amount * (commissionRate / 100) * 100) / 100;
    } catch (e) {
      commission = Math.round(amount * 0.1 * 100) / 100;
    }

    // Create the PaymentModel record
    const payment = await PaymentModel.create({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId),
      amount,
      currency: 'INR',
      method,
      provider: isRazorpayEnabled && !isCashPayment ? 'razorpay' : 'mock',
      providerPaymentId,
      razorpayOrderId,
      status: PaymentStatus.PENDING as any,
      commissionRate,
      commission,
      metadata: {
        isCartCheckout,
        source: 'customer_payment_create',
      },
    });

    return {
      paymentId: providerPaymentId,
      amount,
      currency: 'INR',
      razorpayOrderId,
      razorpayKeyId: isRazorpayEnabled && !isCashPayment ? env.RAZORPAY_KEY_ID : null,
      provider: isRazorpayEnabled && !isCashPayment ? 'razorpay' : 'mock',
      payment,
    };
  }

  static async verifyCustomerPayment(
    restaurantId: string,
    sessionId: string,
    paymentId: string,
    simulateStatus?: VerifyPaymentInput['simulateStatus'],
    razorpayFields?: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const isRazorpayEnabled = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

    // 1. Razorpay signature verification
    if (razorpayFields && isRazorpayEnabled) {
      const isValid = verifyRazorpaySignature(razorpayFields);
      if (!isValid) {
        throw new AppError(
          'Payment signature verification failed. Possible tampered request.',
          400,
          ErrorCode.PAYMENT_FAILED,
        );
      }
    }

    // 2. Fetch payment record
    const paymentRecord = await PaymentModel.findOne({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId),
      $or: [
        { providerPaymentId: paymentId },
        { razorpayOrderId: paymentId },
        { _id: mongoose.Types.ObjectId.isValid(paymentId) ? toObjectId(paymentId) : null },
      ],
    });

    if (!paymentRecord) {
      throw new AppError('Payment record not found', 404, ErrorCode.NOT_FOUND);
    }

    // 3. Idempotency Check
    if (paymentRecord.status === PaymentStatus.COMPLETED) {
      return {
        success: true,
        payment: paymentRecord,
      };
    }

    if (simulateStatus === 'FAILED' || paymentId.includes('fail')) {
      paymentRecord.status = PaymentStatus.FAILED as any;
      paymentRecord.failureReason = 'Simulated payment failure';
      await paymentRecord.save();
      throw new AppError('Payment processing failed.', 400, ErrorCode.PAYMENT_FAILED);
    }

    const isCartCheckout = paymentRecord.metadata?.isCartCheckout === true;

    // Ensure bill exists for dine-and-pay-later model before starting transaction
    if (!isCartCheckout) {
      const { BillingModel } = await import('../billing/billing.model');
      const existingBill = await BillingModel.findOne({ sessionId: toObjectId(sessionId) });
      if (!existingBill) {
        const { BillingService } = await import('../billing/billing.service');
        await BillingService.requestFinalBill(restaurantId, sessionId);
      }
    }

    // 4. Wrap the rest in transaction
    let dbSession: mongoose.ClientSession | null = null;
    try {
      dbSession = await mongoose.startSession();
      dbSession.startTransaction();
    } catch (e) {
      dbSession = null;
    }

    const executeVerification = async (session: mongoose.ClientSession | null) => {
      const options = session ? { session } : undefined;

      // Update payment record details
      paymentRecord.status = PaymentStatus.COMPLETED as any;
      paymentRecord.verifiedAt = new Date();
      if (razorpayFields) {
        paymentRecord.razorpayPaymentId = razorpayFields.razorpay_payment_id;
        paymentRecord.razorpaySignature = razorpayFields.razorpay_signature;
        paymentRecord.providerPaymentId = razorpayFields.razorpay_payment_id;
      }
      await paymentRecord.save(options);

      if (isCartCheckout) {
        // Delegate order creation inside transaction
        const { OrdersService } = await import('../orders/orders.service');
        const createdOrder = await OrdersService.createOrder(
          restaurantId,
          sessionId,
          'PAID',
          session
        );

        // Link order and payment
        paymentRecord.orderId = createdOrder._id;
        await paymentRecord.save(options);

        return {
          success: true,
          payment: paymentRecord,
          order: createdOrder,
        };
      } else {
        // Dine-and-pay-later model: verify final bill
        const { BillingService } = await import('../billing/billing.service');
        const { bill, updatedOrders } = await BillingService.settleSession(sessionId, session || undefined);

        return {
          success: true,
          bill,
          updatedOrders,
          payment: paymentRecord,
        };
      }
    };

    try {
      let result;
      try {
        result = await executeVerification(dbSession);
        if (dbSession) {
          await dbSession.commitTransaction();
        }
      } catch (err: any) {
        if (dbSession) {
          await dbSession.abortTransaction();
        }
        if (err.name === 'MongoServerError' && err.message.includes('Transaction numbers')) {
          logger.warn('[Mongoose Transaction Fallback] Retrying verifyCustomerPayment without transaction.');
          result = await executeVerification(null);
        } else {
          throw err;
        }
      } finally {
        if (dbSession) {
          dbSession.endSession();
        }
      }

      // Emit Socket.IO event AFTER the transaction has been safely committed to the database.
      // This prevents ghost orders appearing in the Kitchen POS if the transaction rolls back.
      if (result?.order) {
        socketService.emitToRestaurant(restaurantId, SocketEvent.ORDER_NEW, { orderId: result.order._id });
        socketService.emitToSession(sessionId, 'order.new', { order: result.order });
      }

      // POST-PAID SIDE EFFECTS (only if bill exists, meaning it was a post-paid settlement)
      if (result?.bill) {
        await this.processPostPaidSideEffects(restaurantId, sessionId, result.bill, result.updatedOrders || []);
      }
      return result;
    } catch (error) {
      logger.error('Failed to verify customer payment', { error });
      throw error;
    }
  }

  /**
   * Processes all side effects after a successful post-paid settlement.
   * Every side effect is wrapped in try/catch to prevent blocking.
   */
  static async processPostPaidSideEffects(restaurantId: string, sessionId: string, bill: any, updatedOrders: any[]) {
    const { socketService } = await import('../../sockets/socket.service');
    const { SocketEvent } = await import('../../constants/events');

    // 1. Order Status Sockets
    if (updatedOrders && updatedOrders.length > 0) {
      try {
        for (const order of updatedOrders) {
          socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
          socketService.emitToSession(sessionId.toString(), 'order.updated', { orderId: order._id, status: order.status });
        }
      } catch (e) { logger.error('Failed to emit order status updates', { error: e }); }
    }

    // 2. Payment Confirmed Socket
    try {
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.PAYMENT_CONFIRMED, { billId: bill._id, sessionId });
      socketService.emitToSession(sessionId.toString(), 'payment.success', { billId: bill._id });
    } catch (e) { logger.error('Failed to emit payment confirmed', { error: e }); }

    // 3. Receipt Email
    if (bill.customerEmail && bill.wantsReceipt) {
      try {
        const { RestaurantModel } = await import('../restaurants/restaurants.model');
        const { sendReceiptEmail } = await import('../../services/mail.service');
        const restaurant = await RestaurantModel.findById(restaurantId).lean();
        const restaurantName = restaurant?.name || 'Our Restaurant';
        const orderItems = (updatedOrders || []).flatMap((o: any) => o.items);

        await sendReceiptEmail(bill.customerEmail, {
          restaurantName,
          invoiceNumber: bill.invoiceNumber || '',
          customerName: bill.customerName || 'Guest',
          customerPhone: bill.customerPhone || '',
          orderItems,
          subtotal: bill.subtotal,
          taxAmount: bill.taxAmount + (bill.serviceCharge || 0),
          totalAmount: bill.finalAmount,
          paymentMethod: bill.paymentMethod || 'ONLINE',
          paymentDate: bill.paidAt.toISOString().split('T')[0]
        });
        bill.receiptEmailedAt = new Date();
        await bill.save(); // Out-of-band save for receipt timestamp
      } catch (e) { logger.error('Failed to send receipt email', { error: e }); }
    }

    // 4. Notifications
    try {
      const { NotificationsService } = await import('../notifications/notifications.service');
      const { UserRole } = await import('../../constants/roles');
      const { NotificationCategory, NotificationPriority } = await import('../notifications/notifications.schema');
      await NotificationsService.createNotification({
        restaurantId: new mongoose.Types.ObjectId(restaurantId),
        tableSessionId: new mongoose.Types.ObjectId(sessionId),
        recipientRole: UserRole.CUSTOMER as any,
        title: 'Payment Successful',
        message: `Your payment of INR ${bill.finalAmount} was verified successfully.`,
        type: 'PAYMENT_SUCCESS',
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.HIGH,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      });
    } catch (e) { logger.error('Failed to send notification', { error: e }); }

    // 5. End Session
    try {
      const { endSession } = await import('../tableSessions/tableSessions.service');
      await endSession(sessionId, restaurantId, 'Bill paid successfully');
    } catch (e) { logger.error(`Failed to close session ${sessionId} after payment:`, e); }
  }

  static async requestCashPayment(restaurantId: string, sessionId: string) {
    const { BillingService } = await import('../billing/billing.service');

    // Validate session
    const { TableSessionModel } = await import('../tableSessions/tableSessions.model');
    const session = await TableSessionModel.findOne({ _id: toObjectId(sessionId), restaurantId: toObjectId(restaurantId) });
    if (!session || session.status === 'CLOSED') {
      throw new AppError('Session not found or already closed.', 404, ErrorCode.NOT_FOUND);
    }

    const liveBill = await BillingService.getLiveBill(restaurantId, sessionId);

    if (liveBill.financialSummary.outstandingBalance <= 0) {
      throw new AppError('No outstanding balance to pay.', 400, ErrorCode.INVALID_REQUEST);
    }

    // Reject if another PENDING cash payment already exists
    const existingPending = await PaymentModel.findOne({
      sessionId: toObjectId(sessionId),
      status: PaymentStatus.PENDING,
      method: PaymentMethod.CASH,
    });

    if (existingPending) {
      throw new AppError('A cash payment is already pending confirmation from staff.', 400, ErrorCode.INVALID_REQUEST);
    }

    const { BillingModel } = await import('../billing/billing.model');
    let bill = await BillingModel.findOne({ sessionId: toObjectId(sessionId) });
    if (!bill) {
      bill = await BillingService.requestFinalBill(restaurantId, sessionId);
    }

    // Create PaymentModel
    const payment = await PaymentModel.create({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId),
      billId: bill._id,
      amount: liveBill.financialSummary.outstandingBalance,
      currency: 'INR',
      method: PaymentMethod.CASH,
      provider: 'cash',
      status: PaymentStatus.PENDING as any,
    });

    // Fire socket for staff
    const { socketService } = await import('../../sockets/socket.service');
    const { SocketEvent } = await import('../../constants/events');
    socketService.emitToRestaurant(restaurantId, SocketEvent.PAYMENT_REQUESTED, { paymentId: payment._id, method: 'CASH', amount: payment.amount });

    return payment;
  }

  static async confirmCashPayment(restaurantId: string, paymentId: string, staffId: string) {
    const payment = await PaymentModel.findOne({
      _id: toObjectId(paymentId),
      restaurantId: toObjectId(restaurantId),
    });

    if (!payment) {
      throw new AppError('Payment not found.', 404, ErrorCode.NOT_FOUND);
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new AppError('Payment is already completed.', 400, ErrorCode.INVALID_REQUEST);
    }

    if (payment.method !== PaymentMethod.CASH) {
      throw new AppError('Only cash payments can be manually confirmed.', 400, ErrorCode.INVALID_REQUEST);
    }

    const { BillingModel } = await import('../billing/billing.model');
    const existingBill = await BillingModel.findOne({ sessionId: payment.sessionId });
    if (!existingBill) {
      const { BillingService } = await import('../billing/billing.service');
      await BillingService.requestFinalBill(restaurantId, payment.sessionId!.toString());
    }

    let dbSession: mongoose.ClientSession | null = null;
    try {
      dbSession = await mongoose.startSession();
      dbSession.startTransaction();
    } catch (e) {
      dbSession = null;
    }

    let bill, updatedOrders;
    try {
      payment.status = PaymentStatus.COMPLETED as any;
      payment.confirmedBy = toObjectId(staffId);
      payment.verifiedAt = new Date();
      await payment.save({ session: dbSession });

      const { BillingService } = await import('../billing/billing.service');
      const result = await BillingService.settleSession(payment.sessionId!.toString(), dbSession || undefined);
      bill = result.bill;
      updatedOrders = result.updatedOrders;

      if (dbSession) {
        await dbSession.commitTransaction();
      }
    } catch (err: any) {
      if (dbSession) {
        await dbSession.abortTransaction();
      }
      throw err;
    } finally {
      if (dbSession) {
        dbSession.endSession();
      }
    }

    // Side effects out of bounds
    if (bill && payment.sessionId) {
      await this.processPostPaidSideEffects(restaurantId, payment.sessionId.toString(), bill, updatedOrders || []);
    }

    return {
      success: true,
      payment,
      bill,
    };
  }

  static async getCustomerPaymentStatus(restaurantId: string, sessionId: string, paymentId: string) {
    const payment = await PaymentModel.findOne({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId),
      $or: [{ providerPaymentId: paymentId }, { _id: mongoose.Types.ObjectId.isValid(paymentId) ? toObjectId(paymentId) : null }],
    }).lean();

    if (payment) {
      return {
        paymentId: payment.providerPaymentId ?? payment._id,
        status: payment.status,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency,
        verifiedAt: payment.verifiedAt,
        failureReason: payment.failureReason,
      };
    }

    const bill = await BillingModel.findOne({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId),
      paymentId,
    }).lean();

    if (!bill) {
      throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
    }

    return {
      paymentId,
      status: bill.paymentStatus ?? BillingPaymentStatus.PENDING,
      method: bill.paymentMethod,
      amount: bill.finalAmount,
      currency: 'INR',
      paidAt: bill.paidAt,
    };
  }

  static async listCustomerPayments(restaurantId: string, sessionId: string) {
    const payments = await PaymentModel.find({
      restaurantId: toObjectId(restaurantId),
      sessionId: toObjectId(sessionId),
    })
      .sort({ createdAt: -1 })
      .lean();

    return {
      payments,
      meta: {
        count: payments.length,
      },
    };
  }

  static async listRestaurantPayments(restaurantId: string, query: ListPaymentsQuery) {
    const filter = buildPaymentFilter(restaurantId, query);
    const skip = (query.page - 1) * query.limit;

    const [payments, total] = await Promise.all([
      PaymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      PaymentModel.countDocuments(filter),
    ]);

    return {
      payments,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  static async getRestaurantPaymentSummary(restaurantId: string, query: ListPaymentsQuery) {
    const filter = buildPaymentFilter(restaurantId, query);
    const [summary] = await PaymentModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          completedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.COMPLETED] }, '$amount', 0],
            },
          },
          totalPayments: { $sum: 1 },
          completedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.COMPLETED] }, 1, 0],
            },
          },
          failedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.FAILED] }, 1, 0],
            },
          },
          refundedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.REFUNDED] }, 1, 0],
            },
          },
        },
      },
    ]);

    const byMethod = await PaymentModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return {
      summary: summary ?? {
        totalAmount: 0,
        completedAmount: 0,
        totalPayments: 0,
        completedPayments: 0,
        failedPayments: 0,
        refundedPayments: 0,
      },
      byMethod,
      filters: {
        status: query.status ?? null,
        method: query.method ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  }

  static async refundPayment(
    restaurantId: string,
    paymentId: string,
    refundAmountInRupees?: number,
    reason?: string,
  ) {
    const payment = (await PaymentModel.findOne({
      restaurantId: toObjectId(restaurantId),
      $or: [
        { providerPaymentId: paymentId },
        { razorpayPaymentId: paymentId },
        { _id: mongoose.Types.ObjectId.isValid(paymentId) ? toObjectId(paymentId) : null },
      ],
      status: PaymentStatus.COMPLETED,
    })) as (IPayment & { _id: mongoose.Types.ObjectId }) | null;

    if (!payment) {
      throw new AppError('Completed payment not found for refund', 404, ErrorCode.NOT_FOUND);
    }

    const amountToRefund = refundAmountInRupees ?? payment.amount;
    const isRazorpayEnabled = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

    // If this was a Razorpay payment, issue real refund
    if (payment.provider === 'razorpay' && payment.razorpayPaymentId && isRazorpayEnabled) {
      await createRazorpayRefund(payment.razorpayPaymentId, amountToRefund, {
        reason: reason ?? 'Refund requested',
        restaurantId,
      });
    }

    payment.status = PaymentStatus.REFUNDED as any;
    await payment.save();

    return payment;
  }

  static async handleRazorpayWebhook(
    rawBody: string,
    signature: string,
    webhookSecret: string,
  ) {
    const { verifyWebhookSignature } = await import('../../services/razorpay.service');

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400, ErrorCode.PAYMENT_FAILED);
    }

    const event = JSON.parse(rawBody);
    const entity = event?.payload?.payment?.entity;

    if (!entity) return { received: true };

    const rzpPaymentId = entity.id;
    const rzpOrderId = entity.order_id;
    const eventType = event.event;

    // Razorpay usually includes `notes` inside the payment entity.
    // For subscription billing linkage, we rely on:
    // - notes.subscriptionId
    // - notes.restaurantId
    const notes = entity?.notes ?? {};
    const maybeSubscriptionId = notes?.subscriptionId ? String(notes.subscriptionId) : undefined;
    const maybeRestaurantId = notes?.restaurantId ? String(notes.restaurantId) : undefined;

    // ---- Subscription billing path ----
    if (maybeSubscriptionId) {
      const subscriptionId = maybeSubscriptionId;
      const restaurantId = maybeRestaurantId;

      if (!restaurantId) {
        return { received: true, event: eventType, subscription: subscriptionId, reason: 'missing_restaurantId' };
      }

      const planAmount = entity.amount ? Number(entity.amount) / 100 : 0;

      const { SubscriptionPaymentModel, SubscriptionModel, SubscriptionEventModel } = await import('../../modules/subscriptions/subscriptions.model');
      const { SubscriptionPaymentProvider, SubscriptionPaymentStatus, SubscriptionEventType } = await import('../../modules/subscriptions/subscriptions.model');

      if (eventType === 'payment.captured') {
        await SubscriptionPaymentModel.findOneAndUpdate(
          {
            subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
            providerOrderId: rzpOrderId,
          },
          {
            providerPaymentId: rzpPaymentId,
            status: SubscriptionPaymentStatus.COMPLETED,
            paidAt: new Date(),
            webhookEventId: event?.id ? String(event.id) : null,
            metadata: { ...(entity?.notes ?? {}), source: 'razorpay_webhook' },
          },
          { new: true, upsert: true },
        );

        const sub = await SubscriptionModel.findById(subscriptionId);
        if (sub) {
          const addDays = sub.billingCycle === 'yearly' ? 365 : 30;
          sub.currentPeriodStart = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
          sub.currentPeriodEnd = new Date(Date.now() + addDays * 24 * 60 * 60 * 1000);
          sub.status = SubscriptionPaymentStatus.COMPLETED as any;
          sub.nextBillingDate = sub.autoRenew ? new Date(sub.currentPeriodEnd) : null;
          sub.lastPaymentReference = String(rzpPaymentId);

          await sub.save();

          await SubscriptionEventModel.create({
            subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            type: SubscriptionEventType.PAYMENT_COMPLETED,
            metadata: {
              paymentProvider: SubscriptionPaymentProvider.RAZORPAY,
              amount: planAmount,
              orderId: rzpOrderId,
              paymentId: rzpPaymentId,
              fromPlan: sub.plan,
            },
          });

          await SubscriptionEventModel.create({
            subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            type: SubscriptionEventType.RENEWED,
            metadata: { newPeriodEnd: sub.currentPeriodEnd, addDays },
          });
        }
      }

      if (eventType === 'payment.failed') {
        await SubscriptionPaymentModel.findOneAndUpdate(
          {
            subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
            providerOrderId: rzpOrderId,
          },
          {
            providerPaymentId: rzpPaymentId,
            status: SubscriptionPaymentStatus.FAILED,
            failedAt: new Date(),
            webhookEventId: event?.id ? String(event.id) : null,
            metadata: {
              ...(entity?.notes ?? {}),
              source: 'razorpay_webhook',
              error: entity?.error_description ?? null,
            },
          },
          { new: true, upsert: true },
        );

        await SubscriptionEventModel.create({
          subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          type: SubscriptionEventType.PAYMENT_FAILED,
          metadata: {
            orderId: rzpOrderId,
            paymentId: rzpPaymentId,
            error: entity?.error_description ?? null,
          },
        });

        await SubscriptionModel.findByIdAndUpdate(subscriptionId, { status: 'past_due' });
      }

      return { received: true, event: eventType, subscription: subscriptionId };
    }

    // ---- Partner request onboarding fee path ----
    const { RestaurantRequestModel } = await import('../superAdmin/restaurantRequest.model');
    const partnerRequest = await RestaurantRequestModel.findOne({ orderId: rzpOrderId }).setOptions({ bypassTenant: true });
    if (partnerRequest) {
      if (eventType === 'payment.captured') {
        if (partnerRequest.status === 'PENDING_PAYMENT') {
          partnerRequest.status = 'APPLICATION_PENDING';
          partnerRequest.paymentId = rzpPaymentId;
          partnerRequest.paymentStatus = 'CAPTURED';
          partnerRequest.paymentTimestamp = new Date();
          await partnerRequest.save();

          // Send submission email
          const { sendRestaurantSubmissionEmail } = await import('../../services/mail.service');
          void sendRestaurantSubmissionEmail(
            partnerRequest.email,
            partnerRequest.ownerName,
            partnerRequest.restaurantName,
            'Processing Fee Paid (Webhook)'
          );

          // Broadcast via Socket.IO
          socketService.emitToSuperAdmin('restaurant_request_created', {
            id: partnerRequest._id.toString(),
            name: partnerRequest.restaurantName,
            owner: partnerRequest.ownerName,
            email: partnerRequest.email,
            phone: partnerRequest.phone,
            location: `${partnerRequest.city}, ${partnerRequest.state}, ${partnerRequest.country}`,
            plan: partnerRequest.selectedPlan || 'Free Onboarding',
            requestedAt: partnerRequest.submittedAt.toISOString(),
            message: partnerRequest.message ?? '',
            latitude: partnerRequest.latitude,
            longitude: partnerRequest.longitude,
            googleMapsUrl: partnerRequest.googleMapsUrl ?? '',
          });
        }
      }

      if (eventType === 'payment.failed') {
        partnerRequest.paymentStatus = 'FAILED';
        await partnerRequest.save();
      }

      return { received: true, event: eventType, partnerRequest: partnerRequest._id.toString() };
    }

    // ---- Customer bill payment path (existing behavior) ----
    const payment = (await PaymentModel.findOne({
      $or: [
        { razorpayOrderId: rzpOrderId },
        { providerPaymentId: rzpOrderId },
      ],
    })) as (IPayment & { _id: mongoose.Types.ObjectId }) | null;

    if (!payment) return { received: true }; // not our payment — ignore

    if (eventType === 'payment.captured') {
      payment.razorpayPaymentId = rzpPaymentId;
      payment.providerPaymentId = rzpPaymentId;
      payment.status = 'COMPLETED' as any;
      payment.verifiedAt = new Date();
      await payment.save();

      // Mark bill and orders as paid
      if (payment.sessionId) {
        await BillingService.verifyPayment(
          payment.restaurantId.toString(),
          payment.sessionId.toString(),
          rzpOrderId,
        );
      }
    }

    if (eventType === 'payment.failed') {
      payment.status = PaymentStatus.FAILED as any;
      payment.failureReason = entity.error_description ?? 'Payment failed';
      await payment.save();

      // Create platform system alert for Super Admin
      try {
        const { createSystemAlert } = await import('../superAdmin/superAdmin.service');
        await createSystemAlert({
          title: `Payment Failed: ${entity.id || 'Transaction'}`,
          description: `Gateway transaction failed. Reason: ${payment.failureReason}`,
          type: 'critical',
          entityType: 'payment',
          entityId: payment._id,
          tags: ['payment_failed', 'razorpay'],
        });
      } catch (e) {
        // Ignore
      }
    }

    return { received: true, event: eventType };
  }

  static async markCashPaymentCollected(restaurantId: string, paymentId: string) {
    const payment = await PaymentModel.findOne({
      restaurantId: toObjectId(restaurantId),
      $or: [{ providerPaymentId: paymentId }, { _id: mongoose.Types.ObjectId.isValid(paymentId) ? toObjectId(paymentId) : null }],
      method: PaymentMethod.CASH,
    });

    if (!payment) {
      throw new AppError('Cash payment not found', 404, ErrorCode.NOT_FOUND);
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return payment;
    }

    if (!payment.sessionId || !payment.providerPaymentId) {
      throw new AppError('Payment cannot be verified automatically', 400, ErrorCode.INVALID_REQUEST);
    }

    await BillingService.verifyPayment(
      restaurantId,
      payment.sessionId.toString(),
      payment.providerPaymentId,
    );

    return PaymentModel.findById(payment._id);
  }
}
