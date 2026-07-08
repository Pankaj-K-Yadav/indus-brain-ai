import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast } from '@/lib/toast-context';

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;
const TONES = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-primary',
} as const;

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/** Stacked, glassy, auto-dismissing toasts (bottom-right). */
export function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="glass animate-slide-up pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-popover"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONES[t.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
