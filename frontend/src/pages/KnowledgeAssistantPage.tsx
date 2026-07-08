import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Brain,
  ClipboardList,
  Wrench,
  AlertTriangle,
  ShieldCheck,
  Search,
  Sparkles,
  FileText,
  User,
  CornerDownLeft,
  Tag,
  HelpCircle,
  Link2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { knowledgeService } from '@/services/knowledgeService';
import type { AssistantType, KnowledgeAnswer } from '@/types/knowledge';

interface AssistantMeta {
  type: AssistantType;
  label: string;
  icon: typeof Brain;
  examples: string[];
}

const ASSISTANTS: AssistantMeta[] = [
  { type: 'general', label: 'General', icon: Brain, examples: ['Summarize the boiler-room safety guidelines'] },
  { type: 'sop', label: 'SOP', icon: ClipboardList, examples: ['What is the shutdown procedure?'] },
  { type: 'maintenance', label: 'Maintenance', icon: Wrench, examples: ['How do I restart Pump A?'] },
  { type: 'incident', label: 'Incident', icon: AlertTriangle, examples: ['Find similar overheating incidents'] },
  { type: 'safety', label: 'Safety', icon: ShieldCheck, examples: ['What PPE is required for welding?'] },
];

interface Turn {
  id: string;
  query: string;
  loading: boolean;
  answer: KnowledgeAnswer | null;
  error: string | null;
}

function confidenceTone(confidence: number): { label: string; className: string; bar: string } {
  if (confidence >= 0.7)
    return { label: 'High confidence', className: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
  if (confidence >= 0.4)
    return { label: 'Medium confidence', className: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
  return { label: 'Low confidence', className: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' };
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-thinking-bounce rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <span className="text-sm">Searching the knowledge base…</span>
    </div>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const tone = confidenceTone(confidence);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.round(confidence * 100)}%` }} />
      </div>
      <span className={cn('text-xs font-medium', tone.className)}>
        {tone.label} · {Math.round(confidence * 100)}%
      </span>
    </div>
  );
}

function AnswerCard({
  answer,
  onFollowUp,
}: {
  answer: KnowledgeAnswer;
  onFollowUp: (question: string) => void;
}) {
  return (
    <div className="space-y-4">
      {!answer.answered ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Answered conservatively: the indexed documents don&apos;t contain enough grounded
            information. This prevents hallucinations.
          </span>
        </div>
      ) : null}

      <p className="whitespace-pre-wrap leading-relaxed text-foreground">{answer.answer}</p>

      <ConfidenceMeter confidence={answer.confidence} />

      {answer.sources.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {answer.sources.map((s) => (
            <span
              key={s.documentId}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{s.title}</span>
              {s.pages.length > 0 ? (
                <span className="text-muted-foreground">· p.{s.pages.join(', ')}</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {answer.retrievedChunks.length > 0 ? (
        <details className="group rounded-lg border bg-muted/30">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{answer.retrievedChunks.length} retrieved passages</span>
            <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {answer.retrievedChunks.map((c, i) => (
              <div key={c.chunkId} className="rounded-md border bg-card p-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">
                    [{i + 1}] {c.title}
                    {c.pageNumber !== null ? ` · p.${c.pageNumber}` : ''}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {Math.round(c.score * 100)}% match
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {answer.relatedEquipment.length > 0 ? (
        <ChipGroup icon={<Wrench className="h-3.5 w-3.5" />} label="Related equipment">
          {answer.relatedEquipment.map((e) => (
            <Chip key={e}>{e}</Chip>
          ))}
        </ChipGroup>
      ) : null}

      {answer.relatedEntities.length > 0 ? (
        <ChipGroup icon={<Tag className="h-3.5 w-3.5" />} label="Related entities">
          {answer.relatedEntities.map((e) => (
            <Chip key={`${e.type}:${e.name}`}>
              <span className="text-muted-foreground">{e.type.replace(/_/g, ' ')}:</span> {e.name}
            </Chip>
          ))}
        </ChipGroup>
      ) : null}

      {answer.relatedDocuments.length > 0 ? (
        <ChipGroup icon={<Link2 className="h-3.5 w-3.5" />} label="Related documents">
          {answer.relatedDocuments.map((d) => (
            <Chip key={d.documentId}>
              <FileText className="h-3 w-3 text-primary" /> {d.title}
            </Chip>
          ))}
        </ChipGroup>
      ) : null}

      {answer.followUpQuestions.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" /> Suggested follow-ups
          </p>
          <div className="flex flex-col gap-1.5">
            {answer.followUpQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp(q)}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChipGroup({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs">
      {children}
    </span>
  );
}

function Bubble({ role, children }: { role: 'user' | 'ai'; children: ReactNode }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-soft',
        )}
      >
        {isUser ? <User className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl border px-4 py-3 text-sm',
          isUser ? 'rounded-tr-sm bg-secondary' : 'rounded-tl-sm bg-card shadow-soft',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function KnowledgeAssistantPage() {
  const [assistant, setAssistant] = useState<AssistantType>('general');
  const [query, setQuery] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeMeta = ASSISTANTS.find((a) => a.type === assistant) ?? ASSISTANTS[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const runSearch = async (raw: string) => {
    const q = raw.trim();
    if (q.length < 3 || isThinking) return;
    const id = crypto.randomUUID();
    setTurns((prev) => [...prev, { id, query: q, loading: true, answer: null, error: null }]);
    setQuery('');
    setIsThinking(true);
    try {
      const answer = await knowledgeService.search({ query: q, assistant });
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, loading: false, answer } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, loading: false, error: message } : t)));
    } finally {
      setIsThinking(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSearch(query);
  };

  const hasConversation = turns.length > 0;

  return (
    <DashboardLayout
      title="Knowledge Assistant"
      subtitle="Ask grounded questions across your industrial documents — answers cite their sources."
    >
      <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
        {/* Assistant modes */}
        <div className="flex flex-wrap gap-2 pb-4">
          {ASSISTANTS.map((a) => {
            const Icon = a.icon;
            const active = a.type === assistant;
            return (
              <button
                key={a.type}
                type="button"
                onClick={() => setAssistant(a.type)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground shadow-soft'
                    : 'bg-card hover:border-primary/40 hover:bg-accent',
                )}
              >
                <Icon className="h-4 w-4" />
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Conversation / empty hero */}
        <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-4">
          {!hasConversation ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-glow">
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">How can I help with operations?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask the {activeMeta.label} assistant — answers are grounded in your documents.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {activeMeta.examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => void runSearch(ex)}
                    className="rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="animate-slide-up space-y-4">
                <Bubble role="user">{turn.query}</Bubble>
                <Bubble role="ai">
                  {turn.loading ? (
                    <ThinkingDots />
                  ) : turn.error ? (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" /> {turn.error}
                    </div>
                  ) : turn.answer ? (
                    <AnswerCard answer={turn.answer} onFollowUp={(q) => void runSearch(q)} />
                  ) : null}
                </Bubble>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <form onSubmit={onSubmit} className="pt-2">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-soft focus-within:border-primary/40 focus-within:shadow-glow">
            <Search className="mb-2.5 ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
            <textarea
              rows={1}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void runSearch(query);
                }
              }}
              placeholder={`Ask the ${activeMeta.label} assistant…`}
              className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon" disabled={isThinking || query.trim().length < 3} aria-label="Ask">
              <CornerDownLeft className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Answers are grounded in your indexed documents and cite their sources.
          </p>
        </form>
      </div>
    </DashboardLayout>
  );
}
