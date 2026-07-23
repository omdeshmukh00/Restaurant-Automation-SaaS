import cron from 'node-cron';
import { ReservationsService } from '../modules/reservations/reservations.service';
import { logger } from '../config/logger';

/**
 * Activates reservations when their slot start time is reached.
 *
 * Every minute, this job:
 * 1. Finds CONFIRMED reservations where the slot time has been reached
 * 2. Sets the table status to RESERVED
 * 3. Sets reservationExpiresAt = now + 30 min (arrival window)
 * 4. Sets reservedAt = now
 * 5. Emits socket events for real-time dashboard updates
 */
export async function runReservationActivation(): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await ReservationsService.activatePendingReservations();

    if (result.activated > 0 || result.failed > 0) {
      logger.info('⏰ Reservation activation completed', {
        activated: result.activated,
        failed: result.failed,
        durationMs: Date.now() - startTime,
      });
    }
  } catch (error) {
    logger.error('CRITICAL: Failed to execute reservation activation job', { error });
  }
}

/**
 * Initializes and schedules the reservation activation job.
 * Runs every minute.
 */
export function startReservationActivationJob(): cron.ScheduledTask {
  const task = cron.schedule('* * * * *', async () => {
    logger.debug('Running scheduled reservation activation...');
    await runReservationActivation();
  });

  logger.info('⏰ Reservation activation cron job scheduled (every 1 minute)');
  return task;
}
