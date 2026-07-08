import { useEffect, useState, type ReactNode } from 'react';
import {
  FileText,
  Share2,
  Workflow,
  FolderTree,
  Repeat2,
  TrendingUp,
  Cpu,
  Sparkles,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ListChecks,
  RefreshCw,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CitationCard } from '@/components/ui/citation-card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { lessonsService } from '@/services/lessonsService';
import type { LessonsOverview, LessonsSummary } from '@/types/lessons';

export function LessonsLearnedPage() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<LessonsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LessonsSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const load = (isActive: () => boolean = () => true) => {
    setIsLoading(true);
    setError(null);
    lessonsService
      .overview()
      .then((data) => {
        if (isActive()) setOverview(data);
      })
      .catch((err: unknown) => {
        if (isActive()) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (isActive()) setIsLoading(false);
      });
  };

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, []);

  const generate = async () => {
    setIsSummarizing(true);
    try {
      setSummary(await lessonsService.summary());
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Summary failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <DashboardLayout
      title="Lessons Learned"
      subtitle="Recurring failures, repeated components, and trends across your reports — evidence-backed."
      actions={
        <Button variant="outline" size="sm" onClick={() => load()} disabled={isLoading}>
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </Button>
      }
    >
      {isLoading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card>
          <ErrorState title="Couldn't load lessons" message={error} onRetry={load} />
        </Card>
      ) : overview ? (
        <div className="space-y-6">
          <Dashboard overview={overview} />
          <AiSummary
            summary={summary}
            isLoading={isSummarizing}
            onGenerate={() => void generate()}
          />
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Dashboard({ overview }: { overview: LessonsOverview }) {
  const maxComp = overview.repeatedComponents[0]?.documentCount ?? 1;
  const maxCat = overview.categoryBreakdown[0]?.count ?? 1;
  const maxTrend = Math.max(1, ...overview.failureTrend.map((t) => t.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reports" value={overview.totals.documents} icon={FileText} accent="indigo" />
        <StatCard label="Graph Nodes" value={overview.totals.entities.toLocaleString()} icon={Share2} accent="blue" />
        <StatCard label="Relationships" value={overview.totals.relationships.toLocaleString()} icon={Workflow} accent="purple" />
        <StatCard label="Categories" value={overview.totals.categories} icon={FolderTree} accent="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat2 className="h-5 w-5 text-primary" /> Repeated Components
            </CardTitle>
            <CardDescription>Equipment appearing across multiple reports.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.repeatedComponents.length === 0 ? (
              <Hint text="No repeated components yet." />
            ) : (
              <div className="space-y-3">
                {overview.repeatedComponents.map((c) => (
                  <Bar
                    key={c.name}
                    label={c.name}
                    value={c.documentCount}
                    max={maxComp}
                    suffix={` doc${c.documentCount === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" /> Failure / Report Trend
            </CardTitle>
            <CardDescription>Reports ingested per month.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.failureTrend.length === 0 ? (
              <Hint text="No trend data yet." />
            ) : (
              <div className="flex h-40 items-end gap-2">
                {overview.failureTrend.map((t) => (
                  <div key={t.period} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-primary to-purple-500"
                        style={{ height: `${Math.max(6, Math.round((t.count / maxTrend) * 100))}%` }}
                        title={`${t.count}`}
                      />
                    </div>
                    <span className="truncate text-[10px] text-muted-foreground">{t.period.slice(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-5 w-5 text-primary" /> Most Frequent Entities
            </CardTitle>
            <CardDescription>Across all reports.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.frequentEntities.length === 0 ? (
              <Hint text="No entities extracted yet." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {overview.frequentEntities.map((e) => (
                  <span
                    key={`${e.type}:${e.name}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
                  >
                    <span className="text-muted-foreground">{e.type.replace(/_/g, ' ')}:</span>
                    <span className="font-medium">{e.name}</span>
                    <span className="rounded-full bg-primary/10 px-1.5 text-primary">{e.documentCount}</span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-5 w-5 text-primary" /> Report Categories
            </CardTitle>
            <CardDescription>Distribution by document category.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.categoryBreakdown.length === 0 ? (
              <Hint text="No categories yet." />
            ) : (
              <div className="space-y-3">
                {overview.categoryBreakdown.map((c) => (
                  <Bar key={c.category} label={c.category} value={c.count} max={maxCat} capitalize />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AiSummary({
  summary,
  isLoading,
  onGenerate,
}: {
  summary: LessonsSummary | null;
  isLoading: boolean;
  onGenerate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" /> AI Lessons Summary
            </CardTitle>
            <CardDescription>Grounded analysis of recurring failures and key lessons.</CardDescription>
          </div>
          <Button onClick={onGenerate} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isLoading ? 'Analyzing…' : summary ? 'Regenerate' : 'Generate Summary'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : !summary ? (
          <EmptyState
            icon={<Lightbulb className="h-8 w-8" />}
            title="Generate an AI summary"
            description="Synthesize recurring failures, frequent problems, lessons, and recommendations — each cited to your reports."
          />
        ) : (
          <div className="space-y-5">
            {summary.summary ? (
              <p className="whitespace-pre-wrap leading-relaxed text-foreground">{summary.summary}</p>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <EvidenceList
                icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                title="Recurring Failures"
                empty="None identified."
                items={summary.recurringFailures.map((f) => ({ head: f.description, sub: f.evidence }))}
              />
              <EvidenceList
                icon={<Repeat2 className="h-5 w-5 text-amber-500" />}
                title="Most Frequent Problems"
                empty="None identified."
                items={summary.frequentProblems.map((p) => ({ head: p.problem, sub: p.evidence }))}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <SimpleList icon={<Lightbulb className="h-5 w-5 text-primary" />} title="Lessons" items={summary.lessons} />
              <SimpleList icon={<ListChecks className="h-5 w-5 text-primary" />} title="Recommendations" items={summary.recommendations} ordered />
            </div>

            {summary.citations.length > 0 ? (
              <details className="group rounded-lg border bg-muted/30">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>{summary.citations.length} cited excerpts</span>
                  <span className="transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  {summary.citations.map((c) => (
                    <CitationCard
                      key={c.ref}
                      index={c.ref}
                      title={c.title}
                      category={c.category}
                      pageNumber={c.pageNumber}
                      snippet={c.snippet}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({
  label,
  value,
  max,
  suffix,
  capitalize,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  capitalize?: boolean;
}) {
  const pct = Math.max(6, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={cn('min-w-0 truncate', capitalize && 'capitalize')}>{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {value}
          {suffix ?? ''}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EvidenceList({
  icon,
  title,
  items,
  empty,
}: {
  icon: ReactNode;
  title: string;
  items: { head: string; sub: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{it.head}</p>
              {it.sub ? <p className="text-xs text-muted-foreground">{it.sub}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SimpleList({
  icon,
  title,
  items,
  ordered,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : ordered ? (
        <ol className="space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
