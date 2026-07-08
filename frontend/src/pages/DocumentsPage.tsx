import { Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDocuments, type StatusFilter } from '@/hooks/useDocuments';
import { DocumentStats } from '@/features/documents/DocumentStats';
import { DocumentUploadForm } from '@/features/documents/DocumentUploadForm';
import { DocumentTable } from '@/features/documents/DocumentTable';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Indexed', value: 'processed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Uploaded', value: 'uploaded' },
  { label: 'Failed', value: 'failed' },
];

export function DocumentsPage() {
  const {
    documents,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    refresh,
    uploadDocument,
    deleteDocument,
    reindexDocument,
  } = useDocuments();

  return (
    <DashboardLayout
      title="Documents"
      subtitle="Manage the industrial documents that power your knowledge base."
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        <DocumentStats documents={documents} />

        <DocumentUploadForm onUpload={uploadDocument} />

        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Knowledge Base</h2>
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Status filter */}
              <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      statusFilter === f.value
                        ? 'bg-primary text-primary-foreground shadow-soft'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by title or filename…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <DocumentTable
            documents={documents}
            isLoading={isLoading}
            onDelete={deleteDocument}
            onReindex={reindexDocument}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}
