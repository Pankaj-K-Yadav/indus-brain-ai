/**
 * Embedding service. Generates vector embeddings for text using the Gemini
 * embedding model, with batching, retry/backoff, and structured logging.
 *
 * Task types follow Gemini's guidance: RETRIEVAL_DOCUMENT for indexed chunks
 * and RETRIEVAL_QUERY for search queries, which improves retrieval quality.
 */
import { TaskType } from '@google/generative-ai';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { getEmbeddingModel } from '../integrations/gemini.js';

function batch<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

class EmbeddingService {
  /**
   * Embed many documents (chunks). Returns one vector per input, in order.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const model = getEmbeddingModel();
    const batches = batch(texts, env.EMBEDDING_BATCH_SIZE);
    const vectors: number[][] = [];

    logger.info('Generating embeddings', {
      total: texts.length,
      batches: batches.length,
      batchSize: env.EMBEDDING_BATCH_SIZE,
    });

    for (let i = 0; i < batches.length; i += 1) {
      const current = batches[i] ?? [];
      const response = await withRetry(
        () =>
          model.batchEmbedContents({
            requests: current.map((text) => ({
              content: { role: 'user', parts: [{ text }] },
              taskType: TaskType.RETRIEVAL_DOCUMENT,
            })),
          }),
        { label: `embed-batch-${i + 1}/${batches.length}`, retries: 3 },
      );

      for (const embedding of response.embeddings) {
        vectors.push(embedding.values);
      }
      logger.debug('Embedded batch', { batch: i + 1, size: current.length });
    }

    return vectors;
  }

  /**
   * Embed a single search query.
   */
  async embedQuery(query: string): Promise<number[]> {
    const model = getEmbeddingModel();
    const response = await withRetry(
      () =>
        model.embedContent({
          content: { role: 'user', parts: [{ text: query }] },
          taskType: TaskType.RETRIEVAL_QUERY,
        }),
      { label: 'embed-query', retries: 3 },
    );
    return response.embedding.values;
  }
}

export const embeddingService = new EmbeddingService();
