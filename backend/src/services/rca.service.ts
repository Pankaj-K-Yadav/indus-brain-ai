/**
 * Root Cause Analysis (RCA) agent.
 *
 * Correlates evidence retrieved from maintenance records, incident reports,
 * inspection reports and equipment manuals to produce a grounded root-cause
 * analysis: likely root cause, supporting evidence (with citations), confidence,
 * recommended actions, and preventive-maintenance suggestions.
 *
 * Reuses the existing grounded-RAG primitives (embeddings + ChromaDB retrieval +
 * Gemini). It NEVER invents facts: the model may only use the retrieved evidence
 * and must mark the analysis "undetermined" when evidence is insufficient.
 * ChromaDB and all existing APIs are untouched.
 */
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { HttpError } from '../utils/httpError.js';
import { z } from '../utils/validation.js';
import { truncate } from '../utils/text.js';
import { parseJsonResponse } from '../utils/json.js';
import { getGeminiClient } from '../integrations/gemini.js';
import { embeddingService } from './embedding.service.js';
import { vectorRepository, type VectorMatch } from '../repositories/vector.repository.js';
import { knowledgeGraphService } from './knowledgeGraph.service.js';

const rcaSchema = z.object({
  determined: z.boolean(),
  rootCause: z.string(),
  supportingEvidence: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  preventiveMaintenance: z.array(z.string()).default([]),
});

export interface RcaInput {
  problem: string;
  equipment?: string | undefined;
}

export interface RcaCitation {
  ref: number;
  documentId: string;
  title: string;
  category: string;
  pageNumber: number | null;
  score: number;
  snippet: string;
}

export interface RcaSource {
  documentId: string;
  title: string;
  category: string;
  pages: number[];
}

export interface RcaResult {
  problem: string;
  determined: boolean;
  rootCause: string;
  confidence: number;
  supportingEvidence: string[];
  recommendedActions: string[];
  preventiveMaintenance: string[];
  citations: RcaCitation[];
  sources: RcaSource[];
  relatedEquipment: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildSources(matches: VectorMatch[]): RcaSource[] {
  const byDoc = new Map<string, RcaSource & { pageSet: Set<number> }>();
  for (const m of matches) {
    const existing =
      byDoc.get(m.documentId) ??
      ({
        documentId: m.documentId,
        title: m.title,
        category: m.category,
        pages: [],
        pageSet: new Set<number>(),
      } as RcaSource & { pageSet: Set<number> });
    if (m.pageNumber !== null) existing.pageSet.add(m.pageNumber);
    byDoc.set(m.documentId, existing);
  }
  return [...byDoc.values()].map(({ pageSet, ...src }) => ({
    ...src,
    pages: [...pageSet].sort((a, b) => a - b),
  }));
}

function buildPrompt(problem: string, matches: VectorMatch[]): string {
  const evidence = matches
    .map((m, i) => {
      const ref = m.pageNumber !== null ? `, page ${m.pageNumber}` : '';
      return `[${i + 1}] (Source: "${m.title}" — category: ${m.category}${ref})\n${m.text}`;
    })
    .join('\n\n');

  return `You are a senior reliability and Root Cause Analysis (RCA) engineer for industrial plants.
Using ONLY the numbered EVIDENCE excerpts below — drawn from maintenance records, incident
reports, inspection reports and equipment manuals — determine the single most likely root cause
of the PROBLEM and correlate the evidence across these sources.

Return ONLY JSON of this exact shape:
{
  "determined": boolean,
  "rootCause": string,
  "supportingEvidence": [string],
  "recommendedActions": [string],
  "preventiveMaintenance": [string]
}

Rules:
- Use ONLY the evidence. Do NOT invent equipment, values, dates, failure modes, or causes that are
  not present in the excerpts.
- Every item in "supportingEvidence" MUST cite at least one excerpt inline, e.g. [1], [3].
- "recommendedActions" are immediate corrective actions; "preventiveMaintenance" prevents recurrence.
  Both must be grounded in the evidence.
- If the evidence is insufficient to ground a root cause, set "determined" to false and use
  "rootCause" to state exactly what additional records are needed. Do NOT speculate.

PROBLEM: ${problem}

EVIDENCE:
${evidence}`;
}

class RcaService {
  async analyze(input: RcaInput): Promise<RcaResult> {
    const problem = (input.equipment ? `${input.equipment}: ${input.problem}` : input.problem).trim();
    logger.info('RCA requested', { problem: truncate(problem, 120) });

    // 1. Embed the problem and retrieve broad cross-source evidence.
    const queryEmbedding = await embeddingService.embedQuery(problem);
    const matches = await vectorRepository.query(queryEmbedding, env.RCA_TOP_K);
    const relevant = matches.filter((m) => m.score >= env.RCA_MIN_SIMILARITY);

    // 2. No grounded evidence -> undetermined (never fabricate a cause).
    if (relevant.length === 0) {
      logger.warn('RCA: no relevant evidence', { problem, topScore: matches[0]?.score ?? 0 });
      return {
        problem,
        determined: false,
        rootCause:
          'Insufficient indexed evidence to determine a root cause. Upload related maintenance records, incident reports, or inspection reports and try again.',
        confidence: 0,
        supportingEvidence: [],
        recommendedActions: [],
        preventiveMaintenance: [],
        citations: [],
        sources: [],
        relatedEquipment: [],
      };
    }

    // 3. Grounded correlation + analysis via Gemini (JSON mode).
    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    // Synthesis is the only step that can fail on provider errors (e.g. quota).
    // On failure we surface a clean 503 rather than fabricating an analysis.
    let parsed: z.infer<typeof rcaSchema>;
    try {
      const result = await withRetry(() => model.generateContent(buildPrompt(problem, relevant)), {
        label: 'rca-analyze',
      });
      parsed = rcaSchema.parse(parseJsonResponse(result.response.text()));
    } catch (error) {
      logger.error('RCA synthesis failed', { problem, error: String(error) });
      throw new HttpError(503, `Root cause analysis is temporarily unavailable: ${String(error)}`);
    }

    // 4. Confidence from retrieval similarity, dampened if undetermined.
    const topScores = relevant.slice(0, 3).map((m) => m.score);
    const avgTop = round2(topScores.reduce((s, v) => s + v, 0) / topScores.length);
    const confidence = parsed.determined ? avgTop : Math.min(0.2, avgTop);

    const citations: RcaCitation[] = relevant.map((m, i) => ({
      ref: i + 1,
      documentId: m.documentId,
      title: m.title,
      category: m.category,
      pageNumber: m.pageNumber,
      score: round2(m.score),
      snippet: truncate(m.text),
    }));
    const sources = buildSources(relevant);

    // 5. Knowledge-graph enrichment (grounded, best-effort).
    let relatedEquipment: string[] = [];
    try {
      const context = await knowledgeGraphService.getContext(sources.map((s) => s.documentId));
      relatedEquipment = context.relatedEquipment;
    } catch (error) {
      logger.warn('RCA: graph enrichment failed', { error: String(error) });
    }

    logger.info('RCA generated', {
      problem,
      determined: parsed.determined,
      confidence,
      citations: citations.length,
      sources: sources.length,
    });

    return {
      problem,
      determined: parsed.determined,
      rootCause: parsed.rootCause,
      confidence,
      supportingEvidence: parsed.supportingEvidence,
      recommendedActions: parsed.recommendedActions,
      preventiveMaintenance: parsed.preventiveMaintenance,
      citations,
      sources,
      relatedEquipment,
    };
  }
}

export const rcaService = new RcaService();
