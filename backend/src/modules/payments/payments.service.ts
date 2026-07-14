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

      const isCartCheckout = paymentRecord.metadata?.isCartCheckout === true;

      if (isCartCheckout) {
        // Place the order from cart items inside transaction
        const { Cart } = await import('../cart/cart.model');
        const cart = await Cart.findOne({
          restaurantId: toObjectId(restaurantId),
          sessionId: toObjectId(sessionId)
        }).session(session ? session : null as any);

        if (!cart || !cart.items || cart.items.length === 0) {
          throw new AppError('Cart empty or not found during payment verification', 400, ErrorCode.VALIDATION_ERROR);
        }

        // Map cart items to order items
        const menuItemIds = cart.items.map(i => i.menuItem);
        const menuItems = await mongoose.model('MenuItem').find({
          _id: { $in: menuItemIds },
          restaurantId: toObjectId(restaurantId)
        }).populate('ingredients.inventoryItemId').session(session ? session : null as any);

        const menuItemMap = new Map(menuItems.map(m => [m._id.toString(), m]));

        const orderItems = cart.items.map((item: any) => {
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
            notes: item.notes || '',
            ingredients: ingredientsSnapshot,
          };
        });

        const timestamp = Date.now().toString().slice(-6);
        const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
        const orderNumber = `ORD-${timestamp}-${randomChars}`;

        const { OrderModel } = await import('../orders/orders.model');
        const { OrderStatus } = await import('../../constants/statuses');
        
        const sessionDoc = await TableSessionModel.findById(sessionId).session(session ? session : null as any);
        if (!sessionDoc) {
          throw new AppError('Table session not found', 404, ErrorCode.NOT_FOUND);
        }

        const order = await OrderModel.create([{
          restaurantId: toObjectId(restaurantId),
          tableId: sessionDoc.tableId,
          sessionId: toObjectId(sessionId),
          orderNumber,
          items: orderItems,
          totalAmount: cart.subtotal,
          taxAmount: cart.tax,
          discountAmount: cart.discount,
          finalAmount: cart.grandTotal,
          status: OrderStatus.PENDING,
          paymentStatus: 'PAID', // mark as paid since checkout completed
          priority: 'NORMAL',
          specialInstructions: '',
        }], options);

        const createdOrder = order[0];

        // Link order and payment
        paymentRecord.orderId = createdOrder._id;
        await paymentRecord.save(options);

        // Transition table status to ORDERING if it is currently OCCUPIED
        const table = await TableModel.findById(createdOrder.tableId).session(session ? session : null as any);
        if (table && table.status === TableStatus.OCCUPIED) {
          table.status = TableStatus.ORDERING;
          await table.save(options);
        }

        // Clear cart
        cart.items = [] as any;
        cart.subtotal = 0;
        cart.tax = 0;
        cart.discount = 0;
        cart.grandTotal = 0;
        await cart.save(options);

        // Emit Socket.IO event for new paid order
        socketService.emitToRestaurant(restaurantId, SocketEvent.ORDER_NEW, { orderId: createdOrder._id });
        socketService.emitToSession(sessionId, 'order.new', { order: createdOrder });

        return {
          success: true,
          payment: paymentRecord,
          order: createdOrder,
        };
      } else {
        // Dine-and-pay-later model: verify final bill
        const bill = await BillingService.verifyPayment(
          restaurantId,
          sessionId,
          paymentId,
          mapVerificationStatus(simulateStatus),
        );

        return {
          success: true,
          bill,
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
      return result;
    } catch (error) {
      logger.error('Failed to verify customer payment', { error });
      throw error;
    }
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
