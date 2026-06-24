/**
 * Analytics types mirroring the backend analytics API.
 */
export interface TopTopic {
  query: string;
  count: number;
}

export interface AnalyticsOverview {
  documentsUploaded: number;
  indexedDocuments: number;
  chunksCreated: number;
  vectorsIndexed: number;
  aiSearches: number;
  topTopics: TopTopic[];
}
