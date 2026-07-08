import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ListChecks,
  FileText,
  Scale,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ListCard } from '@/components/ui/list-card';
import { CitationCard } from '@/components/ui/citation-card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { documentService } from '@/services/documentService';
import { complianceService } from '@/services/complianceService';
import type { DocumentDTO } from '@/types/document';
import type { ComplianceReport, RequirementStatus } from '@/types/compliance';

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

const STATUS: Record<RequirementStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  met: {
    label: 'Met',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  partial: {
    label: 'Gap',
    icon: MinusCircle,
    className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
  },
  missing: {
    label: 'Missing',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
  },
};

function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 80) return { ring: 'text-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Compliant' };
  if (score >= 50) return { ring: 'text-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Partial' };
  return { ring: 'text-red-500', text: 'text-red-600 dark:text-red-400', label: 'Non-compliant' };
}

export function CompliancePage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [sopId, setSopId] = useState('');
  const [regId, setRegId] = useState('all');
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    let ignore = false;
    documentService
      .list()
      .then((docs) => {
        if (!ignore) setDocuments(docs.filter((d) => d.indexed));
      })
      .catch(() => {
        if (!ignore) setDocuments([]);
      })
      .finally(() => {
        if (!ignore) setDocsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const analyze = async () => {
    if (!sopId) {
      toast({ variant: 'error', title: 'Select an SOP document first' });
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await complianceService.analyze({
        sopDocumentId: sopId,
        ...(regId !== 'all' ? { regulationDocumentId: regId } : {}),
      });
      setReport(result);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Compliance analysis failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <DashboardLayout
      title="Compliance Intelligence"
      subtitle="Compare an SOP against regulations to find missing sections, conflicts, and gaps."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Select documents
            </CardTitle>
            <CardDescription>
              Choose the SOP to evaluate and the regulation to check it against. Only indexed
              documents are available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="sop-select">
                  SOP document
                </label>
                <select
                  id="sop-select"
                  className={SELECT_CLASS}
                  value={sopId}
                  onChange={(e) => setSopId(e.target.value)}
                  disabled={docsLoading || isAnalyzing}
                >
                  <option value="">Select an SOP…</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="reg-select">
                  Regulation
                </label>
                <select
                  id="reg-select"
                  className={SELECT_CLASS}
                  value={regId}
                  onChange={(e) => setRegId(e.target.value)}
                  disabled={docsLoading || isAnalyzing}
                >
                  <option value="all">All regulations (corpus)</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.category})
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={() => void analyze()} disabled={isAnalyzing || !sopId} size="lg">
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAnalyzing ? 'Analyzing…' : 'Analyze'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAnalyzing ? <ComplianceSkeleton /> : report ? <ComplianceReportView report={report} /> : <ComplianceEmpty />}
      </div>
    </DashboardLayout>
  );
}

function ComplianceReportView({ report }: { report: ComplianceReport }) {
  const tone = scoreTone(report.complianceScore);
  return (
    <div className="space-y-5">
      {/* Score + summary */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <ScoreRing score={report.complianceScore} tone={tone} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className={cn('text-sm font-semibold', tone.text)}>{tone.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {report.summary || 'No summary available.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <CountChip label="Requirements" value={report.counts.total} />
              <CountChip label="Met" value={report.counts.met} tone="text-emerald-600 dark:text-emerald-400" />
              <CountChip label="Gaps" value={report.counts.partial} tone="text-amber-600 dark:text-amber-400" />
              <CountChip label="Missing" value={report.counts.missing} tone="text-red-600 dark:text-red-400" />
              <CountChip label="Conflicts" value={report.counts.conflicts} tone="text-red-600 dark:text-red-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> SOP: <span className="font-medium text-foreground">{report.sopDocument.title}</span>
              {report.regulationDocuments.length > 0 ? (
                <>
                  <span>· vs</span>
                  {report.regulationDocuments.map((r) => (
                    <span key={r.documentId} className="rounded-full border bg-card px-2 py-0.5">
                      {r.title}
                    </span>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {!report.determined ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8" />}
            title="No grounded assessment"
            description={report.summary}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <ListCard
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              title="Missing Requirements"
              empty="No missing requirements detected."
              items={report.missingRequirements.map((m) => `${m.requirement} — ${m.evidence}`)}
            />
            <ListCard
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              title="Conflicts"
              empty="No conflicts detected."
              items={report.conflicts.map((c) => `${c.description} — ${c.evidence}`)}
            />
          </div>

          <ListCard
            icon={<ListChecks className="h-5 w-5 text-primary" />}
            title="Recommendations"
            empty="No recommendations."
            items={report.recommendations}
            ordered
          />

          {/* Requirement matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requirement Coverage</CardTitle>
              <CardDescription>Each regulation requirement and how the SOP addresses it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {report.requirements.map((r, i) => {
                const s = STATUS[r.status];
                const Icon = s.icon;
                return (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{r.requirement}</p>
                      <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', s.className)}>
                        <Icon className="h-3.5 w-3.5" /> {s.label}
                      </span>
                    </div>
                    {r.evidence ? <p className="mt-1 text-sm text-muted-foreground">{r.evidence}</p> : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Citations */}
          {report.citations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Regulation Evidence
                </CardTitle>
                <CardDescription>Cited excerpts the assessment is grounded in.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {report.citations.map((c) => (
                  <CitationCard
                    key={c.ref}
                    index={c.ref}
                    title={c.title}
                    category={c.category}
                    pageNumber={c.pageNumber}
                    snippet={c.snippet}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number; tone: { ring: string } }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative mx-auto flex h-28 w-28 shrink-0 items-center justify-center">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} className="stroke-muted" strokeWidth="8" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className={cn('transition-all', tone.ring)}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-semibold tabular-nums">{score}</span>
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">score</span>
      </div>
    </div>
  );
}

function CountChip({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
      <span className={cn('font-semibold', tone)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function ComplianceEmpty() {
  return (
    <Card>
      <EmptyState
        icon={<ShieldCheck className="h-8 w-8" />}
        title="Run a compliance check"
        description="Pick an SOP and a regulation, then analyze. You'll get a grounded compliance score with missing requirements, conflicts, recommendations, and citations."
      />
    </Card>
  );
}

function ComplianceSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
