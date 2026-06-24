/**
 * MongoDB Atlas connection manager (Mongoose). Connection lifecycle and status
 * only — no schemas or queries live here.
 *
 * Connection events are wired once at module load so the rest of the app can
 * observe state changes (e.g. the health endpoint) without re-subscribing.
 */
import mongoose from 'mongoose';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected', { host: mongoose.connection.host });
});
mongoose.connection.on('error', (error: unknown) => {
  logger.error('MongoDB connection error', { error: String(error) });
});
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/** Human-readable connection status for the health endpoint. */
export function getMongoStatus(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
