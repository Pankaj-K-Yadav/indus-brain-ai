import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  DatabaseZap,
  Layers,
  Search,
  AlertTriangle,
  Clock,
  TrendingUp,
  Upload,
  Sparkles,
  RefreshCw,
  Ruler,
  Share2,
  Workflow,
  HardDrive,
  ListChecks,
  FolderTree,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/features/documents/StatusBadge';
import { cn } from '@/lib/utils';
import { formatDate, formatFileSize } from '@/lib/format';
import { analyticsService } from '@/services/analyticsService';
import { documentService } from '@/services/documentService';
import type { AnalyticsOverview, EmbeddingStatus } from '@/types/analytics';
import type { DocumentDTO } from '@/types/document';

export function AnalyticsDashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recent, setRecent] = useState<DocumentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (isActive: () => boolean = () => true) => {
    setIsLoading(true);
    setError(null);
    Promise.all([analyticsService.overview(), documentService.list()])
      .then(([o, docs]) => {
        if (!isActive()) return;
        setOverview(o);
        setRecent(docs.slice(0, 5));
      })
      .catch((err: unknown) => {
        if (isActive()) setError(err instanceof Error ? err.message : 'Failed to load analytics');
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

  return (
    <DashboardLayout
      title="Overview"
      subtitle="Operational intelligence across your industrial knowledge base."
      actions={
        <Button variant="outline" size="sm" onClick={() => load()} disabled={isLoading}>
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </Button>
      }
    >
      {isLoading ? (
        <OverviewSkeleton />
      ) : error ? (
        <Card>
          <ErrorState title="Couldn't load analytics" message={error} onRetry={load} />
        </Card>
      ) : overview ? (
        <Overview overview={overview} recent={recent} />
      ) : null}
    </DashboardLayout>
  );
}

const EMBEDDING_STATUS: Record<EmbeddingStatus, { label: string; dot: string; text: string }> = {
  operational: { label: 'Operational', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  processing: { label: 'Processing', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  degraded: { label: 'Degraded', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  idle: { label: 'Idle', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
};

function Overview({ overview, recent }: { overview: AnalyticsOverview; recent: DocumentDTO[] }) {
  const coverage =
    overview.documentsUploaded > 0
      ? Math.round((overview.indexedDocuments / overview.documentsUploaded) * 100)
      : 0;
  const status = EMBEDDING_STATUS[overview.embeddingStatus];
  const maxCategory = overview.topCategories[0]?.count ?? 1;
  const maxQueried = overview.mostQueriedDocuments[0]?.count ?? 1;
  const maxTopic = overview.topTopics[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Documents" value={overview.documentsUploaded} icon={FileText} accent="indigo" />
        <StatCard label="Indexed" value={overview.indexedDocuments} icon={DatabaseZap} accent="emerald" />
        <StatCard label="Pending" value={overview.pendingProcessing} icon={Clock} accent="amber" />
        <StatCard label="Failed" value={overview.failedDocuments} icon={AlertTriangle} accent="red" />
        <StatCard label="Chunks Indexed" value={overview.chunksCreated.toLocaleString()} icon={Layers} accent="purple" />
        <StatCard label="Graph Nodes" value={overview.graphNodes.toLocaleString()} icon={Share2} accent="blue" />
        <StatCard label="Relationships" value={overview.graphRelationships.toLocaleString()} icon={Workflow} accent="indigo" />
        <StatCard label="Storage Used" value={formatFileSize(overview.storageUsed)} icon={HardDrive} accent="blue" />
        <StatCard label="Avg Chunk Size" value={`${overview.averageChunkSize.toLocaleString()} ch`} icon={Ruler} accent="slate" />
        <StatCard label="AI Searches" value={overview.aiSearches.toLocaleString()} icon={Search} accent="emerald" />
      </div>

      {/* Charts row: categories + most queried */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-5 w-5 text-primary" /> Top Categories
            </CardTitle>
            <CardDescription>Document distribution by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.topCategories.length === 0 ? (
              <EmptyHint icon={<FolderTree className="h-6 w-6" />} text="No documents yet." />
            ) : (
              <div className="space-y-3">
                {overview.topCategories.map((c) => (
                  <BarRow key={c.category} label={c.category} value={c.count} max={maxCategory} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" /> Most Queried Documents
            </CardTitle>
            <CardDescription>Documents most used to ground answers.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.mostQueriedDocuments.length === 0 ? (
              <EmptyHint icon={<Search className="h-6 w-6" />} text="No searches recorded yet." />
            ) : (
              <div className="space-y-3">
                {overview.mostQueriedDocuments.map((d) => (
                  <BarRow key={d.documentId} label={d.title} value={d.count} max={maxQueried} suffix="×" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status / queue / quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embedding Status</CardTitle>
            <CardDescription>Indexing health & coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', status.dot)} />
              <span className={cn('text-sm font-semibold', status.text)}>{status.label}</span>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Indexing coverage</span>
                <span className="font-medium">{coverage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                  style={{ width: `${coverage}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {overview.vectorsIndexed.toLocaleString()} vectors in ChromaDB ·{' '}
              {overview.indexedDocuments}/{overview.documentsUploaded} docs indexed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5 text-primary" /> Processing Queue
            </CardTitle>
            <CardDescription>{overview.processingQueue.length} in queue.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.processingQueue.length === 0 ? (
              <EmptyHint icon={<ListChecks className="h-6 w-6" />} text="Queue is clear." />
            ) : (
              <ul className="space-y-2">
                {overview.processingQueue.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{q.title}</span>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      {q.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Jump back into your workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction to="/documents" icon={<Upload className="h-5 w-5" />} accent="indigo" title="Upload document" hint="Add a manual or report" />
            <QuickAction to="/knowledge" icon={<Sparkles className="h-5 w-5" />} accent="purple" title="Ask the assistant" hint="Query your knowledge base" />
          </CardContent>
        </Card>
      </div>

      {/* Recent uploads + top topics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" /> Most Recent Uploads
            </CardTitle>
            <CardDescription>Latest documents added.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyHint icon={<Upload className="h-6 w-6" />} text="No documents uploaded yet." />
            ) : (
              <ul className="divide-y">
                {recent.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.uploadDate)}</p>
                    </div>
                    <StatusBadge doc={doc} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-5 w-5 text-primary" /> Top Searched Topics
            </CardTitle>
            <CardDescription>What your team asks most.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.topTopics.length === 0 ? (
              <EmptyHint icon={<Search className="h-6 w-6" />} text="No searches recorded yet." />
            ) : (
              <div className="space-y-3">
                {overview.topTopics.map((t) => (
                  <BarRow key={t.query} label={t.query} value={t.count} max={maxTopic} suffix="×" capitalize />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BarRow({
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
          {value.toLocaleString()}
          {suffix ?? ''}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  title,
  hint,
  accent,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
  accent: 'indigo' | 'purple';
}) {
  const chip =
    accent === 'indigo'
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
      : 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400';
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-elevated"
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', chip)}>{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}

function EmptyHint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
