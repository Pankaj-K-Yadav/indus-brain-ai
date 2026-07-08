/**
 * Lessons Learned types mirroring the backend lessons agent.
 */
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
