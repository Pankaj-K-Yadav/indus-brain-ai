/**
 * Document types mirroring the backend Document DTO and API contract.
 */
export type DocumentFileType = 'pdf' | 'docx';

export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

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
