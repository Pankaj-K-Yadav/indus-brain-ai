/**
 * Compliance Intelligence service.
 *
 * Compares a Standard Operating Procedure (SOP) document against regulation
 * documents to detect missing sections, conflicts, and compliance gaps, then
 * produces a grounded, cited compliance report. Reuses the existing retrieval +
 * Gemini primitives; never invents requirements (only reasons from regulation
 * excerpts) and references the source documents. ChromaDB/existing APIs untouched.
 */
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { HttpError } from '../utils/httpError.js';
import { z, assertObjectId } from '../utils/validation.js';
import { truncate } from '../utils/text.js';
import { parseJsonResponse } from '../utils/json.js';
import { getGeminiClient } from '../integrations/gemini.js';
import { embeddingService } from './embedding.service.js';
import { vectorRepository, type VectorMatch } from '../repositories/vector.repository.js';
import { documentRepository } from '../repositories/document.repository.js';

const analysisSchema = z.object({
  summary: z.string().default(''),
  requirements: z
    .array(
      z.object({
        requirement: z.string(),
        status: z.enum(['met', 'partial', 'missing']).default('missing'),
        evidence: z.string().default(''),
      }),
    )
    .default([]),
  conflicts: z
    .array(z.object({ description: z.string(), evidence: z.string().default('') }))
    .default([]),
  recommendations: z.array(z.string()).default([]),
});

export type RequirementStatus = 'met' | 'partial' | 'missing';

export interface ComplianceRequirement {
  requirement: string;
  status: RequirementStatus;
  evidence: string;
}

export interface ComplianceConflict {
  description: string;
  evidence: string;
}

export interface ComplianceCitation {
  ref: number;
  documentId: string;
  title: string;
  category: string;
  pageNumber: number | null;
  snippet: string;
}

export interface DocumentRef {
  documentId: string;
  title: string;
}

export interface ComplianceReport {
  determined: boolean;
  sopDocument: DocumentRef;
  regulationDocuments: DocumentRef[];
  complianceScore: number;
  summary: string;
  counts: { total: number; met: number; partial: number; missing: number; conflicts: number };
  requirements: ComplianceRequirement[];
  missingRequirements: { requirement: string; evidence: string }[];
  conflicts: ComplianceConflict[];
  recommendations: string[];
  citations: ComplianceCitation[];
}

export interface ComplianceInput {
  sopDocumentId: string;
  regulationDocumentId?: string | undefined;
  regulationCategory?: string | undefined;
}

function buildPrompt(sopTitle: string, sopText: string, regulation: VectorMatch[]): string {
  const excerpts = regulation
    .map((m, i) => {
      const ref = m.pageNumber !== null ? ` (page ${m.pageNumber})` : '';
      return `[${i + 1}]${ref} ${m.text}`;
    })
    .join('\n\n');

  return `You are an industrial compliance analyst. Compare the STANDARD OPERATING PROCEDURE (SOP)
against the REGULATION requirements and assess compliance.

For each distinct requirement in the REGULATION, assess whether the SOP satisfies it:
- "met": the SOP clearly addresses the requirement.
- "partial": addressed but incomplete or weaker than required (a compliance gap).
- "missing": not addressed at all (a missing section).
Also list direct CONFLICTS where the SOP contradicts the regulation.

Return ONLY JSON of this exact shape:
{
  "summary": string,
  "requirements": [{ "requirement": string, "status": "met"|"partial"|"missing", "evidence": string }],
  "conflicts": [{ "description": string, "evidence": string }],
  "recommendations": [string]
}

Rules:
- Derive requirements ONLY from the REGULATION excerpts. Do NOT invent requirements.
- "evidence" MUST cite the regulation excerpt number(s), e.g. [2], and briefly note what the SOP does/doesn't say.
- "recommendations" are concrete steps to close gaps and resolve conflicts.

REGULATION excerpts:
${excerpts}

SOP ("${sopTitle}"):
"""
${sopText}
"""`;
}

