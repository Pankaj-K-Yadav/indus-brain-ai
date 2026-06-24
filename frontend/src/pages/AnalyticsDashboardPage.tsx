import { useEffect, useState, type ReactNode } from 'react';
import {
  FileText,
  DatabaseZap,
  Layers,
  Search,
  BrainCircuit,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { analyticsService } from '@/services/analyticsService';
import type { AnalyticsOverview } from '@/types/analytics';

interface StatCard {
  label: string;
  value: number;
  icon: ReactNode;
  hint: string;
}

export function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    analyticsService
      .overview()
      .then((overview) => {
        if (active) setData(overview);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load analytics');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards: StatCard[] = data
    ? [
        { label: 'Documents uploaded', value: data.documentsUploaded, icon: <FileText className="h-5 w-5" />, hint: 'Total documents in the system' },
        { label: 'Indexed documents', value: data.indexedDocuments, icon: <DatabaseZap className="h-5 w-5" />, hint: 'Available for AI search' },
        { label: 'Chunks created', value: data.chunksCreated, icon: <Layers className="h-5 w-5" />, hint: 'Searchable knowledge fragments' },
        { label: 'Vectors indexed', value: data.vectorsIndexed, icon: <BrainCircuit className="h-5 w-5" />, hint: 'Embeddings in ChromaDB' },
        { label: 'AI searches', value: data.aiSearches, icon: <Search className="h-5 w-5" />, hint: 'Knowledge queries performed' },
      ]
    : [];

  return (
    <DashboardLayout
      title="Overview"
      subtitle="Operational intelligence across your industrial knowledge base."
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading analytics…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {card.icon}
                  </div>
                  <p className="text-2xl font-semibold">{card.value.toLocaleString()}</p>
                  <p className="text-sm font-medium">{card.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" /> Top searched topics
              </CardTitle>
              <CardDescription>Most frequent knowledge queries.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topTopics.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No searches recorded yet.
                </p>
              ) : (
                <ol className="space-y-2">
                  {data.topTopics.map((topic, i) => (
                    <li
                      key={topic.query}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {i + 1}
                        </span>
                        <span className="capitalize">{topic.query}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{topic.count}×</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
