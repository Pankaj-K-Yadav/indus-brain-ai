import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Brain,
  ClipboardList,
  Wrench,
  AlertTriangle,
  ShieldCheck,
  Search,
  Loader2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { knowledgeService } from '@/services/knowledgeService';
import type { AssistantType, KnowledgeAnswer } from '@/types/knowledge';

interface AssistantMeta {
  type: AssistantType;
  label: string;
  icon: ReactNode;
  examples: string[];
}

const ASSISTANTS: AssistantMeta[] = [
  { type: 'general', label: 'General', icon: <Brain className="h-4 w-4" />, examples: ['Summarize the safety guidelines for the boiler room'] },
  { type: 'sop', label: 'SOP', icon: <ClipboardList className="h-4 w-4" />, examples: ['What is the shutdown procedure?'] },
  { type: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" />, examples: ['How do I restart Pump A?'] },
  { type: 'incident', label: 'Incident', icon: <AlertTriangle className="h-4 w-4" />, examples: ['Find similar overheating incidents'] },
  { type: 'safety', label: 'Safety', icon: <ShieldCheck className="h-4 w-4" />, examples: ['What PPE is required for welding?'] },
];

function confidenceTone(confidence: number): { label: string; bar: string; variant: 'success' | 'warning' | 'destructive' } {
  if (confidence >= 0.7) return { label: 'High', bar: 'bg-emerald-500', variant: 'success' };
  if (confidence >= 0.4) return { label: 'Medium', bar: 'bg-amber-500', variant: 'warning' };
  return { label: 'Low', bar: 'bg-red-500', variant: 'destructive' };
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const tone = confidenceTone(confidence);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.round(confidence * 100)}%` }} />
      </div>
      <Badge variant={tone.variant}>
        {tone.label} · {Math.round(confidence * 100)}%
      </Badge>
    </div>
  );
}

function AnswerPanel({ result }: { result: KnowledgeAnswer }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Answer
            </CardTitle>
            <ConfidenceMeter confidence={result.confidence} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result.answered ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The assistant refused to answer because the indexed documents do not contain enough
              grounded information. This prevents hallucinated answers.
            </div>
          ) : null}
          <p className="whitespace-pre-wrap leading-relaxed">{result.answer}</p>
        </CardContent>
      </Card>

      {result.sources.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source documents</CardTitle>
            <CardDescription>Grounded references the answer was built from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.sources.map((src) => (
              <div
                key={src.documentId}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{src.title}</span>
                  <span className="text-xs text-muted-foreground">({src.originalName})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{src.category}</Badge>
                  {src.pages.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      p. {src.pages.join(', ')}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {result.retrievedChunks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retrieved context</CardTitle>
            <CardDescription>Top chunks returned by vector search, with similarity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.retrievedChunks.map((chunk, i) => (
              <div key={chunk.chunkId} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    [{i + 1}] {chunk.title}
                    {chunk.pageNumber !== null ? ` · p.${chunk.pageNumber}` : ''}
                  </span>
                  <Badge variant="secondary">{Math.round(chunk.score * 100)}% match</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{chunk.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function KnowledgeAssistantPage() {
  const [assistant, setAssistant] = useState<AssistantType>('general');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<KnowledgeAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMeta = ASSISTANTS.find((a) => a.type === assistant) ?? ASSISTANTS[0];

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setError('Please enter at least 3 characters.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const answer = await knowledgeService.search({ query: trimmed, assistant });
      setResult(answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  return (
    <DashboardLayout
      title="Knowledge Assistant"
      subtitle="Ask grounded questions across your industrial documents — answers cite their sources."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Assistant modes */}
        <div className="flex flex-wrap gap-2">
          {ASSISTANTS.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => setAssistant(a.type)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                assistant === a.type
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>

        {/* Search box */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={`Ask the ${activeMeta.label} assistant…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="sm:w-32">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isLoading ? 'Thinking…' : 'Ask'}
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Try:</span>
              {activeMeta.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQuery(ex);
                    void runSearch(ex);
                  }}
                  className="rounded-full border px-2 py-1 hover:bg-accent"
                  disabled={isLoading}
                >
                  {ex}
                </button>
              ))}
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {result ? <AnswerPanel result={result} /> : null}

        {!result && !isLoading ? (
          <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
            <Brain className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm">Ask a question to search your industrial knowledge base.</p>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
