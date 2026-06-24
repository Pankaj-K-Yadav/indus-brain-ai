/**
 * ChromaDB client provider (vector store). Exposes a lazily-initialized
 * singleton client. Collection management and queries are added later.
 */
import { ChromaClient } from 'chromadb';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

let client: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({ path: env.CHROMA_URL });
    logger.info('ChromaDB client initialized', { path: env.CHROMA_URL });
  }
  return client;
}

export async function pingChroma(): Promise<boolean> {
  try {
    await getChromaClient().heartbeat();
    return true;
  } catch (error) {
    logger.warn('ChromaDB heartbeat failed', { error: String(error) });
    return false;
  }
}
