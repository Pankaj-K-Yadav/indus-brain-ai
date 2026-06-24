export { env, isProduction, isDevelopment } from './env.js';
export type { Env } from './env.js';

import path from 'node:path';
import { env } from './env.js';

/**
 * Allowed CORS origins parsed from the comma-separated CORS_ORIGIN env value.
 */
export const corsOrigins: string[] = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** Absolute path to the local file-upload directory. */
export const uploadDir: string = path.resolve(process.cwd(), env.UPLOAD_DIR);
