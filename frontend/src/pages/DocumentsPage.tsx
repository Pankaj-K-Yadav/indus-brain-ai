import { Search, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDocuments } from '@/hooks/useDocuments';
import { DocumentStats } from '@/features/documents/DocumentStats';
import { DocumentUploadForm } from '@/features/documents/DocumentUploadForm';
import { DocumentTable } from '@/features/documents/DocumentTable';

export function DocumentsPage() {
  const {
    documents,
    isLoading,
    error,
    search,
    setSearch,
    refresh,
    uploadDocument,
    deleteDocument,
  } = useDocuments();

  return (
    <DashboardLayout
      title="Documents"
      subtitle="Manage the industrial documents that power your knowledge base."
    >
      <div className="space-y-6">
        <DocumentStats documents={documents} />

        <DocumentUploadForm onUpload={uploadDocument} />

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by title or filename…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <DocumentTable documents={documents} isLoading={isLoading} onDelete={deleteDocument} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
