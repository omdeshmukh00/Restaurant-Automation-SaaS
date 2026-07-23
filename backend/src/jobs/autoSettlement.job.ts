// src/jobs/autoSettlement.job.ts
// Background job that automatically generates daily settlements for all restaurants.

import cron from 'node-cron';
import { SettlementService } from '../modules/settlement/settlement.service';
import { logger } from '../config/logger';

/**
 * Starts the auto-settlement cron job.
 * Runs daily at 2:00 AM (configurable via CRON_SETTLEMENT_TIME env var).
 */
export function startAutoSettlementJob(): void {
  const cronTime = process.env.CRON_SETTLEMENT_TIME ?? '0 2 * * *';

  if (!cron.validate(cronTime)) {
    logger.warn(`Invalid CRON_SETTLEMENT_TIME expression "${cronTime}". Settlement job disabled.`);
    return;
  }

  cron.schedule(cronTime, async () => {
    logger.info('[AutoSettlement] Starting daily settlement generation...');
    try {
      const count = await SettlementService.autoGenerateSettlements();
      logger.info(`[AutoSettlement] Generated ${count} settlements successfully.`);
    } catch (error) {
      logger.error('[AutoSettlement] Failed to generate settlements', { error });
    }
  });

  logger.info(`[AutoSettlement] Job scheduled with cron: ${cronTime}`);
}
