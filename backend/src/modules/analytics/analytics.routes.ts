import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { analyticsQuerySchema } from './analytics.schema';
import {
  getCustomerRetentionAnalytics,
  getOverviewAnalytics,
  getRevenueAnalytics,
  getPeakHoursAnalytics,
  getRepeatCustomersAnalytics,
  getKitchenPerformanceAnalytics,
  getTableUtilizationAnalytics,
  getSubscriptionUsageAnalytics,
  getReceiptAnalytics,
  getOrdersAnalyticsEndpoint,
  getTopSellingItemsEndpoint,
  getReservationAnalyticsEndpoint,
} from './analytics.controller';
import {
  getEmailSummary,
  getRecentEmails,
  getEmailTypes,
} from './emailAnalytics.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { roleGuard } from '../../middleware/roleGuard';
import { UserRole } from '../../constants/roles';

const router = Router();

router.get('/revenue', validate({ query: analyticsQuerySchema }), getRevenueAnalytics);
router.get('/peak-hours', validate({ query: analyticsQuerySchema }), getPeakHoursAnalytics);
router.get('/repeat-customers', validate({ query: analyticsQuerySchema }), getRepeatCustomersAnalytics);
router.get('/kitchen', validate({ query: analyticsQuerySchema }), getKitchenPerformanceAnalytics);
router.get('/table-utilization', validate({ query: analyticsQuerySchema }), getTableUtilizationAnalytics);
router.get('/customer-retention', validate({ query: analyticsQuerySchema }), getCustomerRetentionAnalytics);

// Legacy aliases retained to avoid breaking existing integrations while the team shifts to the updated PDF contract.
router.get('/overview', validate({ query: analyticsQuerySchema }), getOverviewAnalytics);
router.get('/tables', validate({ query: analyticsQuerySchema }), getTableUtilizationAnalytics);

// Reports analytics endpoints
router.get('/orders', validate({ query: analyticsQuerySchema }), getOrdersAnalyticsEndpoint);
router.get('/top-items', validate({ query: analyticsQuerySchema }), getTopSellingItemsEndpoint);
router.get('/reservations', validate({ query: analyticsQuerySchema }), getReservationAnalyticsEndpoint);

// Admin / Dashboard analytics
const adminRoles = [UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN];

router.get('/subscription-usage', requireAuth, roleGuard(...adminRoles), getSubscriptionUsageAnalytics);
router.get('/receipt-analytics', requireAuth, roleGuard(...adminRoles), getReceiptAnalytics);
router.get('/email-analytics/summary', requireAuth, roleGuard(...adminRoles), getEmailSummary);
router.get('/email-analytics/recent', requireAuth, roleGuard(...adminRoles), getRecentEmails);
router.get('/email-analytics/types', requireAuth, roleGuard(...adminRoles), getEmailTypes);

export default router;
