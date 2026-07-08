/**
 * Root Cause Analysis types mirroring the backend RCA agent.
 */
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

export interface RcaInput {
  problem: string;
  equipment?: string;
}
