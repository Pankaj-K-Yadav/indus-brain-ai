/**
 * Document types mirroring the backend Document DTO and API contract.
 */
export type DocumentFileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'png' | 'jpg';

export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

/** Fine-grained pipeline stage surfaced while `status` is 'processing'. */
export type ProcessingStage =
  | 'queued'
  | 'extracting_text'
  | 'ocr'
  | 'chunking'
  | 'knowledge_graph'
  | 'embedding'
  | 'indexed'
  | 'failed';

export interface DocumentDTO {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  fileType: DocumentFileType;
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

export interface UploadDocumentInput {
  file: File;
  title: string;
  category: string;
}

export interface ListDocumentsParams {
  search?: string;
  category?: string;
  status?: DocumentStatus;
}
