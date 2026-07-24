// src/modules/superAdmin/superAdmin.routes.ts

import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  restaurantIdParamSchema,
  restaurantListQuerySchema,
  createPlanSchema,
  updatePlanSchema,
  planIdParamSchema,
  bulkOffersSchema,
  featureFlagIdParamSchema,
  updateFeatureFlagSchema,
  analyticsQuerySchema,
  superAdminAuditLogQuerySchema,
  createRestaurantSchema,
  registerRestaurantSchema,
} from './superAdmin.schema';
import {
  getPlatformOverview,
  listRestaurants,
  createRestaurantController,
  getRestaurantById,
  approveRestaurant,
  suspendRestaurant,
  deleteRestaurant,
  createPlan,
  listPlans,
  updatePlan,
  applyBulkOffersController,
  listFeatureFlags,
  updateFeatureFlag,
  getRevenueAnalytics,
  getActiveTenantAnalytics,
  getSystemMonitoring,
  getPlatformAuditLogs,
  listRestaurantRequests,
  approveRestaurantRequest,
  rejectRestaurantRequest,
  deleteRestaurantRequest,
  getPlatformSettingsController,
  updatePlatformSettingsController,
  updateRestaurantStatusController,
  updateRestaurantPlanController,
  registerRestaurantController,
  getReservationQueueAnalyticsController,
  getAnalyticsChartsController,
  getPlatformAlertsController,
  updatePlatformAlertController,
  deletePlatformAlertController,
} from './superAdmin.controller';

const router = Router();

/*
|--------------------------------------------------------------------------
| PLATFORM SETTINGS
|--------------------------------------------------------------------------
*/

router.get('/platform-settings', getPlatformSettingsController);
router.patch('/platform-settings', updatePlatformSettingsController);

/*
|--------------------------------------------------------------------------
| RESTAURANT REQUESTS
|--------------------------------------------------------------------------
*/

router.get('/restaurant-requests', listRestaurantRequests);
router.post('/restaurant-requests/:id/approve', approveRestaurantRequest);
router.post('/restaurant-requests/:id/deny', rejectRestaurantRequest);
router.delete('/restaurant-requests/:id', deleteRestaurantRequest);

/*
|--------------------------------------------------------------------------
| PLATFORM OVERVIEW
|--------------------------------------------------------------------------
*/

// GET /super-admin/platform/overview
router.get('/platform/overview', getPlatformOverview);

/*
|--------------------------------------------------------------------------
| RESTAURANT MANAGEMENT
|--------------------------------------------------------------------------
*/

// GET /super-admin/restaurants
router.get(
  '/restaurants',
  validate({ query: restaurantListQuerySchema }),
  listRestaurants,
);

// POST /super-admin/restaurants
router.post(
  '/restaurants',
  validate({ body: createRestaurantSchema }),
  createRestaurantController,
);

// POST /super-admin/restaurants/register
router.post(
  '/restaurants/register',
  validate({ body: registerRestaurantSchema }),
  registerRestaurantController,
);

// GET /super-admin/restaurants/:id
router.get(
  '/restaurants/:id',
  validate({ params: restaurantIdParamSchema }),
  getRestaurantById,
);

// PATCH /super-admin/restaurants/:id/approve
router.patch(
  '/restaurants/:id/approve',
  validate({ params: restaurantIdParamSchema }),
  approveRestaurant,
);

// PATCH /super-admin/restaurants/:id/suspend
router.patch(
  '/restaurants/:id/suspend',
  validate({ params: restaurantIdParamSchema }),
  suspendRestaurant,
);

// PATCH /super-admin/restaurants/:id/status
router.patch(
  '/restaurants/:id/status',
  validate({ params: restaurantIdParamSchema }),
  updateRestaurantStatusController,
);

// PATCH /super-admin/restaurants/:id/plan
router.patch(
  '/restaurants/:id/plan',
  validate({ params: restaurantIdParamSchema }),
  updateRestaurantPlanController,
);

// DELETE /super-admin/restaurants/:id
router.delete(
  '/restaurants/:id',
  validate({ params: restaurantIdParamSchema }),
  deleteRestaurant,
);

/*
|--------------------------------------------------------------------------
| PLANS
|--------------------------------------------------------------------------
*/

// POST /super-admin/plans
router.post(
  '/plans',
  validate({ body: createPlanSchema }),
  createPlan,
);

// GET /super-admin/plans
router.get('/plans', listPlans);

// POST /super-admin/plans/bulk-offers
router.post(
  '/plans/bulk-offers',
  validate({ body: bulkOffersSchema }),
  applyBulkOffersController,
);

// PATCH /super-admin/plans/:id
router.patch(
  '/plans/:id',
  validate({ params: planIdParamSchema, body: updatePlanSchema }),
  updatePlan,
);

/*
|--------------------------------------------------------------------------
| FEATURE FLAGS
|--------------------------------------------------------------------------
*/

// GET /super-admin/feature-flags
router.get('/feature-flags', listFeatureFlags);

// PATCH /super-admin/feature-flags/:id
router.patch(
  '/feature-flags/:id',
  validate({ params: featureFlagIdParamSchema, body: updateFeatureFlagSchema }),
  updateFeatureFlag,
);

/*
|--------------------------------------------------------------------------
| ANALYTICS
|--------------------------------------------------------------------------
*/

// GET /super-admin/analytics/revenue
router.get(
  '/analytics/revenue',
  validate({ query: analyticsQuerySchema }),
  getRevenueAnalytics,
);

// GET /super-admin/analytics/tenants
router.get(
  '/analytics/tenants',
  validate({ query: analyticsQuerySchema }),
  getActiveTenantAnalytics,
);

/*
|--------------------------------------------------------------------------
| SYSTEM MONITORING
|--------------------------------------------------------------------------
*/

// GET /super-admin/system/monitoring
router.get('/system/monitoring', getSystemMonitoring);

// GET /super-admin/analytics/reservation-queue
router.get('/analytics/reservation-queue', getReservationQueueAnalyticsController);

// GET /super-admin/analytics/charts
router.get('/analytics/charts', getAnalyticsChartsController);

/*
|--------------------------------------------------------------------------
| AUDIT LOGS (platform-wide)
|--------------------------------------------------------------------------
*/

// GET /super-admin/audit-logs
router.get(
  '/audit-logs',
  validate({ query: superAdminAuditLogQuerySchema }),
  getPlatformAuditLogs,
);

/*
|--------------------------------------------------------------------------
| PLATFORM SYSTEM ALERTS
|--------------------------------------------------------------------------
*/

// GET /super-admin/alerts
router.get('/alerts', getPlatformAlertsController);

// PATCH /super-admin/alerts/:id
router.patch('/alerts/:id', updatePlatformAlertController);

// DELETE /super-admin/alerts/:id
router.delete('/alerts/:id', deletePlatformAlertController);

export default router;