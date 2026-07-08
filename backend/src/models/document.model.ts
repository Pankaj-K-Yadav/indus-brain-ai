/**
 * Document domain model. Explicit document interface, Mongoose schema, a
 * decoupled API DTO, and shared constants for the Document Management feature.
 */
import { Schema, model, type HydratedDocument } from 'mongoose';

/** Map of accepted upload MIME types to their canonical short file type. */
export const SUPPORTED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'image/png': 'png',
  'image/jpeg': 'jpg',
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_MIME_TYPES;
export type FileType = (typeof SUPPORTED_MIME_TYPES)[SupportedMimeType];

export const FILE_TYPES = [...new Set(Object.values(SUPPORTED_MIME_TYPES))] as FileType[];

/**
 * Extension → file type fallback. Browsers are inconsistent with MIME types for
 * CSV (often `application/vnd.ms-excel` or `application/octet-stream`) and images,
 * so we resolve by extension when the MIME type isn't a known match.
 */
const EXTENSION_FILE_TYPES: Record<string, FileType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.csv': 'csv',
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
};

/** Resolve a canonical file type from a MIME type, falling back to the extension. */
export function resolveFileType(mimetype: string, filename?: string): FileType | null {
  const byMime = SUPPORTED_MIME_TYPES[mimetype as SupportedMimeType];
  if (byMime) return byMime;
  if (filename) {
    const dot = filename.lastIndexOf('.');
    if (dot !== -1) {
      const ext = filename.slice(dot).toLowerCase();
      return EXTENSION_FILE_TYPES[ext] ?? null;
    }
  }
  return null;
}

/** Coarse lifecycle status (drives filters + analytics — values are stable). */
export const DOCUMENT_STATUSES = ['uploaded', 'processing', 'processed', 'failed'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * Fine-grained pipeline stage, surfaced for live progress while `status` stays
 * 'processing'. Additive to the lifecycle `status` so existing filters/analytics
 * that key off `status` are unaffected.
 */
export const PROCESSING_STAGES = [
  'queued',
  'extracting_text',
  'ocr',
  'chunking',
  'knowledge_graph',
  'embedding',
  'indexed',
  'failed',
] as const;
export type ProcessingStage = (typeof PROCESSING_STAGES)[number];

/** Persisted document shape. */
export interface IDocument {
  title: string;
  filename: string;
  originalName: string;
  fileType: FileType;
  fileSize: number;
  uploadDate: Date;
  category: string;
  status: DocumentStatus;
  // Phase 2 — knowledge pipeline metadata
  pageCount: number;
  chunkCount: number;
  indexed: boolean;
  contentText?: string;
  contentLength: number;
  processingStage?: ProcessingStage;
  processingError?: string;
}

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, trim: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileType: { type: String, required: true, enum: FILE_TYPES },
    fileSize: { type: Number, required: true, min: 0 },
    uploadDate: { type: Date, required: true, default: Date.now },
    category: { type: String, required: true, trim: true, default: 'general' },
    status: { type: String, required: true, enum: [...DOCUMENT_STATUSES], default: 'uploaded' },
    pageCount: { type: Number, required: true, default: 0 },
    chunkCount: { type: Number, required: true, default: 0 },
    contentLength: { type: Number, required: true, default: 0 },
    indexed: { type: Boolean, required: true, default: false },
    // Full extracted text; excluded from queries by default to keep payloads lean.
    contentText: { type: String, select: false },
    processingStage: { type: String, enum: [...PROCESSING_STAGES] },
    processingError: { type: String },
  },
  { timestamps: true, versionKey: false },
);

// Case-insensitive text search on title and original filename.
documentSchema.index({ title: 'text', originalName: 'text' });
// Supports the default newest-first list sort (find().sort({ createdAt: -1 })).
documentSchema.index({ createdAt: -1 });

export type DocumentDoc = HydratedDocument<IDocument>;

export const DocumentModel = model<IDocument>('Document', documentSchema);

/** Public API representation of a document (decoupled from Mongoose internals). */
export interface DocumentDTO {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  fileType: FileType;
  fileSize: number;
  uploadDate: string;
  category: string;
  status: DocumentStatus;
  pageCount: number;
  chunkCount: number;
  indexed: boolean;
  processingStage?: ProcessingStage;
  processingError?: string;
}

export function toDocumentDTO(doc: DocumentDoc): DocumentDTO {
  return {
    id: String(doc._id),
    title: doc.title,
    filename: doc.filename,
    originalName: doc.originalName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    uploadDate: doc.uploadDate.toISOString(),
    category: doc.category,
    status: doc.status,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    indexed: doc.indexed,
    ...(doc.processingStage ? { processingStage: doc.processingStage } : {}),
    ...(doc.processingError ? { processingError: doc.processingError } : {}),
  };
}
