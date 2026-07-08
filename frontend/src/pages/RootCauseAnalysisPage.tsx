import { useState, type FormEvent } from 'react';
import {
  Microscope,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Wrench,
  FileText,
  Quote,
  Cpu,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ListCard } from '@/components/ui/list-card';
import { CitationCard } from '@/components/ui/citation-card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { rcaService } from '@/services/rcaService';
import type { RcaResult } from '@/types/rca';

const EXAMPLES = [
  'Pump P101 is overheating and tripping on high temperature',
  'Recurring seal leakage on the boiler feedwater pump',
  'Motor M22 vibration exceeded alarm threshold during inspection',
];

function confidenceTone(c: number): { label: string; bar: string; text: string } {
  if (c >= 0.7) return { label: 'High', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  if (c >= 0.4) return { label: 'Medium', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  return { label: 'Low', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
}

export function RootCauseAnalysisPage() {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState('');
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<RcaResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 5) {
      toast({ variant: 'error', title: 'Describe the problem in a bit more detail' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await rcaService.analyze({
        problem: trimmed,
        ...(equipment.trim() ? { equipment: equipment.trim() } : {}),
      });
      setResult(res);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Analysis failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(problem);
  };

  return (
    <DashboardLayout
      title="Root Cause Analysis"
      subtitle="Correlate maintenance, incident, inspection & manual records into a grounded root cause."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-primary" /> Describe the problem
            </CardTitle>
            <CardDescription>
              The agent retrieves and correlates evidence across your documents — it only reasons from
              what it can cite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="rca-equipment">
                    Equipment (optional)
                  </label>
                  <Input
                    id="rca-equipment"
                    placeholder="e.g. Pump P101"
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="rca-problem">
                    Problem / symptom
                  </label>
                  <textarea
                    id="rca-problem"
                    rows={3}
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Describe the failure, symptom, or incident…"
                    disabled={isLoading}
                    className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setProblem(ex);
                        void run(ex);
                      }}
                      className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <Button type="submit" disabled={isLoading} size="lg">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isLoading ? 'Analyzing…' : 'Analyze'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {isLoading ? <RcaSkeleton /> : result ? <RcaReport result={result} /> : <RcaEmpty />}
      </div>
    </DashboardLayout>
  );
}

function RcaReport({ result }: { result: RcaResult }) {
  const tone = confidenceTone(result.confidence);
  return (
    <div className="space-y-5">
      {/* Root cause */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              {result.determined ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Likely Root Cause
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.round(result.confidence * 100)}%` }} />
              </div>
              <span className={cn('text-xs font-medium', tone.text)}>
                {tone.label} · {Math.round(result.confidence * 100)}%
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!result.determined ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Evidence was insufficient to confidently ground a root cause.</span>
            </div>
          ) : null}
          <p className="whitespace-pre-wrap leading-relaxed">{result.rootCause}</p>
          {result.relatedEquipment.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> Related equipment
              </span>
              {result.relatedEquipment.map((e) => (
                <span key={e} className="rounded-full border bg-card px-2.5 py-0.5 text-xs">
                  {e}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Evidence / actions / preventive */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ListCard
          icon={<Quote className="h-5 w-5 text-primary" />}
          title="Supporting Evidence"
          items={result.supportingEvidence}
          empty="No grounded evidence."
        />
        <ListCard
          icon={<ListChecks className="h-5 w-5 text-primary" />}
          title="Recommended Actions"
          items={result.recommendedActions}
          empty="No actions available."
          ordered
        />
        <ListCard
          icon={<Wrench className="h-5 w-5 text-primary" />}
          title="Preventive Maintenance"
          items={result.preventiveMaintenance}
          empty="No suggestions available."
        />
      </div>

      {/* Citations */}
      {result.citations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" /> Cited Evidence
            </CardTitle>
            <CardDescription>Every conclusion is grounded in these excerpts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {result.citations.map((c) => (
              <CitationCard
                key={c.ref}
                index={c.ref}
                title={c.title}
                category={c.category}
                pageNumber={c.pageNumber}
                snippet={c.snippet}
                score={c.score}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RcaEmpty() {
  return (
    <Card>
      <EmptyState
        icon={<Microscope className="h-8 w-8" />}
        title="Run a root cause analysis"
        description="Describe a failure or incident. The agent correlates maintenance, incident, inspection, and manual records to find the likely cause — with citations."
      />
    </Card>
  );
}

function RcaSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
