import mongoose from 'mongoose';
import { BillingModel } from './billing.model';
import { OrderModel } from '../orders/orders.model';
import { BillStatus, PaymentMethod, PaymentStatus as BillingPaymentStatus } from './billing.schema';
import { PaymentStatus } from '../../constants/statuses';
import { TableModel } from '../tables/tables.model';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { TableStatus, OrderStatus } from '../../constants/statuses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { OfferModel } from '../offers/offers.model';
import { RestaurantModel } from '../restaurants/restaurants.model';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../constants/roles';
import { NotificationCategory, NotificationPriority } from '../notifications/notifications.schema';
import { PaymentModel } from '../payments/payments.model';
import { InvoiceCounterModel } from './invoice-counter.model';
import { sendReceiptEmail } from '../../services/mail.service';
import logger from "../../config/logger";
import { endSession } from '../tableSessions/tableSessions.service';
import { CustomerProfileModel } from '../analytics/customerProfile.model';

export class BillingService {
  /**
   * Generates a live bill based on current orders for a session.
   */
  static async getLiveBill(restaurantId: string, sessionId: string) {
    const orders = await OrderModel.find({
      restaurantId,
      sessionId,
      status: { $ne: OrderStatus.CANCELLED }
    });

    const payments = await PaymentModel.find({
      restaurantId,
      sessionId,
      status: PaymentStatus.COMPLETED
    });

    const session = await TableSessionModel.findById(sessionId);

    if ((!orders || orders.length === 0) && (!payments || payments.length === 0)) {
      return {
        session,
        orders: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        serviceCharge: 0,
        finalAmount: 0,
        financialSummary: {
          grossTotal: 0,
          tax: 0,
          discount: 0,
          paymentsApplied: 0,
          outstandingBalance: 0
        }
      };
    }

    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    let paymentsApplied = 0;

    orders.forEach(order => {
      subtotal += order.totalAmount;
      taxAmount += order.taxAmount;
      discountAmount += order.discountAmount;
    });

    payments.forEach(payment => {
      paymentsApplied += payment.amount;
    });

    // Fetch service charge configuration dynamically from restaurant settings
    const restaurant = await RestaurantModel.findById(restaurantId);
    const serviceChargeEnabled = restaurant?.settings?.serviceChargeEnabled ?? true;
    const serviceCharge = serviceChargeEnabled ? subtotal * 0.05 : 0;

    const grossTotal = subtotal + taxAmount + serviceCharge;
    const outstandingBalance = (grossTotal - discountAmount) - paymentsApplied;

    return {
      session,
      orders,
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount,
      finalAmount: Math.max(0, outstandingBalance),
      financialSummary: {
        grossTotal,
        tax: taxAmount,
        discount: discountAmount,
        paymentsApplied,
        outstandingBalance: Math.max(0, outstandingBalance)
      }
    };
  }

