/**
 * Generic async retry with exponential backoff. Used for resilient calls to
 * external services (Gemini, ChromaDB).
 */
import { logger } from './logger.js';

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 8000, label = 'operation' } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      logger.warn('Retrying after failure', {
        label,
        attempt: attempt + 1,
        nextDelayMs: delay,
        error: String(error),
      });
      await sleep(delay);
    }
  }
  throw lastError;
}
