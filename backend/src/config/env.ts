/**
 * Typed, validated environment configuration. Loaded once at startup; the
 * process fails fast if required variables are missing or malformed.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  CHROMA_URL: z.string().url().default('http://localhost:8000'),
  CHROMA_COLLECTION: z.string().default('indus_brain_knowledge'),

  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(25),

  // Knowledge pipeline tuning
  CHUNK_SIZE: z.coerce.number().int().positive().default(1000),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(150),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  RAG_TOP_K: z.coerce.number().int().positive().default(6),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.4),
  // Minimum answer confidence; below this the assistant politely refuses.
  RAG_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.45),

  // Root Cause Analysis agent — retrieves broader evidence to correlate across
  // maintenance / incident / inspection / manual documents.
  RCA_TOP_K: z.coerce.number().int().positive().default(10),
  RCA_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.35),

  // Compliance Intelligence — SOP vs. regulation comparison.
  COMPLIANCE_MAX_CHARS: z.coerce.number().int().positive().default(8000),
  COMPLIANCE_MAX_CHUNKS: z.coerce.number().int().positive().default(40),
  COMPLIANCE_REGULATION_CATEGORY: z.string().default('regulation'),

  // Lessons Learned — evidence sampled for the AI summary.
  LESSONS_TOP_K: z.coerce.number().int().positive().default(12),

  // OCR fallback for scanned / image-only PDFs (only runs when no text is found)
  OCR_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  OCR_LANGUAGE: z.string().default('eng'),
  OCR_MAX_PAGES: z.coerce.number().int().positive().default(20),

  // Knowledge graph entity/relationship extraction (MongoDB-backed, best-effort)
  KG_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  KG_MAX_CHARS: z.coerce.number().int().positive().default(8000),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