  /**
   * Requests the final bill. Creates or updates the Bill document.
   */
  static async requestFinalBill(restaurantId: string, sessionId: string, customerEmail?: string, wantsReceipt?: boolean) {
    // Transition all active/served orders to BILLED
    const activeOrders = await OrderModel.find({
      restaurantId,
      sessionId,
      status: { $in: [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.DELAYED,
        OrderStatus.READY,
        OrderStatus.PICKED,
        OrderStatus.SERVED
      ] }
    });

    for (const order of activeOrders) {
      order.status = OrderStatus.BILLED;
      await order.save();
    }

    const liveBill = await this.getLiveBill(restaurantId, sessionId);

    if (liveBill.orders.length === 0) {
      throw new AppError('No valid orders found for this session.', 400, ErrorCode.INVALID_REQUEST);
    }

    const orderIds = liveBill.orders.map(o => o._id as mongoose.Types.ObjectId);

    let bill = await BillingModel.findOne({ restaurantId, sessionId });
    const session = await TableSessionModel.findById(sessionId);

    if (bill) {
      if (bill.status === BillStatus.PAID || bill.status === BillStatus.PENDING_PAYMENT) {
        throw new AppError('Bill is already finalized or paid.', 400, ErrorCode.INVALID_REQUEST);
      }

      bill.subtotal = liveBill.subtotal;
      bill.taxAmount = liveBill.taxAmount;
      bill.serviceCharge = liveBill.serviceCharge;

      const couponDiscount = bill.appliedCoupons.reduce((sum, c) => sum + c.discountAmount, 0);
      bill.discountAmount = liveBill.financialSummary.discount + couponDiscount;
      bill.grossTotal = liveBill.financialSummary.grossTotal;
      bill.paymentsApplied = liveBill.financialSummary.paymentsApplied;
      bill.outstandingBalance = Math.max(0, (bill.grossTotal - bill.discountAmount) - bill.paymentsApplied);
      bill.finalAmount = bill.outstandingBalance;

      bill.orderIds = orderIds;
      bill.status = BillStatus.GENERATED;
      bill.requestedAt = new Date();

      if (customerEmail) bill.customerEmail = customerEmail;
      if (session) {
        bill.customerName = session.customerName;
        bill.customerPhone = session.mobile;
      }

      await bill.save();
    } else {
      bill = await BillingModel.create({
        restaurantId,
        sessionId,
        orderIds,
        subtotal: liveBill.subtotal,
        taxAmount: liveBill.taxAmount,
        serviceCharge: liveBill.serviceCharge,
        discountAmount: liveBill.financialSummary.discount,
        grossTotal: liveBill.financialSummary.grossTotal,
        paymentsApplied: liveBill.financialSummary.paymentsApplied,
        outstandingBalance: liveBill.financialSummary.outstandingBalance,
        finalAmount: liveBill.financialSummary.outstandingBalance,
        status: BillStatus.GENERATED,
        requestedAt: new Date(),
        customerEmail,
        wantsReceipt: wantsReceipt || false,
        customerName: session?.customerName,
        customerPhone: session?.mobile,
      });
    }

    // Transition table status to BILL_PENDING and session to PAYMENT_PENDING
    if (session) {
      await TableModel.findByIdAndUpdate(session.tableId, {
        status: TableStatus.BILL_PENDING,
      });

      const { SessionStatus } = await import('../../constants/statuses');
      await TableSessionModel.findByIdAndUpdate(session._id, {
        status: SessionStatus.PAYMENT_PENDING,
      });

      const { socketService } = await import('../../sockets/socket.service');
      const { SocketEvent } = await import('../../constants/events');
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.BILL_REQUESTED, {
        sessionId: session._id,
        tableId: session.tableId,
        billId: bill._id,
        outstandingBalance: bill.outstandingBalance || bill.finalAmount
      });
    }

