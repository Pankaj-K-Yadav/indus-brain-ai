/**
 * Analytics service. Aggregates platform metrics for the dashboard from
 * MongoDB (documents, chunks, searches, knowledge graph) plus a best-effort
 * vector-store count. ChromaDB is only read for the vector count.
 */
import { logger } from '../utils/logger.js';
import { documentRepository } from '../repositories/document.repository.js';
import {
  searchLogRepository,
  type TopTopic,
  type QueriedDocument,
} from '../repositories/searchLog.repository.js';
import { vectorRepository } from '../repositories/vector.repository.js';
import { knowledgeGraphService } from './knowledgeGraph.service.js';

export type EmbeddingStatus = 'operational' | 'processing' | 'degraded' | 'idle';

export interface ProcessingQueueItem {
  id: string;
  title: string;
  status: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface AnalyticsOverview {
  documentsUploaded: number;
  indexedDocuments: number;
  failedDocuments: number;
  pendingProcessing: number;
  chunksCreated: number;
  vectorsIndexed: number;
  aiSearches: number;
  graphNodes: number;
  graphRelationships: number;
  storageUsed: number;
  averageChunkSize: number;
  embeddingStatus: EmbeddingStatus;
  processingQueue: ProcessingQueueItem[];
  topCategories: CategoryCount[];
  mostQueriedDocuments: QueriedDocument[];
  topTopics: TopTopic[];
}

function deriveEmbeddingStatus(input: {
  total: number;
  pending: number;
  failed: number;
}): EmbeddingStatus {
  if (input.total === 0) return 'idle';
  if (input.pending > 0) return 'processing';
  if (input.failed > 0) return 'degraded';
  return 'operational';
}

class AnalyticsService {
  async getOverview(): Promise<AnalyticsOverview> {
    const [
      documentsUploaded,
      indexedDocuments,
      failedDocuments,
      pendingProcessing,
      chunksCreated,
      storageUsed,
      contentStats,
      topCategories,
      pendingDocs,
      aiSearches,
      topTopics,
      mostQueriedDocuments,
      graphStats,
    ] = await Promise.all([
      documentRepository.count(),
      documentRepository.count({ indexed: true }),
      documentRepository.count({ status: 'failed' }),
      documentRepository.count({ status: { $in: ['uploaded', 'processing'] as const } }),
      documentRepository.totalChunks(),
      documentRepository.totalStorage(),
      documentRepository.contentStats(),
      documentRepository.topCategories(6),
      documentRepository.findByStatuses(['uploaded', 'processing'], 5),
      searchLogRepository.count(),
      searchLogRepository.topTopics(5),
      searchLogRepository.mostQueriedDocuments(5),
      knowledgeGraphService.getStats(),
    ]);

    // Vector count is best-effort: ChromaDB may be unavailable without breaking the dashboard.
    let vectorsIndexed = 0;
    try {
      vectorsIndexed = await vectorRepository.count();
    } catch (error) {
      logger.warn('Vector store count unavailable for analytics', { error: String(error) });
    }

    const averageChunkSize =
      contentStats.totalChunks > 0
        ? Math.round(contentStats.totalContentChars / contentStats.totalChunks)
        : 0;

    return {
      documentsUploaded,
      indexedDocuments,
      failedDocuments,
      pendingProcessing,
      chunksCreated,
      vectorsIndexed,
      aiSearches,
      graphNodes: graphStats.totalEntities,
      graphRelationships: graphStats.totalRelationships,
      storageUsed,
      averageChunkSize,
      embeddingStatus: deriveEmbeddingStatus({
        total: documentsUploaded,
        pending: pendingProcessing,
        failed: failedDocuments,
      }),
      processingQueue: pendingDocs.map((d) => ({
        id: String(d._id),
        title: d.title,
        status: d.status,
      })),
      topCategories,
      mostQueriedDocuments,
      topTopics,
    };
  }
}

export const analyticsService = new AnalyticsService();