class ComplianceService {
  async analyze(input: ComplianceInput): Promise<ComplianceReport> {
    assertObjectId(input.sopDocumentId, 'sopDocumentId');
    const sop = await documentRepository.findByIdWithContent(input.sopDocumentId);
    if (!sop) throw HttpError.notFound(`SOP document not found: ${input.sopDocumentId}`);

    const sopText = (sop.contentText ?? '').trim();
    if (sopText.length === 0) {
      throw HttpError.badRequest(
        'The SOP document has no extractable text. Re-upload a text PDF or run OCR before analysis.',
      );
    }

    // Gather regulation evidence (full document if specified, else corpus retrieval).
    const regulation = await this.gatherRegulation(input, sop.title, sopText);
    const sopDocument: DocumentRef = { documentId: String(sop._id), title: sop.title };

    if (regulation.length === 0) {
      return this.emptyReport(
        sopDocument,
        'No regulation evidence was found. Upload and index a regulation document (or set its category to "regulation") and try again.',
      );
    }

    // Grounded analysis (synthesis is the only step that can fail on provider errors).
    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    let parsed: z.infer<typeof analysisSchema>;
    try {
      const result = await withRetry(
        () => model.generateContent(buildPrompt(sop.title, sopText.slice(0, env.COMPLIANCE_MAX_CHARS), regulation)),
        { label: 'compliance-analyze' },
      );
      parsed = analysisSchema.parse(parseJsonResponse(result.response.text()));
    } catch (error) {
      logger.error('Compliance synthesis failed', { sop: sopDocument.documentId, error: String(error) });
      throw new HttpError(503, `Compliance analysis is temporarily unavailable: ${String(error)}`);
    }

    // Deterministic compliance score from the per-requirement assessment.
    const total = parsed.requirements.length;
    const met = parsed.requirements.filter((r) => r.status === 'met').length;
    const partial = parsed.requirements.filter((r) => r.status === 'partial').length;
    const missing = parsed.requirements.filter((r) => r.status === 'missing').length;
    const complianceScore = total > 0 ? Math.round((100 * (met + 0.5 * partial)) / total) : 0;

    const citations: ComplianceCitation[] = regulation.map((m, i) => ({
      ref: i + 1,
      documentId: m.documentId,
      title: m.title,
      category: m.category,
      pageNumber: m.pageNumber,
      snippet: truncate(m.text),
    }));

    const regulationDocuments = this.distinctDocs(regulation);

    logger.info('Compliance report generated', {
      sop: sopDocument.documentId,
      complianceScore,
      total,
      missing,
      conflicts: parsed.conflicts.length,
    });

    return {
      determined: total > 0,
      sopDocument,
      regulationDocuments,
      complianceScore,
      summary: parsed.summary,
      counts: { total, met, partial, missing, conflicts: parsed.conflicts.length },
      requirements: parsed.requirements,
      missingRequirements: parsed.requirements
        .filter((r) => r.status === 'missing')
        .map((r) => ({ requirement: r.requirement, evidence: r.evidence })),
      conflicts: parsed.conflicts,
      recommendations: parsed.recommendations,
      citations,
    };
  }

  private async gatherRegulation(
    input: ComplianceInput,
    sopTitle: string,
    sopText: string,
  ): Promise<VectorMatch[]> {
    if (input.regulationDocumentId) {
      assertObjectId(input.regulationDocumentId, 'regulationDocumentId');
      const reg = await documentRepository.findById(input.regulationDocumentId);
      if (!reg) throw HttpError.notFound(`Regulation document not found: ${input.regulationDocumentId}`);
      return vectorRepository.getByDocument(input.regulationDocumentId, env.COMPLIANCE_MAX_CHUNKS);
    }

    // Corpus mode: retrieve the most relevant regulation chunks for this SOP.
    const category = input.regulationCategory ?? env.COMPLIANCE_REGULATION_CATEGORY;
    const embedding = await embeddingService.embedQuery(`${sopTitle}\n${sopText.slice(0, 2000)}`);
    return vectorRepository.query(embedding, env.COMPLIANCE_MAX_CHUNKS, { category });
  }

  private distinctDocs(chunks: VectorMatch[]): DocumentRef[] {
    const byId = new Map<string, DocumentRef>();
    for (const c of chunks) {
      if (!byId.has(c.documentId)) byId.set(c.documentId, { documentId: c.documentId, title: c.title });
    }
    return [...byId.values()];
  }

  private emptyReport(sopDocument: DocumentRef, summary: string): ComplianceReport {
    return {
      determined: false,
      sopDocument,
      regulationDocuments: [],
      complianceScore: 0,
      summary,
      counts: { total: 0, met: 0, partial: 0, missing: 0, conflicts: 0 },
      requirements: [],
      missingRequirements: [],
      conflicts: [],
      recommendations: [],
      citations: [],
    };
  }
}

export const complianceService = new ComplianceService();
