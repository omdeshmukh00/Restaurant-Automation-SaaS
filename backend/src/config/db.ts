import mongoose from 'mongoose';
import { env } from './env';
import logger from './logger';

let isConnected = false;
let listenersBound = false;

function bindConnectionListeners(): void {
  if (listenersBound) {
    return;
  }

  listenersBound = true;

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', { error: error.message });
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info('MongoDB reconnected');
  });
}

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  const connection = await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
  });

  isConnected = true;
  bindConnectionListeners();
  logger.info('MongoDB connection established', {
    host: connection.connection.host,
    database: connection.connection.name,
  });

  // Drop non-sparse email index on users collection if it exists to allow mongoose to recreate it with sparse: true
  try {
    const db = mongoose.connection.db;
    if (db) {
      const collections = await db.listCollections({ name: 'users' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('users').indexes();
        const hasNonSparseEmailIndex = indexes.some(
          (idx: any) => idx.name === 'email_1' && !idx.sparse
        );
        if (hasNonSparseEmailIndex) {
          logger.info('Dropping non-sparse email index on users collection to allow recreate');
          await db.collection('users').dropIndex('email_1');
        }
      }
    }
  } catch (err: any) {
    logger.warn('Failed to drop non-sparse email index', { error: err.message });
  }

  // Drop stale unique indexes on offers collection from old schema versions.
  // restaurantId_1_code_1 is from when the field was named "code" before it was renamed to "promoCode".
  // restaurantId_1_promoCode_1 was previously unique and is now non-unique.
  try {
    const db = mongoose.connection.db;
    if (db) {
      const collections = await db.listCollections({ name: 'offers' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('offers').indexes();
        const staleIndexes = ['restaurantId_1_code_1', 'restaurantId_1_promoCode_1'];
        for (const idxName of staleIndexes) {
          const idx = indexes.find((i: any) => i.name === idxName && i.unique === true);
          if (idx) {
            logger.info(`Dropping unique index ${idxName} on offers collection`);
            await db.collection('offers').dropIndex(idxName);
            logger.info(`Successfully dropped unique index ${idxName} on offers`);
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn('Failed to drop unique indexes on offers collection', { error: err.message });
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB connection closed');
}

export const connectDB = connectToDatabase;
export const disconnectDB = disconnectFromDatabase;
