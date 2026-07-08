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
import { truncate } from '../utils/text.js';
import { getGenerativeModel } from '../integrations/gemini.js';
import { embeddingService } from './embedding.service.js';
import { vectorRepository, type VectorMatch } from '../repositories/vector.repository.js';
import { searchLogRepository } from '../repositories/searchLog.repository.js';
import {
  knowledgeGraphService,
  type RelatedDocument,
  type RelatedEntity,
} from './knowledgeGraph.service.js';
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
  // Knowledge-graph enrichment (grounded in the source documents).
  relatedDocuments: RelatedDocument[];
  relatedEquipment: string[];
  relatedEntities: RelatedEntity[];
  followUpQuestions: string[];
}

export interface KnowledgeQuery {
  query: string;
  assistant?: AssistantType;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

Formatting:
- Start with a one-sentence direct answer.
- For procedures, use a numbered list ("1.", "2.", …) with one action per line.
- For specifications or lists, use "- " bullet points.
- Preserve exact values, units, and identifiers. Keep it concise and practical for an operator.

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

    logger.info('Knowledge search received', { assistant, query: truncate(query, 120) });

    // 1. Embed the query.
    const queryEmbedding = await embeddingService.embedQuery(query);

    // 2. Vector search (optionally filtered by category for specialised assistants).
    const filter = config.category ? { category: config.category } : undefined;
    const matches = await vectorRepository.query(queryEmbedding, env.RAG_TOP_K, filter);

    // 3. Keep only sufficiently similar chunks. No evidence -> refuse.
    const relevant = matches.filter((m) => m.score >= env.RAG_MIN_SIMILARITY);
    if (relevant.length === 0) {
      return this.refuse(
        query,
        assistant,
        'I could not find this in the indexed documents. Please upload the relevant manual or rephrase your question.',
        0,
        'no relevant chunks',
      );
    }

    // 4. Retrieval confidence (mean of the top matches). Below the floor we
    //    refuse politely WITHOUT calling the LLM — weak grounding => no answer.
    const topScores = relevant.slice(0, 3).map((m) => m.score);
    const retrievalConfidence = round2(topScores.reduce((s, v) => s + v, 0) / topScores.length);
    if (retrievalConfidence < env.RAG_MIN_CONFIDENCE) {
      return this.refuse(
        query,
        assistant,
        `I don't have a confident, grounded answer for this in the current documents (confidence ${Math.round(
          retrievalConfidence * 100,
        )}%). Try rephrasing, or upload a more specific document.`,
        retrievalConfidence,
        'below confidence threshold',
      );
    }

    // 5. Grounded generation.
    const prompt = buildPrompt(config.persona, query, relevant);
    const model = getGenerativeModel();
    const result = await withRetry(() => model.generateContent(prompt), { label: 'rag-generate' });
    const raw = result.response.text().trim();

    // The model self-refuses when the context doesn't support an answer.
    if (raw.startsWith(INSUFFICIENT)) {
      const note = raw.replace(INSUFFICIENT, '').trim();
      return this.refuse(
        query,
        assistant,
        note || 'The documents do not contain enough information to answer this reliably.',
        Math.min(0.15, retrievalConfidence),
        'model reported insufficient context',
      );
    }

    // 6. Build the grounded, enriched answer.
    const sources = buildSources(relevant);
    const context = await this.safeGraphContext(sources.map((s) => s.documentId));

    const answer: KnowledgeAnswer = {
      answer: raw,
      confidence: retrievalConfidence,
      answered: true,
      assistant,
      sources,
      retrievedChunks: relevant.map((m) => ({
        chunkId: m.chunkId,
        text: truncate(m.text, 400),
        score: round2(m.score),
        pageNumber: m.pageNumber,
        title: m.title,
      })),
      relatedDocuments: context.relatedDocuments,
      relatedEquipment: context.relatedEquipment,
      relatedEntities: context.relatedEntities,
      followUpQuestions: context.followUpQuestions,
    };

    await this.logSearch(query, assistant, answer);
    logger.info('Knowledge answer generated', {
      assistant,
      confidence: answer.confidence,
      sources: answer.sources.length,
      chunks: answer.retrievedChunks.length,
      relatedDocuments: answer.relatedDocuments.length,
      relatedEquipment: answer.relatedEquipment.length,
      followUps: answer.followUpQuestions.length,
    });
    return answer;
  }

  /** Build + log a polite refusal with all (empty) enrichment fields. */
  private async refuse(
    query: string,
    assistant: AssistantType,
    message: string,
    confidence: number,
    reason: string,
  ): Promise<KnowledgeAnswer> {
    const answer: KnowledgeAnswer = {
      answer: message,
      confidence,
      answered: false,
      assistant,
      sources: [],
      retrievedChunks: [],
      relatedDocuments: [],
      relatedEquipment: [],
      relatedEntities: [],
      followUpQuestions: [],
    };
    await this.logSearch(query, assistant, answer);
    logger.warn('Knowledge search refused', {
      query: truncate(query, 120),
      assistant,
      reason,
      confidence,
    });
    return answer;
  }

  /** Knowledge-graph enrichment; best-effort so it never breaks an answer. */
  private async safeGraphContext(documentIds: string[]): ReturnType<typeof knowledgeGraphService.getContext> {
    try {
      return await knowledgeGraphService.getContext(documentIds);
    } catch (error) {
      logger.warn('Graph enrichment failed', { error: String(error) });
      return { relatedDocuments: [], relatedEquipment: [], relatedEntities: [], followUpQuestions: [] };
    }
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
        sources: answer.sources.map((s) => ({ documentId: s.documentId, title: s.title })),
      });
    } catch (error) {
      logger.warn('Failed to persist search log', { error: String(error) });
    }
  }
}

export const knowledgeService = new KnowledgeService();
