// src/modules/superAdmin/superAdmin.service.ts
// All DB logic for super admin operations.
// Controllers stay thin — everything lives here.

import mongoose, { FilterQuery } from 'mongoose';
import { RestaurantModel } from '../restaurants/restaurants.model';
import { UserModel } from '../users/users.model';
import { PlatformPlanModel, FeatureFlagModel } from './superAdmin.model';
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

  const query: FilterQuery<typeof RestaurantModel> = {};

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
  const restaurant = await RestaurantModel.findByIdAndDelete(id).lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

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
  const [
    totalRestaurants,
    activeRestaurants,
    totalUsers,
    activeSessions,
  ] = await Promise.all([
    RestaurantModel.countDocuments(),
    RestaurantModel.countDocuments({ status: RestaurantStatus.ACTIVE }),
    UserModel.countDocuments(),
    TableSessionModel.countDocuments({ status: 'ACTIVE' }),
  ]);

  return {
    totalRestaurants,
    activeRestaurants,
    suspendedRestaurants: totalRestaurants - activeRestaurants,
    totalUsers,
    activeSessions,
  };
}

export async function getRevenueAnalytics(query: AnalyticsQuery) {
  const { groupBy = 'day', from, to } = query;
  const { start, end } = getDateRange(groupBy, from, to);
  const groupFormat = getGroupByFormat(groupBy);

  // Import OrderModel here to avoid circular deps
  const { OrderModel } = await import('../orders/orders.model');

  const revenue = await OrderModel.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['COMPLETED', 'SERVED'] },
      },
    },
    {
      $group: {
        _id:          groupFormat,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders:  { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  return {
    groupBy,
    from: start.toISOString(),
    to:   end.toISOString(),
    data: revenue,
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
    RestaurantModel.countDocuments(),
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
import { sendRestaurantApprovalEmail, sendRestaurantRejectionEmail, sendRestaurantPlanUpdatedEmail, sendRestaurantSuspendedEmail, sendRestaurantActivatedEmail } from '../../services/mail.service';
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
}

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

export async function updateRestaurantPlan(id: string, planName: string) {
  const restaurant = await RestaurantModel.findById(id);
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  const oldPlan = restaurant.plan || 'Basic';
  if (oldPlan.toLowerCase() === planName.toLowerCase()) {
    return restaurant.toObject();
  }

  if (restaurant.email) {
    const onCooldown = await isEmailOnCooldown(restaurant.email);
    if (onCooldown) {
      throw new AppError('This restaurant is on email cooldown. Please wait 60s before updating again.', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    }
  }

  restaurant.plan = planName;
  await restaurant.save();

  // Determine upgrade vs demotion based on plan pricing
  let isUpgrade = true;
  try {
    const [oldPlanDoc, newPlanDoc] = await Promise.all([
      PlatformPlanModel.findOne({ name: oldPlan }),
      PlatformPlanModel.findOne({ name: planName }),
    ]);
    if (oldPlanDoc && newPlanDoc) {
      isUpgrade = newPlanDoc.priceMonthly >= oldPlanDoc.priceMonthly;
    }
  } catch (err) {
    logger.error('Failed to compare plan prices', err);
  }

  if (restaurant.email) {
    const onCooldown = await isEmailOnCooldown(restaurant.email);
    if (!onCooldown) {
      void sendRestaurantPlanUpdatedEmail(
        restaurant.email,
        restaurant.ownerName || 'Owner',
        restaurant.name,
        oldPlan,
        planName,
        isUpgrade
      );
    } else {
      logger.info(`Throttling plan update email to ${restaurant.email} due to 60s cooldown`);
    }
  }

  return restaurant.toObject();
}