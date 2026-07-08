/**
 * Knowledge (RAG) types mirroring the backend knowledge API.
 */
export type AssistantType = 'general' | 'sop' | 'maintenance' | 'incident' | 'safety';

export interface KnowledgeSource {
  documentId: string;
  title: string;
  originalName: string;
  category: string;
  pages: number[];
}

export interface RetrievedChunk {
  chunkId: string;
  text: string;
  score: number;
  pageNumber: number | null;
  title: string;
}

export interface RelatedDocument {
  documentId: string;
  title: string;
}

export interface RelatedEntity {
  type: string;
  name: string;
}

export interface KnowledgeAnswer {
  answer: string;
  confidence: number;
  answered: boolean;
  assistant: AssistantType;
  sources: KnowledgeSource[];
  retrievedChunks: RetrievedChunk[];
  relatedDocuments: RelatedDocument[];
  relatedEquipment: string[];
  relatedEntities: RelatedEntity[];
  followUpQuestions: string[];
}

export interface KnowledgeSearchInput {
  query: string;
  assistant: AssistantType;
}
