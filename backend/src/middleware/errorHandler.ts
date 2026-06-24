/**
 * Centralized error-handling middleware. Translates thrown errors into the
 * standard API error envelope. Must be registered last.
 */
import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/index.js';
import type { ApiError } from '../types/index.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isHttpError = err instanceof HttpError;
  const statusCode = isHttpError ? err.statusCode : 500;
  const message = isHttpError ? err.message : 'Internal Server Error';

  if (statusCode >= 500) {
    logger.error('Unhandled error', { error: String(err), stack: (err as Error)?.stack });
  } else {
    logger.warn('Request error', { statusCode, message });
  }

  const body: ApiError = {
    success: false,
    error: {
      message,
      statusCode,
      ...(isHttpError && err.details !== undefined ? { details: err.details } : {}),
      ...(!isProduction && !isHttpError ? { details: String(err) } : {}),
    },
  };

  res.status(statusCode).json(body);
};
