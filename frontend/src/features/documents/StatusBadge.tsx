import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  ScanLine,
  Gauge,
  Ban,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROCESSING_STAGE_LABELS } from '@/lib/processingStage';
import type { DocumentDTO } from '@/types/document';

interface StatusDescriptor {
  label: string;
  icon: LucideIcon;
  className: string;
  spin?: boolean;
}

function describe(doc: DocumentDTO): StatusDescriptor {
  const err = (doc.processingError ?? '').toLowerCase();
  switch (doc.status) {
    case 'processed':
      return {
        label: 'Indexed',
        icon: CheckCircle2,
        className:
          'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
      };
    case 'processing': {
      // Surface the fine-grained stage (e.g. "Generating Embeddings") when known.
      const stage = doc.processingStage;
      const label =
        stage && stage !== 'indexed' && stage !== 'failed'
          ? PROCESSING_STAGE_LABELS[stage]
          : 'Processing';
      return {
        label,
        icon: Loader2,
        spin: true,
        className:
          'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20',
      };
    }
    case 'uploaded':
      return {
        label: 'Uploaded',
        icon: Clock,
        className:
          'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20',
      };
    case 'failed':
    default:
      if (err.includes('no extractable text') || err.includes('ocr')) {
        return {
          label: 'OCR Required',
          icon: ScanLine,
          className:
            'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
        };
      }
      if (err.includes('429') || err.includes('quota')) {
        return {
          label: 'Quota Exceeded',
          icon: Gauge,
          className:
            'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-400/20',
        };
      }
      if (err.includes('indexing') || err.includes('gemini') || err.includes('embedding')) {
        return {
          label: 'Embedding Failed',
          icon: AlertTriangle,
          className:
            'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
        };
      }
      return {
        label: 'Failed',
        icon: Ban,
        className:
          'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
      };
  }
}

export function StatusBadge({ doc }: { doc: DocumentDTO }) {
  const { label, icon: Icon, className, spin } = describe(doc);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', spin && 'animate-spin')} />
      {label}
    </span>
  );
}
