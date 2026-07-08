import { useState, type ReactNode } from 'react';
import { Trash2, Loader2, Inbox, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fileTypeIcon } from '@/lib/fileType';
import { useToast } from '@/hooks/useToast';
import { StatusBadge } from './StatusBadge';
import type { DocumentDTO } from '@/types/document';

interface DocumentTableProps {
  documents: DocumentDTO[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
  onReindex: (id: string) => Promise<void>;
}

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'px-4 py-3 align-middle';

export function DocumentTable({ documents, isLoading, onDelete, onReindex }: DocumentTableProps) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentDTO | null>(null);
  const [details, setDetails] = useState<DocumentDTO | null>(null);

  const handleDelete = async (doc: DocumentDTO) => {
    setDeletingId(doc.id);
    try {
      await onDelete(doc.id);
      setConfirmDelete(null);
      toast({ variant: 'success', title: 'Document deleted', description: doc.title });
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Delete failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReindex = async (doc: DocumentDTO) => {
    setReindexingId(doc.id);
    try {
      await onReindex(doc.id);
      toast({ variant: 'success', title: 'Re-indexed', description: doc.title });
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Re-index failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setReindexingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="No documents yet"
          description="Upload your first industrial manual, SOP, or report above to begin building your AI knowledge base."
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
              <tr className="border-b">
                <th className={TH}>Document</th>
                <th className={cn(TH, 'hidden sm:table-cell')}>Type</th>
                <th className={cn(TH, 'hidden lg:table-cell')}>Category</th>
                <th className={cn(TH, 'hidden md:table-cell')}>Size</th>
                <th className={TH}>Status</th>
                <th className={cn(TH, 'hidden lg:table-cell')}>Uploaded</th>
                <th className={cn(TH, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                  <td className={TD}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {(() => {
                          const Icon = fileTypeIcon(doc.fileType);
                          return <Icon className="h-[18px] w-[18px]" />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{doc.originalName}</p>
                      </div>
                    </div>
                  </td>
                  <td className={cn(TD, 'hidden uppercase text-muted-foreground sm:table-cell')}>
                    {doc.fileType}
                  </td>
                  <td className={cn(TD, 'hidden lg:table-cell')}>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {doc.category}
                    </span>
                  </td>
                  <td className={cn(TD, 'hidden text-muted-foreground md:table-cell')}>
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className={TD}>
                    <StatusBadge doc={doc} />
                  </td>
                  <td className={cn(TD, 'hidden text-muted-foreground lg:table-cell')}>
                    {formatDate(doc.uploadDate)}
                  </td>
                  <td className={TD}>
                    <div className="flex items-center justify-end gap-1">
                      {doc.status === 'failed' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reindexingId === doc.id}
                          onClick={() => void handleReindex(doc)}
                        >
                          {reindexingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Retry</span>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`View details for ${doc.title}`}
                        onClick={() => setDetails(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${doc.title}`}
                        onClick={() => setConfirmDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete confirmation */}
      <Dialog
        open={confirmDelete !== null}
        onClose={() => (deletingId ? undefined : setConfirmDelete(null))}
        labelledBy="delete-title"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-title" className="text-lg font-semibold">
              Delete document?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{confirmDelete?.title}</span> will be
              permanently removed from MongoDB and its vectors deleted from ChromaDB. This cannot be
              undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deletingId !== null}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deletingId !== null}
            onClick={() => confirmDelete && void handleDelete(confirmDelete)}
          >
            {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Details */}
      <Dialog open={details !== null} onClose={() => setDetails(null)} labelledBy="details-title" className="max-w-lg">
        {details ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {(() => {
                  const Icon = fileTypeIcon(details.fileType);
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div className="min-w-0">
                <h2 id="details-title" className="truncate text-lg font-semibold">
                  {details.title}
                </h2>
                <p className="truncate text-xs text-muted-foreground">{details.originalName}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Status">
                <StatusBadge doc={details} />
              </Detail>
              <Detail label="Category">{details.category}</Detail>
              <Detail label="File type">{details.fileType.toUpperCase()}</Detail>
              <Detail label="Size">{formatFileSize(details.fileSize)}</Detail>
              <Detail label="Pages">{details.pageCount || '—'}</Detail>
              <Detail label="Chunks">{details.chunkCount.toLocaleString()}</Detail>
              <Detail label="Indexed">{details.indexed ? 'Yes' : 'No'}</Detail>
              <Detail label="Uploaded">{formatDate(details.uploadDate)}</Detail>
            </dl>
            {details.processingError ? (
              <div className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {details.processingError}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setDetails(null)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
