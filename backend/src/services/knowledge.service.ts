/**
 * Knowledge service — Retrieval Augmented Generation (RAG).
 *
 * Flow: query -> embed -> vector search -> grounded Gemini reasoning ->
 * cited, confidence-scored answer. Designed to avoid hallucination: the model
 * is instructed to answer ONLY from retrieved context and to refuse when the
 * context is insufficient. Below a similarity threshold we refuse without even
 * calling the LLM.
 */
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { getGenerativeModel } from '../integrations/gemini.js';
import { embeddingService } from './embedding.service.js';
import { vectorRepository, type VectorMatch } from '../repositories/vector.repository.js';
import { searchLogRepository } from '../repositories/searchLog.repository.js';
import type { AssistantType } from '../models/searchLog.model.js';

const INSUFFICIENT = 'INSUFFICIENT_CONTEXT';

interface AssistantConfig {
  persona: string;
  category?: string;
}

const ASSISTANTS: Record<AssistantType, AssistantConfig> = {
  general: {
    persona: 'You are INDUS-BRAIN AI, an industrial knowledge assistant for plant operators and engineers.',
  },
  sop: {
    persona:
      'You are an SOP (Standard Operating Procedure) assistant. Provide precise, step-by-step procedures exactly as documented.',
  },
  maintenance: {
    persona:
      'You are a maintenance assistant for industrial equipment. Give clear, ordered maintenance and restart steps from the manuals.',
  },
  incident: {
    persona:
      'You are an incident knowledge assistant. Surface similar past incidents, root causes, and corrective actions from incident reports.',
  },
  safety: {
    persona:
      'You are a safety assistant. State required PPE, hazards, and safety precautions strictly as documented. Never guess on safety.',
  },
};

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

export interface KnowledgeAnswer {
  answer: string;
  confidence: number;
  answered: boolean;
  assistant: AssistantType;
  sources: KnowledgeSource[];
  retrievedChunks: RetrievedChunk[];
}

export interface KnowledgeQuery {
  query: string;
  assistant?: AssistantType;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function truncate(text: string, max = 400): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

function buildSources(matches: VectorMatch[]): KnowledgeSource[] {
  const byDoc = new Map<string, KnowledgeSource & { pageSet: Set<number> }>();
  for (const m of matches) {
    const existing =
      byDoc.get(m.documentId) ??
      ({
        documentId: m.documentId,
        title: m.title,
        originalName: m.originalName,
        category: m.category,
        pages: [],
        pageSet: new Set<number>(),
      } as KnowledgeSource & { pageSet: Set<number> });
    if (m.pageNumber !== null) existing.pageSet.add(m.pageNumber);
    byDoc.set(m.documentId, existing);
  }
  return [...byDoc.values()].map(({ pageSet, ...src }) => ({
    ...src,
    pages: [...pageSet].sort((a, b) => a - b),
  }));
}

function buildPrompt(persona: string, query: string, matches: VectorMatch[]): string {
  const context = matches
    .map((m, i) => {
      const ref = m.pageNumber !== null ? `, page ${m.pageNumber}` : '';
      return `[${i + 1}] (Source: "${m.title}"${ref})\n${m.text}`;
    })
    .join('\n\n');

  return `${persona}

Answer the QUESTION using ONLY the numbered CONTEXT excerpts below. Follow these rules strictly:
- Use only information present in the context. Do NOT use outside knowledge or assumptions.
- Cite the excerpts you use inline, e.g. [1], [2].
- If the context does not contain enough information to answer, reply with exactly "${INSUFFICIENT}" on the first line, followed by one sentence describing what is missing.
- Be concise and practical for an industrial operator. Preserve exact procedure steps, values, and units.

CONTEXT:
${context}

QUESTION: ${query}

ANSWER:`;
}

class KnowledgeService {
  async search(input: KnowledgeQuery): Promise<KnowledgeAnswer> {
    const assistant: AssistantType = input.assistant ?? 'general';
    const config = ASSISTANTS[assistant];
    const query = input.query.trim();

    logger.info('Knowledge search received', { assistant, query });

    // 1. Embed the query.
    const queryEmbedding = await embeddingService.embedQuery(query);

    // 2. Vector search (optionally filtered by category for specialised assistants).
    const filter = config.category ? { category: config.category } : undefined;
    const matches = await vectorRepository.query(queryEmbedding, env.RAG_TOP_K, filter);

    // 3. Keep only sufficiently similar chunks.
    const relevant = matches.filter((m) => m.score >= env.RAG_MIN_SIMILARITY);

    if (relevant.length === 0) {
      const answer: KnowledgeAnswer = {
        answer:
          'I could not find this information in the indexed documents. Please upload the relevant manual or rephrase your question.',
        confidence: 0,
        answered: false,
        assistant,
        sources: [],
        retrievedChunks: [],
      };
      await this.logSearch(query, assistant, answer);
      logger.warn('Knowledge search: no relevant chunks', { query, topScore: matches[0]?.score ?? 0 });
      return answer;
    }

    // 4. Grounded generation.
    const prompt = buildPrompt(config.persona, query, relevant);
    const model = getGenerativeModel();
    const result = await withRetry(() => model.generateContent(prompt), { label: 'rag-generate' });
    const raw = result.response.text().trim();

    const answered = !raw.startsWith(INSUFFICIENT);
    const cleanedAnswer = answered ? raw : raw.replace(INSUFFICIENT, '').trim() || 'Insufficient information in the documents to answer this.';

    // 5. Confidence from retrieval similarity, dampened if the model refused.
    const topScores = relevant.slice(0, 3).map((m) => m.score);
    const avgTop = topScores.reduce((s, v) => s + v, 0) / topScores.length;
    const confidence = answered ? round2(avgTop) : Math.min(0.15, round2(avgTop));

    const answer: KnowledgeAnswer = {
      answer: cleanedAnswer,
      confidence,
      answered,
      assistant,
      sources: buildSources(relevant),
      retrievedChunks: relevant.map((m) => ({
        chunkId: m.chunkId,
        text: truncate(m.text),
        score: round2(m.score),
        pageNumber: m.pageNumber,
        title: m.title,
      })),
    };

    await this.logSearch(query, assistant, answer);
    logger.info('Knowledge answer generated', {
      assistant,
      answered,
      confidence,
      sources: answer.sources.length,
      chunks: answer.retrievedChunks.length,
    });
    return answer;
  }

  private async logSearch(
    query: string,
    assistant: AssistantType,
    answer: KnowledgeAnswer,
  ): Promise<void> {
    try {
      await searchLogRepository.create({
        query,
        assistant,
        confidence: answer.confidence,
        sourceCount: answer.sources.length,
        answered: answer.answered,
      });
    } catch (error) {
      logger.warn('Failed to persist search log', { error: String(error) });
    }
  }
}

export const knowledgeService = new KnowledgeService();
