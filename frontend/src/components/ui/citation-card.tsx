/**
 * A single grounded-evidence citation row, shared across the AI feature pages
 * (Knowledge, RCA, Compliance, Lessons) so citation rendering stays consistent.
 */
interface CitationCardProps {
  index: number;
  title: string;
  category: string;
  pageNumber: number | null;
  snippet: string;
  /** Retrieval similarity (0-1). When provided, shown as an "N% match" badge. */
  score?: number;
}

export function CitationCard({ index, title, category, pageNumber, snippet, score }: CitationCardProps) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
          {index}
        </span>
        <span className="font-medium">{title}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{category}</span>
        {pageNumber !== null ? <span className="text-muted-foreground">p.{pageNumber}</span> : null}
        {score !== undefined ? (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            {Math.round(score * 100)}% match
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{snippet}</p>
    </div>
  );
}
