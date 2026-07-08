/**
 * Lessons Learned Intelligence.
 *
 * Two evidence-backed surfaces over incident / near-miss / maintenance /
 * inspection content:
 *  - getOverview(): deterministic dashboard metrics derived from the knowledge
 *    graph + documents (recurring components, frequent entities, category
 *    breakdown, failure trend). No LLM — fast and fully reproducible.
 *  - generateSummary(): a grounded AI summary (recurring failures, frequent
 *    problems, lessons, recommendations) that cites retrieved excerpts.
 *
 * Reuses existing primitives; ChromaDB and existing APIs are untouched.
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
import { documentRepository } from '../repositories/document.repository.js';
import { entityRepository } from '../repositories/entity.repository.js';
import { relationshipRepository } from '../repositories/relationship.repository.js';

const ANALYSIS_QUERY =
  'recurring equipment failures, incidents, near misses, repeated component problems, maintenance issues, inspection findings, root causes';

const summarySchema = z.object({
  summary: z.string().default(''),
  recurringFailures: z
    .array(z.object({ description: z.string(), evidence: z.string().default('') }))
    .default([]),
  frequentProblems: z
    .array(z.object({ problem: z.string(), evidence: z.string().default('') }))
    .default([]),
  lessons: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export interface RepeatedComponent {
  name: string;
  documentCount: number;
  occurrences: number;
}

export interface FrequentEntity {
  type: string;
  name: string;
  documentCount: number;
}

export interface TrendPoint {
  period: string;
  count: number;
}

export interface LessonsOverview {
  totals: { documents: number; entities: number; relationships: number; categories: number };
  repeatedComponents: RepeatedComponent[];
  frequentEntities: FrequentEntity[];
  categoryBreakdown: { category: string; count: number }[];
  failureTrend: TrendPoint[];
}

export interface LessonsCitation {
  ref: number;
  documentId: string;
  title: string;
  category: string;
  pageNumber: number | null;
  snippet: string;
}

export interface LessonsSummary {
  determined: boolean;
  summary: string;
  recurringFailures: { description: string; evidence: string }[];
  frequentProblems: { problem: string; evidence: string }[];
  lessons: string[];
  recommendations: string[];
  citations: LessonsCitation[];
  sources: { documentId: string; title: string }[];
}

function buildPrompt(evidence: VectorMatch[]): string {
  const excerpts = evidence
    .map((m, i) => {
      const ref = m.pageNumber !== null ? `, page ${m.pageNumber}` : '';
      return `[${i + 1}] (Source: "${m.title}" — category: ${m.category}${ref})\n${m.text}`;
    })
    .join('\n\n');

  return `You are a reliability engineer extracting "lessons learned" from industrial reports
(incident, near-miss, maintenance, and inspection records).

Using ONLY the numbered EVIDENCE excerpts below, identify recurring failures, the most frequent
problems, and the key lessons.

Return ONLY JSON of this exact shape:
{
  "summary": string,
  "recurringFailures": [{ "description": string, "evidence": string }],
  "frequentProblems": [{ "problem": string, "evidence": string }],
  "lessons": [string],
  "recommendations": [string]
}

Rules:
- Use ONLY the evidence. Do NOT invent equipment, failures, counts, or dates.
- Every "evidence" field MUST cite excerpt number(s), e.g. [2], [5].
- "lessons" are concise takeaways; "recommendations" are concrete preventive actions.
- If the evidence is insufficient, return empty arrays and explain in "summary".

EVIDENCE:
${excerpts}`;
}

class LessonsService {
  async getOverview(): Promise<LessonsOverview> {
    const [
      documents,
      entities,
      relationships,
      repeatedComponents,
      frequentEntities,
      categoryBreakdown,
      failureTrend,
    ] = await Promise.all([
      documentRepository.count(),
      entityRepository.count(),
      relationshipRepository.count(),
      entityRepository.repeatedComponents(8),
      entityRepository.frequentEntities(10),
      documentRepository.topCategories(8),
      documentRepository.monthlyTrend(),
    ]);

    return {
      totals: {
        documents,
        entities,
        relationships,
        categories: categoryBreakdown.length,
      },
      repeatedComponents,
      frequentEntities,
      categoryBreakdown,
      failureTrend,
    };
  }

  async generateSummary(): Promise<LessonsSummary> {
    const embedding = await embeddingService.embedQuery(ANALYSIS_QUERY);
    const evidence = await vectorRepository.query(embedding, env.LESSONS_TOP_K);

    if (evidence.length === 0) {
      return {
        determined: false,
        summary:
          'No indexed report content was found. Upload and index incident, near-miss, maintenance, or inspection reports to generate lessons learned.',
        recurringFailures: [],
        frequentProblems: [],
        lessons: [],
        recommendations: [],
        citations: [],
        sources: [],
      };
    }

    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    let parsed: z.infer<typeof summarySchema>;
    try {
      const result = await withRetry(() => model.generateContent(buildPrompt(evidence)), {
        label: 'lessons-summary',
      });
      parsed = summarySchema.parse(parseJsonResponse(result.response.text()));
    } catch (error) {
      logger.error('Lessons summary synthesis failed', { error: String(error) });
      throw new HttpError(503, `Lessons summary is temporarily unavailable: ${String(error)}`);
    }

    const citations: LessonsCitation[] = evidence.map((m, i) => ({
      ref: i + 1,
      documentId: m.documentId,
      title: m.title,
      category: m.category,
      pageNumber: m.pageNumber,
      snippet: truncate(m.text),
    }));
    const sourcesById = new Map<string, { documentId: string; title: string }>();
    for (const m of evidence) {
      if (!sourcesById.has(m.documentId)) {
        sourcesById.set(m.documentId, { documentId: m.documentId, title: m.title });
      }
    }

    const determined =
      parsed.recurringFailures.length > 0 ||
      parsed.frequentProblems.length > 0 ||
      parsed.lessons.length > 0;

    logger.info('Lessons summary generated', {
      determined,
      recurringFailures: parsed.recurringFailures.length,
      frequentProblems: parsed.frequentProblems.length,
      citations: citations.length,
    });

    return {
      determined,
      summary: parsed.summary,
      recurringFailures: parsed.recurringFailures,
      frequentProblems: parsed.frequentProblems,
      lessons: parsed.lessons,
      recommendations: parsed.recommendations,
      citations,
      sources: [...sourcesById.values()],
    };
  }
}

export const lessonsService = new LessonsService();
