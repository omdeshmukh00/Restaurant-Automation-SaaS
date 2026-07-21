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
