/**
 * Parse data against a Zod schema, throwing a 400 HttpError with flattened
 * field errors on failure. Used by controllers to validate body/query/params.
 */
import { z, type ZodTypeAny } from 'zod';
import { HttpError } from './httpError.js';

export function parseOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw HttpError.badRequest('Validation failed', result.error.flatten());
  }
  return result.data;
}

export { z };
