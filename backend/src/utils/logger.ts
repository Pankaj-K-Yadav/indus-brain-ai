/**
 * Structured application logger backed by Winston.
 *
 * - Production: single-line JSON (machine-parseable, ships to log aggregators).
 * - Development: colorized, human-readable lines with timestamps.
 *
 * Every entry carries `service: "indus-brain-ai"` via defaultMeta.
 */
import winston from 'winston';
import { env, isProduction } from '../config/index.js';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf((info) => {
    const { level, message, timestamp: ts, stack, service: _service, ...rest } = info;
    const restStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    return `${ts as string} [${level}] ${(stack as string) ?? (message as string)}${restStr}`;
  }),
);

const productionFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'indus-brain-ai' },
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});
