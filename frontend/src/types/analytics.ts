/**
 * Analytics types mirroring the backend analytics API.
 */
export interface TopTopic {
  query: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface QueriedDocument {
  documentId: string;
  title: string;
  count: number;
}

export interface ProcessingQueueItem {
  id: string;
  title: string;
  status: string;
}

export type EmbeddingStatus = 'operational' | 'processing' | 'degraded' | 'idle';

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
