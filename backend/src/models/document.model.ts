/**
 * Document domain model. Explicit document interface, Mongoose schema, a
 * decoupled API DTO, and shared constants for the Document Management feature.
 */
import { Schema, model, type HydratedDocument } from 'mongoose';

/** Map of accepted upload MIME types to their canonical short file type. */
export const SUPPORTED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_MIME_TYPES;
export type FileType = (typeof SUPPORTED_MIME_TYPES)[SupportedMimeType];

export const FILE_TYPES = Object.values(SUPPORTED_MIME_TYPES) as FileType[];

/** Lifecycle status of a document. AI processing states are reserved for later. */
export const DOCUMENT_STATUSES = ['uploaded', 'processing', 'processed', 'failed'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

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
    indexed: { type: Boolean, required: true, default: false },
    // Full extracted text; excluded from queries by default to keep payloads lean.
    contentText: { type: String, select: false },
    processingError: { type: String },
  },
  { timestamps: true, versionKey: false },
);

// Case-insensitive text search on title and original filename.
documentSchema.index({ title: 'text', originalName: 'text' });

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
    ...(doc.processingError ? { processingError: doc.processingError } : {}),
  };
}
