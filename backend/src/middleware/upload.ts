/**
 * File upload middleware (multer). Stores PDF/DOCX files on local disk under
 * the configured upload directory and rejects unsupported types or oversized
 * files with a 400 error.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env, uploadDir } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/httpError.js';
import { resolveFileType } from '../models/document.model.js';

mkdirSync(uploadDir, { recursive: true });
logger.info('Upload directory ready', { uploadDir });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const multerUpload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Resolve by MIME type, falling back to extension (browsers send inconsistent
    // MIME types for CSV/images), so legitimate uploads aren't wrongly rejected.
    if (resolveFileType(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(
        HttpError.badRequest(
          `Unsupported file type "${file.mimetype}". Allowed: PDF, DOCX, XLSX, CSV, PNG, JPG.`,
        ),
      );
    }
  },
});

/**
 * Wraps multer's single-file handler so multer-specific errors (e.g. file size
 * limit) are normalized into HttpError before reaching the error handler.
 */
export function uploadSingle(field: string): RequestHandler {
  return (req, res, next) => {
    multerUpload.single(field)(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `File exceeds the ${env.MAX_FILE_SIZE_MB}MB size limit`
            : err.message;
        next(HttpError.badRequest(message));
        return;
      }
      next(err);
    });
  };
}
