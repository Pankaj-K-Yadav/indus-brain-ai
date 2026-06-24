/**
 * Document API service. Wraps the documents endpoints exposed by the backend.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { DocumentDTO, ListDocumentsParams, UploadDocumentInput } from '@/types/document';

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

    const { data } = await apiClient.post<ApiSuccess<DocumentDTO>>('/documents/upload', formData);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/documents/${id}`);
  },
};
