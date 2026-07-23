import { createServer } from 'http';
import app from './app';
import { connectToDatabase, disconnectFromDatabase } from './config/db';
import { env } from './config/env';
import { initializeCollections } from './config/initDB';
import { seedDevelopmentData } from './config/seed';
import { logger } from './config/logger';
import { createSocketServer } from './sockets';
import { startBackgroundJobs } from './jobs';
import { verifySmtpConnection } from './services/mail.service';


const server = createServer(app);
createSocketServer(server);

let isDatabaseConnected = false;
let shutdownStarted = false;

async function validateRazorpayConfig(): Promise<void> {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    logger.warn(
      '⚠️ Razorpay is NOT configured. Payment operations will fail with "Razorpay is not configured". '
      + 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env to enable real payments.',
    );
  } else {
    logger.info('✅ Razorpay configured with key_id=' + keyId.slice(0, 8) + '...');
  }
}

async function bootstrap(): Promise<void> {
  try {
    // Validate Razorpay config early (logs a warning if missing, doesn't crash)
    validateRazorpayConfig();

    try {
      await connectToDatabase();
      isDatabaseConnected = true;
      await initializeCollections();
      if (env.seedOnStartup) {
        await seedDevelopmentData();
      }
      startBackgroundJobs();
      await verifySmtpConnection();
    } catch (error) {
      if (!env.allowNoDb) {
        throw error;
      }

      logger.warn('Database connection failed, continuing in no-db development mode', {
        error,
        mongoUri: env.MONGODB_URI,
      });
    }

    server.listen(env.PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`, {
        apiPrefix: env.API_PREFIX,
        databaseConnected: isDatabaseConnected,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.warn(`Received ${signal}. Starting graceful shutdown.`);

  server.close(async () => {
    if (isDatabaseConnected) {
      await disconnectFromDatabase();
    }

    logger.info('HTTP server closed');
    process.exit(0);
  });
}

void bootstrap();

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: reason });
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  void shutdown('uncaughtException');
});
