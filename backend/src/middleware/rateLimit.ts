/**
 * Rate limiting. Protects the API from abuse / accidental floods and, critically,
 * caps how fast the expensive AI endpoints (which call Gemini and burn quota) can
 * be hit. Disabled under NODE_ENV=test so automated suites aren't throttled.
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/index.js';

const passthrough: RequestHandler = (_req, _res, next) => next();

function make(windowMs: number, max: number, message: string): RequestHandler {
  if (env.NODE_ENV === 'test') return passthrough;
  const limiter: RateLimitRequestHandler = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message, statusCode: 429 } },
  });
  return limiter;
}

/** Broad limiter applied to the whole API surface. */
export const apiRateLimiter = make(60_000, 200, 'Too many requests, please slow down.');

/** Tighter limiter for AI/LLM-backed endpoints that consume Gemini quota. */
export const aiRateLimiter = make(
  60_000,
  30,
  'Too many AI requests, please wait a moment before trying again.',
);
