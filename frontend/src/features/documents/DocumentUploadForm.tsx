import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { UploadCloud, FileText, X, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_EXTENSIONS_RE,
  fileTypeIcon,
  fileTypeFromName,
} from '@/lib/fileType';
import { useToast } from '@/hooks/useToast';
import type { DocumentDTO, UploadDocumentInput } from '@/types/document';

const SUPPORTED_LABEL = 'PDF, DOCX, XLSX, CSV, PNG, JPG';

interface DocumentUploadFormProps {
  onUpload: (input: UploadDocumentInput) => Promise<DocumentDTO>;
}

export function DocumentUploadForm({ onUpload }: DocumentUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setTitle('');
    setCategory('general');
    if (inputRef.current) inputRef.current.value = '';
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!ACCEPTED_EXTENSIONS_RE.test(candidate.name)) {
      setError(`Unsupported file. Please choose a ${SUPPORTED_LABEL} file.`);
      return;
    }
    setError(null);
    setFile(candidate);
    if (!title.trim()) setTitle(candidate.name.replace(ACCEPTED_EXTENSIONS_RE, ''));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(`Please choose a ${SUPPORTED_LABEL} file.`);
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onUpload({ file, title: title.trim(), category: category.trim() || 'general' });
      reset();
      // Processing now runs in the background — track live progress in the list below.
      toast({
        variant: 'success',
        title: 'Upload received',
        description: `${result.title} is processing — watch its progress below.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-primary" /> Upload document
        </CardTitle>
        <CardDescription>
          Add a manual, SOP, report, spreadsheet, or scanned image to your AI knowledge base.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            aria-label={`Upload a ${SUPPORTED_LABEL} file`}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              dragActive
                ? 'border-primary bg-accent/60 scale-[1.01]'
                : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/40',
            )}
          >
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-glow transition-transform',
                dragActive && 'animate-bounce',
              )}
            >
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-medium">
                <span className="text-primary">Click to upload</span> or drag &amp; drop
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {SUPPORTED_LABEL} · up to 25&nbsp;MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
              disabled={isSubmitting}
            />
          </div>

          {/* Selected file preview */}
          {file ? (
            <div className="animate-slide-up flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {(() => {
                  const type = fileTypeFromName(file.name);
                  const Icon = type ? fileTypeIcon(type) : FileText;
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              {!isSubmitting ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove file"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* Metadata */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="doc-title">
                Title
              </label>
              <Input
                id="doc-title"
                placeholder="e.g. Pump Maintenance Manual"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="doc-category">
                Category
              </label>
              <Input
                id="doc-category"
                placeholder="general"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Progress (indeterminate while the server extracts + embeds) */}
          {isSubmitting ? (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="animate-shimmer h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground">
                Uploading… processing will continue in the list below.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={isSubmitting || !file}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Upload &amp; Index
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
