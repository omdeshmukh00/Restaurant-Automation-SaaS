// src/config/initDB.ts
// Creates all collections defined in the PRD so they appear in MongoDB Compass.
// Collections are created empty if they don't already exist.

import mongoose from 'mongoose';
import logger from './logger';

/**
 * All collections from PRD Section 20 — MongoDB Collections
 */
const COLLECTIONS = [
  'users',
  'restaurants',
  'tables',
  'tableSessions',
  'reservations',
  'queues',
  'menuCategories',
  'menuItems',
  'carts',
  'orders',
  'kitchenBatches',
  'payments',
  'offers',
  'inventoryItems',
  'feedback',
  'notifications',
  'staffRequests',
  'staffShiftAssignments',
  'cleaningTasks',
  'auditLogs',
  'plans',
  'featureFlags',
] as const;

/**
 * Initialize database collections.
 * Creates collections that don't exist yet — idempotent (safe to call multiple times).
 */
export async function initializeCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) {
    logger.warn('Cannot initialize collections — no active database connection');
    return;
  }

  try {
    // Get list of existing collections
    const existing = await db.listCollections().toArray();
    const existingNames = new Set(existing.map((c) => c.name));

    let created = 0;
    for (const name of COLLECTIONS) {
      if (!existingNames.has(name)) {
        await db.createCollection(name);
        created++;
      }
    }

    if (created > 0) {
      logger.info(`📂 Created ${created} new collection(s) in database`);
    } else {
      logger.info('📂 All collections already exist');
    }

    // Run schema migration to clear placeholder emails
    try {
      const { UserModel } = await import('../modules/users/users.model');
      const { UserRole } = await import('../constants/roles');
      const result = await UserModel.updateMany(
        { role: UserRole.CUSTOMER, email: /@placeholder\.com$/ },
        { $unset: { email: "" } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`🧹 Cleaned up ${result.modifiedCount} placeholder emails from customer accounts`);
      }
    } catch (migError) {
      logger.error('Failed to run customer email migration:', migError);
    }

    // Migration: Sync tenantId to restaurantId for all documents that have restaurantId but missing tenantId
    try {
      const collectionsList = await db.listCollections().toArray();
      for (const colInfo of collectionsList) {
        const colName = colInfo.name;
        if (colName.startsWith('system.') || ['plans', 'featureFlags', 'restaurant_requests'].includes(colName)) {
          continue;
        }

        const col = db.collection(colName);
        const result = await col.updateMany(
          {
            restaurantId: { $exists: true, $ne: null },
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null },
              { tenantId: '' }
            ]
          },
          [
            {
              $set: {
                tenantId: { $toString: '$restaurantId' }
              }
            }
          ]
        );
        if (result.modifiedCount > 0) {
          logger.info(`🧹 Synced tenantId with restaurantId for ${result.modifiedCount} documents in '${colName}'`);
        }
      }
    } catch (migError) {
      logger.error('Failed to run tenantId synchronization migration:', migError);
    }
  } catch (error) {
    logger.error('Failed to initialize collections:', { error });
    // Non-fatal — app can still run without pre-created collections
  }
}

