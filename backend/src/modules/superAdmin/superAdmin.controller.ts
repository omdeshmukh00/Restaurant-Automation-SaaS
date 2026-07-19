// src/modules/superAdmin/superAdmin.controller.ts

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/responses';
import * as superAdminService from './superAdmin.service';
import type {
  RestaurantListQuery,
  AnalyticsQuery,
  SuperAdminAuditLogQuery,
  RegisterRestaurantInput,
} from './superAdmin.schema';

// ──────────────────────────────────────────────────────────────────────
// PLATFORM OVERVIEW
// ──────────────────────────────────────────────────────────────────────

export const getPlatformOverview = asyncHandler(async (req: Request, res: Response) => {
  const result = await superAdminService.getPlatformOverview();
  ok(res, result);
});

// ──────────────────────────────────────────────────────────────────────
// RESTAURANT MANAGEMENT
// ──────────────────────────────────────────────────────────────────────

export const listRestaurants = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as RestaurantListQuery;
  const result = await superAdminService.listRestaurants(query);
  ok(res, result);
});

export const getRestaurantById = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await superAdminService.getRestaurantById(req.params.id);
  ok(res, { restaurant });
});

export const approveRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await superAdminService.approveRestaurant(req.params.id);
  ok(res, { restaurant });
});

import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { socketService } from '../../sockets/socket.service';

export const listRestaurantRequests = asyncHandler(async (req: Request, res: Response) => {
  const requests = await superAdminService.listRestaurantRequests();
  ok(res, requests);
});

export const approveRestaurantRequest = asyncHandler(async (req: Request, res: Response) => {
  const reviewerId = req.user!.id;
  const result = await superAdminService.approveRestaurantRequest(req.params.id, reviewerId);
  
  socketService.emitToSuperAdmin('restaurant_request_approved', { id: req.params.id });
  ok(res, { success: true, ...result });
});

export const rejectRestaurantRequest = asyncHandler(async (req: Request, res: Response) => {
  const reviewerId = req.user!.id;
  const { reason, refund } = req.body;
  if (!reason) {
    throw new AppError('Rejection reason is required', 400, ErrorCode.INVALID_REQUEST);
  }

  const result = await superAdminService.rejectRestaurantRequest(
    req.params.id,
    reviewerId,
    reason,
    !!refund
  );
  
  socketService.emitToSuperAdmin('restaurant_request_rejected', { id: req.params.id, reason });
  ok(res, { success: true, request: result });
});

import { getPlatformSettings } from './platformSettings.model';

export const getPlatformSettingsController = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  
  const { RestaurantRequestModel } = await import('./restaurantRequest.model');
  const paidRequests = await RestaurantRequestModel.find({
    paymentStatus: 'CAPTURED',
    paymentAmount: { $gt: 0 }
  }).setOptions({ bypassTenant: true }).lean();

  const totalRevenue = paidRequests.reduce((sum: number, r: any) => sum + (r.paymentAmount || 0), 0);

  const history = paidRequests.map((r: any) => ({
    id: r._id.toString(),
    restaurantName: r.restaurantName,
    ownerName: r.ownerName,
    amount: r.paymentAmount,
    currency: r.paymentCurrency || 'INR',
    paymentId: r.paymentId,
    timestamp: r.paymentTimestamp || r.updatedAt
  }));

  const { SubscriptionPaymentModel } = await import('../subscriptions/subscriptions.model');
  const paidSubscriptions = await SubscriptionPaymentModel.find({
    status: 'completed'
  })
    .populate('restaurantId')
    .setOptions({ bypassTenant: true })
    .lean();

  const totalSubscriptionRevenue = paidSubscriptions.reduce((sum: number, sp: any) => sum + (sp.amount || 0), 0);

  const subscriptionHistory = paidSubscriptions.map((sp: any) => ({
    id: sp._id.toString(),
    restaurantName: sp.restaurantId?.name || 'Unknown Restaurant',
    ownerName: sp.restaurantId?.ownerName || 'Unknown Owner',
    amount: sp.amount,
    currency: sp.currency || 'INR',
    paymentId: sp.providerPaymentId || sp.providerOrderId || sp._id.toString(),
    timestamp: sp.paidAt || sp.createdAt
  }));

  ok(res, {
    ...settings.toObject(),
    totalRevenue,
    history,
    totalSubscriptionRevenue,
    subscriptionHistory
  });
});

