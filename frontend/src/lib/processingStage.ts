/**
 * Presentation helpers for the document processing pipeline stages — shared so
 * the status badge and any progress UI stay consistent.
 */
import type { ProcessingStage } from '@/types/document';

export const PROCESSING_STAGE_LABELS: Record<ProcessingStage, string> = {
  queued: 'Queued',
  extracting_text: 'Extracting Text',
  ocr: 'OCR Processing',
  chunking: 'Chunking',
  knowledge_graph: 'Building Knowledge Graph',
  embedding: 'Generating Embeddings',
  indexed: 'Indexed',
  failed: 'Failed',
};

/** Ordered stages a document passes through on the success path. */
export const PROCESSING_STAGE_ORDER: ProcessingStage[] = [
  'queued',
  'extracting_text',
  'ocr',
  'chunking',
  'knowledge_graph',
  'embedding',
  'indexed',
];

/** Approximate completion (0–100) for the given stage, for progress bars. */
export function stageProgress(stage?: ProcessingStage): number {
  if (!stage) return 0;
  const index = PROCESSING_STAGE_ORDER.indexOf(stage);
  if (index === -1) return 0;
  return Math.round(((index + 1) / PROCESSING_STAGE_ORDER.length) * 100);
}
