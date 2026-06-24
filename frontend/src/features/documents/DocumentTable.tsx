import { useState } from 'react';
import { Trash2, Loader2, FileText, FileType2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { formatDate, formatFileSize } from '@/lib/format';
import type { DocumentDTO, DocumentStatus } from '@/types/document';

const STATUS_VARIANT: Record<DocumentStatus, BadgeProps['variant']> = {
  uploaded: 'secondary',
  processing: 'warning',
  processed: 'success',
  failed: 'destructive',
};

interface DocumentTableProps {
  documents: DocumentDTO[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
}

export function DocumentTable({ documents, isLoading, onDelete }: DocumentTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading documents…
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">No documents found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Size</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Uploaded</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b transition-colors hover:bg-muted/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {doc.fileType === 'pdf' ? (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileType2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{doc.originalName}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 uppercase text-muted-foreground">{doc.fileType}</td>
              <td className="px-4 py-3">{doc.category}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatFileSize(doc.fileSize)}</td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[doc.status]}>{doc.status}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.uploadDate)}</td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${doc.title}`}
                  disabled={deletingId === doc.id}
                  onClick={() => void handleDelete(doc.id)}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