export const updatePlatformSettingsController = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  
  const fields = [
    'platformName', 'supportEmail', 'timezone', 'language', 'dateFormat', 'maintenanceMode',
    'disableCustomerPanel', 'disableKitchenPanel', 'disableStaffPanel', 'disableCleaningPanel', 'disableAdminPanel',
    'applicationFeeEnabled', 'applicationFeeAmount', 'currency', 
    'refundPolicy', 'enablePartnerRegistration', 
    'maxPendingApplications', 'applicationExpiryDays',
    'platformCommissionRate',
    'notificationEmail', 'emailNotifications', 'pushNotifications', 'inAppPreferences'
  ];

  const wasMaintenanceOn = settings.maintenanceMode;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      (settings as any)[field] = req.body[field];
    }
  }

  // If maintenanceMode was just enabled, turn ON all panel disable flags
  if (req.body.maintenanceMode === true && !wasMaintenanceOn) {
    settings.disableCustomerPanel = true;
    settings.disableKitchenPanel = true;
    settings.disableStaffPanel = true;
    settings.disableCleaningPanel = true;
    settings.disableAdminPanel = true;

    // Dispatch maintenance notice emails asynchronously
    import('../../services/mail.service').then(({ sendMaintenanceNoticeEmailToAllUsers }) => {
      sendMaintenanceNoticeEmailToAllUsers().catch((err) => {
        console.error('Failed to send maintenance notice emails:', err);
      });
    });
  }

  await settings.save();
  ok(res, settings);
});

export const suspendRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await superAdminService.suspendRestaurant(req.params.id);
  ok(res, { restaurant });
});

export const deleteRestaurant = asyncHandler(async (req: Request, res: Response) => {
  await superAdminService.deleteRestaurant(req.params.id);
  ok(res, { message: 'Restaurant deleted successfully' });
});

// ──────────────────────────────────────────────────────────────────────
// PLANS
// ──────────────────────────────────────────────────────────────────────

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await superAdminService.createPlan(req.body);
  ok(res, { plan }, 201);
});

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const plans = await superAdminService.listPlans();
  ok(res, { plans });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await superAdminService.updatePlan(req.params.id, req.body);
  ok(res, { plan });
});

export const applyBulkOffersController = asyncHandler(async (req: Request, res: Response) => {
  const result = await superAdminService.applyBulkOffers(req.body);
  ok(res, result);
});

// ──────────────────────────────────────────────────────────────────────
// FEATURE FLAGS
// ──────────────────────────────────────────────────────────────────────

export const listFeatureFlags = asyncHandler(async (req: Request, res: Response) => {
  const flags = await superAdminService.listFeatureFlags();
  ok(res, { flags });
});

export const updateFeatureFlag = asyncHandler(async (req: Request, res: Response) => {
  const flag = await superAdminService.updateFeatureFlag(req.params.id, req.body);
  ok(res, { flag });
});

// ──────────────────────────────────────────────────────────────────────
// ANALYTICS
// ──────────────────────────────────────────────────────────────────────

export const getRevenueAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as AnalyticsQuery;
  const result = await superAdminService.getRevenueAnalytics(query);
  ok(res, result);
});

export const getActiveTenantAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as AnalyticsQuery;
  const result = await superAdminService.getActiveTenantAnalytics(query);
  ok(res, result);
});

export const getSystemMonitoring = asyncHandler(async (req: Request, res: Response) => {
  const result = await superAdminService.getSystemMonitoring();
  ok(res, result);
});

// ──────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ──────────────────────────────────────────────────────────────────────

export const getPlatformAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as SuperAdminAuditLogQuery;
  const result = await superAdminService.getPlatformAuditLogs(query);
  ok(res, result);
});

export const updateRestaurantStatusController = asyncHandler(async (req: Request, res: Response) => {
  const { status, blockReason } = req.body;
  if (!status || !['Active', 'Trial', 'Inactive'].includes(status)) {
    throw new AppError('Invalid status value. Must be Active, Trial, or Inactive', 400, ErrorCode.INVALID_REQUEST);
  }

  const restaurant = await superAdminService.updateRestaurantStatus(req.params.id, status, blockReason);
  ok(res, { restaurant });
});

export const updateRestaurantPlanController = asyncHandler(async (req: Request, res: Response) => {
  const { plan } = req.body;
  if (!plan) {
    throw new AppError('Plan name is required', 400, ErrorCode.INVALID_REQUEST);
  }

  const restaurant = await superAdminService.updateRestaurantPlan(req.params.id, plan);
  ok(res, { restaurant });
});

export const registerRestaurantController = asyncHandler(async (req: Request, res: Response) => {
  const reviewerId = req.user!.id;
  const input = req.body as RegisterRestaurantInput;
  const result = await superAdminService.registerRestaurantDirectly(input, reviewerId);
  ok(res, { success: true, ...result }, 201);
});

export const getReservationQueueAnalyticsController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await superAdminService.getReservationQueueAnalytics();
  ok(res, result);
});

export const getAnalyticsChartsController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await superAdminService.getAnalyticsCharts();
  ok(res, result);
});

export const getPlatformAlertsController = asyncHandler(async (req: Request, res: Response) => {
  const { status, type } = req.query;
  const filter: any = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  const result = await superAdminService.getPlatformAlerts(filter);
  ok(res, result);
});

export const updatePlatformAlertController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['new', 'acknowledged', 'resolved'].includes(status)) {
    throw new AppError('Invalid alert status', 400, ErrorCode.INVALID_REQUEST);
  }

  const result = await superAdminService.updatePlatformAlert(id, status);
  ok(res, result);
});

export const deletePlatformAlertController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await superAdminService.deletePlatformAlert(id);
  ok(res, { success: true });
});