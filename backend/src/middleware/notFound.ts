/**
 * Catch-all middleware for unmatched routes. Forwards a 404 to the error handler.
 */
import type { RequestHandler } from 'express';
import { HttpError } from '../utils/httpError.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
