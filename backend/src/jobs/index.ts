import { startExpireSessionsJob } from './expireSessions.job';
import { startDailySalesReportJob } from './dailySalesReport.job';
import { startReservationReminderJob } from './reservationReminder.job';
import { startSubscriptionsLifecycleJob } from './subscriptionsLifecycle.job';
import { startSubscriptionUsageAggregationJob } from './subscriptionUsageAggregation.job';
import { startReservationExpiryJob } from './reservationExpiry.job';
import { startReservationActivationJob } from './reservationActivation.job';
import { startAutoSettlementJob } from './autoSettlement.job';
import { logger } from '../config/logger';

/**
 * Orchestrates and starts all background jobs for the SaaS backend cleanly.
 * Called once during server boot.
 */
export function startBackgroundJobs(): void {
  try {
    startExpireSessionsJob();
    startDailySalesReportJob();
    startReservationReminderJob();
    startSubscriptionsLifecycleJob();
    startSubscriptionUsageAggregationJob();
    startReservationExpiryJob();
    startReservationActivationJob();
    startAutoSettlementJob();
    logger.info('All background cron jobs successfully initialized');
  } catch (error) {
    logger.error('Failed to initialize background cron jobs', { error });
  }
}
