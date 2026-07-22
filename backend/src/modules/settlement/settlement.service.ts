// src/modules/settlement/settlement.service.ts
// Settlement service — generates settlement records from paid orders.

import mongoose, { Types } from 'mongoose';
import { SettlementModel, SettlementStatus, ISettlement } from './settlement.model';
import { OrderModel } from '../orders/orders.model';
import { OrderStatus } from '../../constants/statuses';
import { PaymentStatus } from '../orders/orders.schema';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { getPlatformSettings } from '../superAdmin/platformSettings.model';
import { logger } from '../../config/logger';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../constants/roles';
import { NotificationCategory, NotificationPriority } from '../notifications/notifications.schema';

function toObjectId(value: string | Types.ObjectId): Types.ObjectId {
  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}

function startOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export class SettlementService {
  /**
   * Get platform commission rate from platform settings.
   */
  static async getCommissionRate(): Promise<number> {
    try {
      const settings = await getPlatformSettings();
      return settings?.platformCommissionRate ?? 10;
    } catch {
      return 10;
    }
  }

  /**
   * Generate a settlement for a specific restaurant and date range.
   * Aggregates all paid/completed orders within the period.
   */
  static async generateSettlement(
    restaurantId: string | Types.ObjectId,
    from: Date,
    to: Date,
  ): Promise<ISettlement> {
    const restId = toObjectId(restaurantId);

    // Find all paid/completed orders in the period
    const orders = await OrderModel.find({
      restaurantId: restId,
      status: { $in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      paymentStatus: PaymentStatus.PAID,
      createdAt: { $gte: from, $lte: to },
    }).lean();

    if (orders.length === 0) {
      throw new AppError(
        'No paid orders found in the specified period',
        400,
        ErrorCode.INVALID_REQUEST,
      );
    }

    const orderIds = orders.map((o) => o._id as Types.ObjectId);

    // Calculate aggregates from order snapshots
    const grossSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const discounts = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const taxableAmount = orders.reduce((sum, o) => sum + ((o as any).taxableAmount ?? (o.totalAmount - o.discountAmount)), 0);
    const gstCollected = orders.reduce((sum, o) => sum + ((o as any).totalGST ?? 0), 0);
    const commissionRate = await this.getCommissionRate();
    const platformCommission = Math.round(((grossSales - discounts) * commissionRate) / 100 * 100) / 100;

    const netSettlement = Math.max(0, Math.round(((grossSales - discounts) - platformCommission) * 100) / 100);

    const settlement = await SettlementModel.create({
      restaurantId: restId,
      settlementPeriod: { from, to },
      orderIds,
      grossSales: Math.round(grossSales * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      gstCollected: Math.round(gstCollected * 100) / 100,
      platformCommissionRate: commissionRate,
      platformCommission,
      refunds: 0,
      netSettlement,
      status: SettlementStatus.GENERATED,
      generatedAt: new Date(),
    });

    // Notify admin about settlement generation
    NotificationsService.createNotification({
      restaurantId: restId.toString(),
      recipientRole: UserRole.RESTAURANT_ADMIN,
      title: 'Settlement Generated',
      message: `Settlement for period ${from.toLocaleDateString()} - ${to.toLocaleDateString()} has been generated. Net amount: ₹${netSettlement.toFixed(2)}.`,
      type: 'SETTLEMENT_GENERATED',
      entityId: settlement._id.toString(),
      actionUrl: '/admin/settlements',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    }).catch(() => {});

    return settlement;
  }

  /**
   * Auto-generate settlements for all restaurants.
   * Called by the background job.
   */
  static async autoGenerateSettlements(): Promise<number> {
    let count = 0;
    try {
      const { RestaurantModel } = await import('../restaurants/restaurants.model');
      const restaurants = await RestaurantModel.find({ isDeleted: { $ne: true } }).lean();
      const now = new Date();
      const to = endOfDay(now);
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)); // Daily

      for (const restaurant of restaurants) {
        try {
          // Skip if settlement already exists for this period
          const existing = await SettlementModel.findOne({
            restaurantId: restaurant._id,
            'settlementPeriod.from': from,
            'settlementPeriod.to': to,
          });
          if (existing) continue;

          await this.generateSettlement(restaurant._id, from, to);
          count++;
        } catch (err: any) {
          if (err.code !== ErrorCode.INVALID_REQUEST) {
            logger.error('Auto-settlement failed for restaurant', {
              restaurantId: restaurant._id,
              error: err.message,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Auto-settlement iteration failed', { error });
    }
    return count;
  }

  /**
   * Get settlements for a restaurant.
   */
  static async getSettlements(
    restaurantId: string | Types.ObjectId,
    options: { status?: SettlementStatus; page?: number; limit?: number } = {},
  ) {
    const page = Number(options.page ?? 1);
    const limit = Number(options.limit ?? 20);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      restaurantId: toObjectId(restaurantId),
    };

    if (options.status) {
      query.status = options.status;
    }

    const [settlements, total] = await Promise.all([
      SettlementModel.find(query)
        .sort({ 'settlementPeriod.to': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SettlementModel.countDocuments(query),
    ]);

    return {
      settlements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single settlement by ID.
   */
  static async getSettlementById(
    restaurantId: string | Types.ObjectId,
    settlementId: string | Types.ObjectId,
  ) {
    const settlement = await SettlementModel.findOne({
      _id: toObjectId(settlementId),
      restaurantId: toObjectId(restaurantId),
    }).lean();

    if (!settlement) {
      throw new AppError('Settlement not found', 404, ErrorCode.NOT_FOUND);
    }

    // Populate order details
    const orders = await OrderModel.find({
      _id: { $in: settlement.orderIds },
    })
      .select('orderNumber totalAmount discountAmount finalAmount status createdAt')
      .lean();

    return { ...settlement, orders };
  }

  /**
   * Mark a settlement as PAID (admin action).
   */
  static async markSettlementPaid(
    restaurantId: string | Types.ObjectId,
    settlementId: string | Types.ObjectId,
  ) {
    const settlement = await SettlementModel.findOne({
      _id: toObjectId(settlementId),
      restaurantId: toObjectId(restaurantId),
    });

    if (!settlement) {
      throw new AppError('Settlement not found', 404, ErrorCode.NOT_FOUND);
    }

    if (settlement.status === SettlementStatus.PAID) {
      return settlement;
    }

    settlement.status = SettlementStatus.PAID;
    settlement.paidAt = new Date();
    await settlement.save();

    // Notify admin about settlement completion
    NotificationsService.createNotification({
      restaurantId: restaurantId.toString(),
      recipientRole: UserRole.RESTAURANT_ADMIN,
      title: 'Settlement Completed',
      message: `Settlement of ₹${settlement.netSettlement.toFixed(2)} has been marked as paid.`,
      type: 'SETTLEMENT_COMPLETED',
      entityId: settlement._id.toString(),
      actionUrl: '/admin/settlements',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    }).catch(() => {});

    return settlement;
  }

  /**
   * Get settlement summary metrics for dashboard.
   */
  static async getSettlementSummary(restaurantId: string | Types.ObjectId) {
    const restId = toObjectId(restaurantId);

    const [pendingCount, paidCount, totalSummary] = await Promise.all([
      SettlementModel.countDocuments({ restaurantId: restId, status: SettlementStatus.GENERATED }),
      SettlementModel.countDocuments({ restaurantId: restId, status: SettlementStatus.PAID }),
      SettlementModel.aggregate([
        { $match: { restaurantId: restId } },
        {
          $group: {
            _id: null,
            totalGrossSales: { $sum: '$grossSales' },
            totalGstCollected: { $sum: '$gstCollected' },
            totalPlatformCommission: { $sum: '$platformCommission' },
            totalNetSettlement: { $sum: '$netSettlement' },
            totalSettlements: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = totalSummary[0] ?? {
      totalGrossSales: 0,
      totalGstCollected: 0,
      totalPlatformCommission: 0,
      totalNetSettlement: 0,
      totalSettlements: 0,
    };

    return {
      pendingSettlements: pendingCount,
      completedSettlements: paidCount,
      totalSettlements: summary.totalSettlements,
      totalGrossSales: summary.totalGrossSales,
      totalGstCollected: summary.totalGstCollected,
      totalPlatformCommission: summary.totalPlatformCommission,
      totalNetSettlement: summary.totalNetSettlement,
    };
  }
}
