/**
 * Knowledge API service. Wraps the RAG search endpoint.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { KnowledgeAnswer, KnowledgeSearchInput } from '@/types/knowledge';

export const knowledgeService = {
  async search(input: KnowledgeSearchInput): Promise<KnowledgeAnswer> {
    const { data } = await apiClient.post<ApiSuccess<KnowledgeAnswer>>('/knowledge/search', input);
    return data.data;
  },
};
