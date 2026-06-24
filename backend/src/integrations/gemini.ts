/**
 * Gemini API client provider. Exposes a lazily-initialized singleton plus
 * helpers to obtain generation / embedding models. No prompting logic here.
 */
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

let genAI: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    logger.info('Gemini client initialized', { model: env.GEMINI_MODEL });
  }
  return genAI;
}

export function getGenerativeModel(): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });
}

export function getEmbeddingModel(): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: env.GEMINI_EMBEDDING_MODEL });
}
