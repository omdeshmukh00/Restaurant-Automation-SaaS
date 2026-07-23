import mongoose from 'mongoose';
import { BillingModel } from './billing.model';
import { OrderModel } from '../orders/orders.model';
import { BillStatus, PaymentStatus as BillingPaymentStatus } from './billing.schema';
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
import { sendReceiptEmail } from '../../services/mail.service';
import logger from "../../config/logger";
import { endSession } from '../tableSessions/tableSessions.service';

export class BillingService {
  /**
   * Single Canonical DTO Builder for Live Bill
   */
  private static buildLiveBillDTO(
    bill: any,
    session: any,
    orders: any[],
    payments: any[],
    serviceChargeEnabled: boolean
  ) {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    let paymentsApplied = 0;

    (orders || []).forEach(order => {
      subtotal += order.totalAmount;
      taxAmount += order.taxAmount;
      discountAmount += order.discountAmount;
    });

    (payments || []).forEach(payment => {
      paymentsApplied += payment.amount;
    });

    const serviceCharge = serviceChargeEnabled && subtotal > 0 ? subtotal * 0.05 : 0;
    const grossTotal = subtotal + taxAmount + serviceCharge;
    const outstandingBalance = (grossTotal - discountAmount) - paymentsApplied;

    return {
      _id: bill?._id?.toString() || null,
      status: bill?.status || BillStatus.DRAFT,
      paymentStatus: bill?.paymentStatus || PaymentStatus.PENDING,
      invoiceNumber: bill?.invoiceNumber || null,
      session: session || null,
      orders: orders || [],
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount,
      finalAmount: grossTotal - discountAmount,
      outstandingBalance: Math.max(0, outstandingBalance),
      amountPaid: paymentsApplied,
      payments: payments || [],
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
   * Generates a live bill based on current orders for a session.
   */
  static async getLiveBill(restaurantId: string, sessionId: string) {
    const [orders, payments, session, bill, restaurant] = await Promise.all([
      OrderModel.find({
        restaurantId,
        sessionId,
        status: { $ne: OrderStatus.CANCELLED }
      }),
      PaymentModel.find({
        restaurantId,
        sessionId,
        status: PaymentStatus.COMPLETED
      }),
      TableSessionModel.findById(sessionId),
      BillingModel.findOne({ restaurantId, sessionId }),
      RestaurantModel.findById(restaurantId)
    ]);

    const serviceChargeEnabled = restaurant?.settings?.serviceChargeEnabled ?? true;

    return this.buildLiveBillDTO(bill, session, orders, payments, serviceChargeEnabled);
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
      try {
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
      } catch (err: any) {
        if (err.name === 'MongoServerError' && err.code === 11000) {
          // Bill was created concurrently. Because of replication lag or transaction visibility,
          // we may need to retry fetching it slightly.
          let retries = 3;
          while (retries > 0) {
            bill = await BillingModel.findOne({ restaurantId, sessionId });
            if (bill) break;
            
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 150)); // wait 150ms and retry
            }
          }
          if (!bill) throw err;
        } else {
          throw err;
        }
      }
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
      code: couponCode.toUpperCase(),
      active: true
    });
    if (!offer) {
      throw new AppError('Invalid coupon code.', 400, ErrorCode.VALIDATION_ERROR);
    }

    const isAlreadyApplied = bill.appliedCoupons.some(c => c.code === couponCode.toUpperCase());
    if (isAlreadyApplied) {
      throw new AppError('Coupon already applied.', 400, ErrorCode.VALIDATION_ERROR);
    }

    const discountAmount = bill.subtotal * (offer.discountPercent / 100);

    bill.appliedCoupons.push({
      couponId: offer._id as mongoose.Types.ObjectId,
      code: offer.code,
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
  static async settleSession(
    sessionId: string | mongoose.Types.ObjectId,
    dbSession?: mongoose.ClientSession,
  ) {
    const mongoose = await import('mongoose');
    const safeSessionId = typeof sessionId === 'string' ? new mongoose.Types.ObjectId(sessionId) : sessionId;
    
    const bill = await BillingModel.findOne({ sessionId: safeSessionId }).session(dbSession || null);
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
      
      let counter;
      try {
        counter = await InvoiceCounterModel.findOneAndUpdate(
          { year: currentYear },
          { $inc: { sequence: 1 } },
          { new: true, upsert: true }
        );
      } catch (err: any) {
        if (err.code === 11000) {
          // If created concurrently, retry without upsert
          counter = await InvoiceCounterModel.findOneAndUpdate(
            { year: currentYear },
            { $inc: { sequence: 1 } },
            { new: true }
          );
        } else {
          throw err;
        }
      }
      
      if (counter) {
        const sequenceStr = String(counter.sequence).padStart(6, '0');
        bill.invoiceNumber = `INV-${currentYear}-${sequenceStr}`;
      }
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

    return { bill, updatedOrders };
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