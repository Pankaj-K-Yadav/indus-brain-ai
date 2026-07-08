/**
 * Express application assembly. Wires global middleware, routes, and error
 * handling. Kept free of process / listener concerns (see server.ts).
 */
import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { corsOrigins } from './config/index.js';
import apiRoutes from './routes/index.js';
import {
  errorHandler,
  notFound,
  requestLogger,
  apiRateLimiter,
  aiRateLimiter,
} from './middleware/index.js';

export function createApp(): Application {
  const app = express();

  // Security & performance
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Structured request logging
  app.use(requestLogger);

  // Rate limiting: a broad cap on the whole API, tighter on the AI endpoints
  // that consume Gemini quota. Registered before the routes they protect.
  app.use('/api', apiRateLimiter);
  app.use(['/api/knowledge', '/api/rca', '/api/compliance', '/api/lessons'], aiRateLimiter);

  // API surface — exposes GET /api/health
  app.use('/api', apiRoutes);

  // 404 + centralized error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
