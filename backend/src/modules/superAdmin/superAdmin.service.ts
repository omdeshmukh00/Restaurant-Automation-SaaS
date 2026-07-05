// src/modules/superAdmin/superAdmin.service.ts
// All DB logic for super admin operations.
// Controllers stay thin — everything lives here.

import mongoose, { FilterQuery } from 'mongoose';
import { RestaurantModel } from '../restaurants/restaurants.model';
import { UserModel } from '../users/users.model';
import { PlatformPlanModel, FeatureFlagModel } from './superAdmin.model';
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

  return {
    restaurants,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRestaurantById(id: string) {
  const restaurant = await RestaurantModel.findById(id).lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, ErrorCode.NOT_FOUND);
  }

  return restaurant;
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

export async function listPlans() {
  return PlatformPlanModel.find().sort({ priceMonthly: 1 }).lean();
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
    return plan;
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
import {AuditEntity } from '../auditLogs/auditLogs.types';
import crypto from 'crypto';
import { slugify, uniqueSlug } from '../../utils/slugify';
import { hashPassword } from '../../utils/crypto';
import { sendRestaurantApprovalEmail, sendRestaurantRejectionEmail } from '../../services/mail.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export async function listRestaurantRequests() {
  const requests = await RestaurantRequestModel.find({ status: 'PENDING' })
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
    plan: req.selectedPlan,
    requestedAt: req.submittedAt.toISOString(),
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
  }));
}

export async function approveRestaurantRequest(requestId: string, reviewerId: string) {
  const request = await RestaurantRequestModel.findById(requestId).setOptions({ bypassTenant: true });
  if (!request) {
    throw new AppError('Restaurant request not found', 404, ErrorCode.NOT_FOUND);
  }
  if (request.status !== 'PENDING') {
    throw new AppError('Request is already processed', 400, ErrorCode.INVALID_REQUEST);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const restaurantId = new mongoose.Types.ObjectId();
    const tenantId = `tenant_${crypto.randomBytes(6).toString('hex')}`;
    
    // Generate unique slug
    let slug = slugify(request.restaurantName);
    const existingRest = await RestaurantModel.findOne({ slug }).setOptions({ bypassTenant: true });
    if (existingRest) {
      slug = uniqueSlug(request.restaurantName);
    }

    // Step 1: Create Restaurant
    const [restaurant] = await RestaurantModel.create([{
      _id: restaurantId,
      slug,
      name: request.restaurantName,
      status: 'ACTIVE',
      plan: request.selectedPlan,
      cuisine: request.cuisine,
      city: request.city,
      rating: 4.5,
      tenantId: tenantId,
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
    request.status = 'APPROVED';
    request.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
    request.reviewedAt = new Date();
    await request.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Log Audits
    void logAuditRaw({
      actorId: reviewerId,
      actorRole: 'super-admin',
      entityType: AuditEntity.RESTAURANT,
      entityId: restaurantId.toString(),
      action: 'SUPER_RESTAURANT_APPROVED' as any,
      metadata: { requestId, tenantId, slug },
    });

    void logAuditRaw({
      actorId: adminUser._id.toString(),
      actorRole: 'restaurant-admin',
      restaurantId: restaurantId.toString(),
      entityType: AuditEntity.USER,
      entityId: adminUser._id.toString(),
      action: 'ADMIN_CREATED' as any,
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
          action: 'APPROVAL_EMAIL_SENT' as any,
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

export async function rejectRestaurantRequest(requestId: string, reviewerId: string, rejectionReason: string) {
  const request = await RestaurantRequestModel.findById(requestId).setOptions({ bypassTenant: true });
  if (!request) {
    throw new AppError('Restaurant request not found', 404, ErrorCode.NOT_FOUND);
  }
  if (request.status !== 'PENDING') {
    throw new AppError('Request is already processed', 400, ErrorCode.INVALID_REQUEST);
  }

  request.status = 'REJECTED';
  request.rejectionReason = rejectionReason;
  request.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
  request.reviewedAt = new Date();
  await request.save();

  // Log Audit
  void logAuditRaw({
    actorId: reviewerId,
    actorRole: 'super-admin',
    entityType: AuditEntity.RESTAURANT,
    entityId: requestId,
    action: 'RESTAURANT_REJECTED' as any,
    metadata: { reason: rejectionReason },
  });

  // Send Rejection Email in background to avoid blocking request rejection
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
        action: 'REJECTION_EMAIL_SENT' as any,
        metadata: { recipient: request.email, reason: rejectionReason },
      });
    }
  }).catch((err) => {
    logger.error('Failed to send restaurant rejection email:', { error: err, email: request.email });
  });

  return request;
}