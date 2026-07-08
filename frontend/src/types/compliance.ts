/**
 * Compliance Intelligence types mirroring the backend compliance agent.
 */
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
  regulationDocumentId?: string;
  regulationCategory?: string;
}
