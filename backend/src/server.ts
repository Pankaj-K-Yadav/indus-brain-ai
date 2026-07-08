/**
 * Process entry point. Starts the HTTP listener, connects infrastructure, and
 * wires graceful shutdown.
 *
 * MongoDB connects in the background so the service stays available and reports
 * accurate DB status via GET /api/health even when the database is unreachable.
 */
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/index.js';
import { connectMongo, disconnectMongo } from './integrations/index.js';
import { terminateOcrWorker } from './services/ocr.service.js';
import { logger } from './utils/logger.js';

function registerProcessHandlers(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    server.close(() => {
      void Promise.allSettled([disconnectMongo(), terminateOcrWorker()])
        .then((results) => {
          for (const r of results) {
            if (r.status === 'rejected') {
              logger.error('Error during shutdown cleanup', { error: String(r.reason) });
            }
          }
        })
        .finally(() => process.exit(0));
    });

    // Force-exit if graceful shutdown stalls.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: String(error), stack: error.stack });
    process.exit(1);
  });
}

function bootstrap(): void {
  const app = createApp();

  const server: Server = app.listen(env.PORT, () => {
    logger.info(`INDUS-BRAIN AI backend listening on port ${env.PORT}`, {
      env: env.NODE_ENV,
    });
  });

  registerProcessHandlers(server);

  // Non-blocking: server is already accepting requests; DB connects in background.
  connectMongo().catch((error) => {
    logger.error('Initial MongoDB connection failed; continuing with degraded DB status', {
      error: String(error),
    });
  });
}

bootstrap();