    return bill;
  }

  static async applyCoupon(restaurantId: string, sessionId: string, couponCode: string) {
    const bill = await BillingModel.findOne({ restaurantId, sessionId });
    if (!bill) {
      throw new AppError('Bill not found. Please request bill first.', 404, ErrorCode.NOT_FOUND);
    }

    if (bill.status === BillStatus.PAID || bill.status === BillStatus.PENDING_PAYMENT) {
      throw new AppError('Cannot apply coupon to a finalized or paid bill.', 400, ErrorCode.INVALID_REQUEST);
    }

    const offer = await OfferModel.findOne({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      promoCode: couponCode.toUpperCase(),
      status: 'ACTIVE',
      startDate: { $lte: new Date() },
      expiryDate: { $gte: new Date() },
    });
    if (!offer) {
      throw new AppError('Invalid coupon code.', 400, ErrorCode.VALIDATION_ERROR);
    }

    const isAlreadyApplied = bill.appliedCoupons.some(c => c.code === couponCode.toUpperCase());
    if (isAlreadyApplied) {
      throw new AppError('Coupon already applied.', 400, ErrorCode.VALIDATION_ERROR);
    }

    const discountAmount = offer.discountType === 'PERCENTAGE'
      ? bill.subtotal * (offer.discountValue / 100)
      : offer.discountValue;

    bill.appliedCoupons.push({
      couponId: offer._id as mongoose.Types.ObjectId,
      code: offer.promoCode,
      discountAmount
    });

    bill.discountAmount += discountAmount;
    bill.finalAmount = Math.max(0, bill.finalAmount - discountAmount);

    await bill.save();
    return bill;
  }

  static async removeCoupon(restaurantId: string, sessionId: string, couponCode: string) {
    const bill = await BillingModel.findOne({ restaurantId, sessionId });
    if (!bill) {
      throw new AppError('Bill not found.', 404, ErrorCode.NOT_FOUND);
    }

    if (bill.status === BillStatus.PAID || bill.status === BillStatus.PENDING_PAYMENT) {
      throw new AppError('Cannot modify a finalized or paid bill.', 400, ErrorCode.INVALID_REQUEST);
    }

    const couponIndex = bill.appliedCoupons.findIndex(c => c.code === couponCode);
    if (couponIndex === -1) {
      throw new AppError('Coupon not found on this bill.', 404, ErrorCode.NOT_FOUND);
    }

    const discountAmount = bill.appliedCoupons[couponIndex].discountAmount;
    bill.appliedCoupons.splice(couponIndex, 1);

    bill.discountAmount = Math.max(0, bill.discountAmount - discountAmount);
    bill.finalAmount += discountAmount;

    await bill.save();
    return bill;
  }

  /**
   * Single source of truth for settling a dining session after money has been verified.
   * Modifies only the Billing domain and delegates Order updates.
   * Does NOT emit sockets or close sessions directly.
   */
  /**
   * Update or create a CustomerProfile for the session's phone number after
   * successful payment.  This is what powers the admin customers page stats
   * (totalVisits, totalSpent, loyalCustomers, etc.).
   */
  static async updateCustomerProfileAfterPayment(
    restaurantId: string | mongoose.Types.ObjectId,
    sessionId: string | mongoose.Types.ObjectId,
    paidAmount: number,
    dbSession?: mongoose.ClientSession,
  ): Promise<void> {
    try {
      const sessionDoc = await TableSessionModel.findById(sessionId).session(dbSession || null);
      if (!sessionDoc || !sessionDoc.mobile) {
        logger.warn('[CustomerProfile] No mobile on session, skipping profile update');
        return;
      }

      const mobile = sessionDoc.mobile.replace(/\D/g, '');
      if (!mobile) return;

      const restId = typeof restaurantId === 'string' ? new mongoose.Types.ObjectId(restaurantId) : restaurantId;

      // Upsert: increment totalVisits, totalSpent and set restaurantsVisited
      await CustomerProfileModel.findOneAndUpdate(
        { mobile },
        {
          $set: {
            name: sessionDoc.customerName || mobile,
            lastVisitAt: new Date(),
            $setOnInsert: {
              firstVisitAt: new Date(),
              mobile,
            },
          },
          $inc: {
            totalVisits: 1,
            totalSpent: paidAmount,
          },
          $addToSet: {
            restaurantsVisited: restId,
          },
        },
        { upsert: true, session: dbSession, new: true },
      );

      logger.info(`[CustomerProfile] Updated profile for mobile ${mobile}: +1 visit, +${paidAmount} spent`);
    } catch (err) {
      logger.error('[CustomerProfile] Failed to update profile after payment', { error: err, sessionId });
    }
  }

  static async settleSession(
    sessionId: string | mongoose.Types.ObjectId,
    dbSession?: mongoose.ClientSession,
  ) {
    const bill = await BillingModel.findOne({ sessionId }).session(dbSession || null);
    if (!bill) {
      throw new AppError('Bill not found for this session.', 404, ErrorCode.NOT_FOUND);
    }

    if (bill.status === BillStatus.PAID) {
      return { bill, updatedOrders: [] }; // Idempotent
    }

    // 1. Mark orders as paid via OrdersService
    const { OrdersService } = await import('../orders/orders.service');
    const updatedOrders = await OrdersService.markOrdersPaid(sessionId, dbSession);

    // 2. Settle the bill
    bill.status = BillStatus.PAID;
    bill.paymentStatus = BillingPaymentStatus.PAID;
    bill.paidAt = new Date();

    // Idempotent Invoice Number Generation
    if (!bill.invoiceNumber) {
      const currentYear = new Date().getFullYear();
      const { InvoiceCounterModel } = await import('./invoice-counter.model');
      const counter = await InvoiceCounterModel.findOneAndUpdate(
        { year: currentYear },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true, session: dbSession }
      );
      const sequenceStr = String(counter.sequence).padStart(6, '0');
      bill.invoiceNumber = `INV-${currentYear}-${sequenceStr}`;
    }

    // 3. Automatically store customerId if a matching user exists
    if (!bill.customerId && bill.customerPhone) {
      try {
        const { UserModel } = await import('../users/users.model');
        const { UserRole } = await import('../../constants/roles');
        const user = await UserModel.findOne({ mobile: bill.customerPhone, role: UserRole.CUSTOMER }).session(dbSession || null);
        if (user) {
          bill.customerId = user._id as mongoose.Types.ObjectId;
        }
      } catch (err) {
        logger.error('Failed to link customerId during settlement', err);
      }
    }

    await bill.save({ session: dbSession });

    // 4. Update CustomerProfile for analytics (totalVisits, totalSpent).
    // This must happen after bill save so finalAmount is the settled amount.
    try {
      const restId = bill.restaurantId || (await BillingModel.findById(bill._id).session(dbSession || null))?.restaurantId;
      if (restId) {
        await this.updateCustomerProfileAfterPayment(
          restId,
          sessionId,
          bill.finalAmount,
          dbSession,
        );
      }
    } catch (err) {
      logger.error('[Settlement] Failed to update customer profile', { error: err });
    }

    return { bill, updatedOrders };
  }

  static async verifyPayment(restaurantId: string, sessionId: string, paymentId: string, simulateStatus?: BillingPaymentStatus) {
    const bill = await BillingModel.findOne({ restaurantId, sessionId });
    if (!bill) {
      throw new AppError('Bill not found.', 404, ErrorCode.NOT_FOUND);
    }

    // Idempotency check
    if (bill.paymentId === paymentId && bill.status === BillStatus.PAID && bill.paymentStatus === BillingPaymentStatus.PAID) {
      return bill; // Already processed
    }

    if (bill.paymentId !== paymentId) {
      throw new AppError('Invalid payment ID.', 400, ErrorCode.VALIDATION_ERROR);
    }

    // Find the corresponding PaymentModel record
    const payment = await PaymentModel.findOne({
      restaurantId: bill.restaurantId,
      sessionId: bill.sessionId,
      status: PaymentStatus.PENDING,
    });

    // Mock failure behavior
    if (simulateStatus === BillingPaymentStatus.FAILED || paymentId.includes('fail')) {
      bill.paymentStatus = BillingPaymentStatus.FAILED;
      bill.status = BillStatus.FAILED;
      await bill.save();

      if (payment) {
        payment.status = PaymentStatus.FAILED as any;
        await payment.save();
      }

      throw new AppError('Payment processing failed.', 400, ErrorCode.PAYMENT_FAILED);
    }

    // Mock expired behavior
    if (simulateStatus === BillingPaymentStatus.EXPIRED) {
      bill.paymentStatus = BillingPaymentStatus.EXPIRED;
      bill.status = BillStatus.DRAFT; // Revert to a pre-payment state
      await bill.save();

      if (payment) {
        payment.status = 'FAILED' as any;
        await payment.save();
      }

      throw new AppError('Payment session expired.', 400, ErrorCode.PAYMENT_FAILED);
    }

    // Mock pending behavior (doing nothing and waiting)
    if (simulateStatus === BillingPaymentStatus.PENDING) {
      return bill;
    }

    // Execute domain settlement
    const { bill: updatedBill, updatedOrders } = await this.settleSession(sessionId);

    if (payment) {
      payment.status = 'COMPLETED' as any;
      payment.verifiedAt = new Date();
      await payment.save();
    }

    const { socketService } = await import('../../sockets/socket.service');
    const { SocketEvent } = await import('../../constants/events');

    for (const order of updatedOrders) {
      socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.ORDER_STATUS_UPDATED, { orderId: order._id, status: order.status });
      socketService.emitToSession(sessionId.toString(), 'order.updated', { orderId: order._id, status: order.status });
    }

    // Emit bill.paid to restaurant and session
    socketService.emitToRestaurant(restaurantId.toString(), SocketEvent.PAYMENT_CONFIRMED, { billId: updatedBill._id, sessionId });
    socketService.emitToSession(sessionId.toString(), 'payment.success', { billId: updatedBill._id });

    // Send HTML Receipt Email
    if (bill.customerEmail && bill.wantsReceipt) {
      try {
        const restaurant = await RestaurantModel.findById(restaurantId).lean();
        const restaurantName = restaurant?.name || 'Our Restaurant';
        const orderItems = updatedOrders.flatMap(o => o.items);

        await sendReceiptEmail(updatedBill.customerEmail as string, {
          restaurantName,
          invoiceNumber: updatedBill.invoiceNumber || '',
          customerName: updatedBill.customerName || 'Guest',
          customerPhone: updatedBill.customerPhone || '',
          orderItems,
          subtotal: updatedBill.subtotal,
          taxAmount: updatedBill.taxAmount + (updatedBill.serviceCharge || 0),
          totalAmount: updatedBill.finalAmount,
          paymentMethod: updatedBill.paymentMethod || 'ONLINE',
          paymentDate: updatedBill.paidAt ? updatedBill.paidAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });

        updatedBill.receiptEmailedAt = new Date();
        await updatedBill.save();
      } catch (error) {
        logger.error('Failed to send receipt email', { error, billId: bill._id });
      }
    }

    // Trigger persistent notification targeting CUSTOMER
    try {
      await NotificationsService.createNotification({
        restaurantId: new mongoose.Types.ObjectId(restaurantId),
        tableSessionId: new mongoose.Types.ObjectId(sessionId),
        recipientRole: UserRole.CUSTOMER,
        title: 'Payment Successful',
        message: `Your payment of INR ${updatedBill.finalAmount} was verified successfully.`,
        type: 'PAYMENT_SUCCESS',
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.HIGH,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (notifError) {
      logger.error('Failed to trigger payment success notification:', notifError);
    }

    // Stock deduction is now handled by OrdersService.startCooking() during the kitchen workflow.

    try {
      await endSession(sessionId, restaurantId, 'Bill paid successfully');
    } catch (error) {
      logger.error(`Failed to close session ${sessionId} after payment:`, error);
    }

    return updatedBill;
  }

  static async getPaymentStatus(restaurantId: string, sessionId: string, paymentId: string) {
    const bill = await BillingModel.findOne({ restaurantId, sessionId, paymentId });
    if (!bill) {
      throw new AppError('Bill/Payment not found.', 404, ErrorCode.NOT_FOUND);
    }

    return {
      status: bill.status,
      paymentStatus: bill.paymentStatus,
      paidAt: bill.paidAt,
      paymentMethod: bill.paymentMethod
    };
  }

  static async getRevenueReport(restaurantId: string) {
    const result = await BillingModel.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), status: BillStatus.PAID } },
      { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } }
    ]);
    return result[0] || { totalRevenue: 0 };
  }

  static async getTaxReport(restaurantId: string) {
    const result = await BillingModel.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), status: BillStatus.PAID } },
      { $group: { _id: null, totalTax: { $sum: "$taxAmount" } } }
    ]);
    return result[0] || { totalTax: 0 };
  }

  static async getOrderBillingReport(restaurantId: string) {
    const result = await BillingModel.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    return result;
  }

  static async getDiscountReport(restaurantId: string) {
    const result = await BillingModel.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), status: BillStatus.PAID } },
      { $group: { _id: null, totalDiscount: { $sum: "$discountAmount" } } }
    ]);
    return result[0] || { totalDiscount: 0 };
  }

  static async getPaymentReport(restaurantId: string) {
    const result = await BillingModel.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), status: BillStatus.PAID } },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, totalAmount: { $sum: "$finalAmount" } } }
    ]);
    return result;
  }
}
