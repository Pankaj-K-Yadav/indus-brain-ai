/**
 * Document API service. Wraps the documents endpoints exposed by the backend.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { DocumentDTO, ListDocumentsParams, UploadDocumentInput } from '@/types/document';

// Upload and reindex run the full ingestion pipeline (extract -> OCR -> embed ->
// index) inside the request, which can take well over the default 30s timeout —
// especially for scanned files needing OCR. Allow these two calls more headroom.
const PIPELINE_TIMEOUT_MS = 180_000;

export const documentService = {
  async list(params: ListDocumentsParams = {}): Promise<DocumentDTO[]> {
    const { data } = await apiClient.get<ApiSuccess<DocumentDTO[]>>('/documents', { params });
    return data.data;
  },

  async getById(id: string): Promise<DocumentDTO> {
    const { data } = await apiClient.get<ApiSuccess<DocumentDTO>>(`/documents/${id}`);
    return data.data;
  },

  async upload(input: UploadDocumentInput): Promise<DocumentDTO> {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('title', input.title);
    formData.append('category', input.category);

    const { data } = await apiClient.post<ApiSuccess<DocumentDTO>>('/documents/upload', formData, {
      timeout: PIPELINE_TIMEOUT_MS,
    });
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/documents/${id}`);
  },

  async reindex(id: string): Promise<DocumentDTO> {
    const { data } = await apiClient.post<ApiSuccess<DocumentDTO>>(`/documents/${id}/reindex`, null, {
      timeout: PIPELINE_TIMEOUT_MS,
    });
    return data.data;
  },
};
