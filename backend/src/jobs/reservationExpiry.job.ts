import cron from 'node-cron';
import { ReservationsService } from '../modules/reservations/reservations.service';
import { logger } from '../config/logger';

/**
 * Scans for expired reservations (no-show detection).
 *
 * Every minute, this job:
 * 1. Finds reservations where reservationExpiresAt < now and status is PENDING/CONFIRMED
 * 2. Marks them as NO_SHOW
 * 3. Increments noShowCount on the customer profile
 * 4. Releases the table back to AVAILABLE
 * 5. Emits socket events for live dashboard updates
 */
export async function runReservationExpiryCleanup(): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await ReservationsService.processExpiredReservations();

    if (result.processed > 0 || result.failed > 0) {
      logger.info('🧹 Reservation expiry cleanup completed', {
        processed: result.processed,
        failed: result.failed,
        durationMs: Date.now() - startTime,
      });
    }
  } catch (error) {
    logger.error('CRITICAL: Failed to execute reservation expiry cleanup job', { error });

    // Notify super admin about job failure
    try {
      const { NotificationsService } = await import('../modules/notifications/notifications.service');
      const { UserRole } = await import('../constants/roles');
      await NotificationsService.createNotification({
        restaurantId: new (await import('mongoose')).Types.ObjectId(),
        recipientRole: UserRole.RESTAURANT_ADMIN as any,
        title: 'Scheduled Job Failed',
        message: `Reservation expiry cleanup job failed. Error: ${(error as Error).message}`,
        type: 'SYSTEM_JOB_FAILED',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).catch(() => {});
    } catch {
      // Silent
    }
  }
}

/**
 * Initializes and schedules the reservation expiry cleanup job.
 * Runs every minute.
 */
export function startReservationExpiryJob(): cron.ScheduledTask {
  const task = cron.schedule('* * * * *', async () => {
    logger.debug('Running scheduled reservation expiry cleanup...');
    await runReservationExpiryCleanup();
  });

  logger.info('⏰ Reservation expiry cleanup cron job scheduled (every 1 minute)');
  return task;
}
