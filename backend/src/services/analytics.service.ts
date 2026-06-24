/**
 * Analytics service. Aggregates platform metrics for the dashboard from
 * MongoDB (documents, chunks, searches) with a best-effort vector-store count.
 */
import { logger } from '../utils/logger.js';
import { documentRepository } from '../repositories/document.repository.js';
import { searchLogRepository, type TopTopic } from '../repositories/searchLog.repository.js';
import { vectorRepository } from '../repositories/vector.repository.js';

export interface AnalyticsOverview {
  documentsUploaded: number;
  indexedDocuments: number;
  chunksCreated: number;
  vectorsIndexed: number;
  aiSearches: number;
  topTopics: TopTopic[];
}

class AnalyticsService {
  async getOverview(): Promise<AnalyticsOverview> {
    const [documentsUploaded, indexedDocuments, chunksCreated, aiSearches, topTopics] =
      await Promise.all([
        documentRepository.count(),
        documentRepository.count({ indexed: true }),
        documentRepository.totalChunks(),
        searchLogRepository.count(),
        searchLogRepository.topTopics(5),
      ]);

    // Vector count is best-effort: ChromaDB may be unavailable without breaking the dashboard.
    let vectorsIndexed = 0;
    try {
      vectorsIndexed = await vectorRepository.count();
    } catch (error) {
      logger.warn('Vector store count unavailable for analytics', { error: String(error) });
    }

    return {
      documentsUploaded,
      indexedDocuments,
      chunksCreated,
      vectorsIndexed,
      aiSearches,
      topTopics,
    };
  }
}

export const analyticsService = new AnalyticsService();
