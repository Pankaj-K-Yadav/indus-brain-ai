/**
 * Async error wrapper. Wraps an async Express handler so any rejected promise
 * is forwarded to the centralized error-handling middleware via `next`,
 * removing the need for try/catch in every controller.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
