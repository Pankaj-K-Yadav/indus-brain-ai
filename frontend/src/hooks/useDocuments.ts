/**
 * Data hook for the Documents feature. Handles listing (with search + status
 * filter), uploading, deleting, and re-indexing, plus loading/error state.
 */
import { useCallback, useEffect, useState } from 'react';
import { documentService } from '@/services/documentService';
import type {
  DocumentDTO,
  DocumentStatus,
  ListDocumentsParams,
  UploadDocumentInput,
} from '@/types/document';

export type StatusFilter = DocumentStatus | 'all';

interface UseDocumentsResult {
  documents: DocumentDTO[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  refresh: () => Promise<void>;
  uploadDocument: (input: UploadDocumentInput) => Promise<DocumentDTO>;
  deleteDocument: (id: string) => Promise<void>;
  reindexDocument: (id: string) => Promise<void>;
}

export function useDocuments(): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchDocuments = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);
      try {
        const params: ListDocumentsParams = {};
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== 'all') params.status = statusFilter;
        const result = await documentService.list(params);
        setDocuments(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [search, statusFilter],
  );

  // Debounced fetch on search/filter change.
  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchDocuments();
    }, 300);
    return () => clearTimeout(handle);
  }, [fetchDocuments]);

  // Live progress: while any document is still processing, poll silently so the
  // pipeline stage badges update without a full-page loading flicker.
  useEffect(() => {
    const hasProcessing = documents.some((doc) => doc.status === 'processing');
    if (!hasProcessing) return;
    const handle = setInterval(() => {
      void fetchDocuments({ silent: true });
    }, 2500);
    return () => clearInterval(handle);
  }, [documents, fetchDocuments]);

  const refresh = useCallback(() => fetchDocuments(), [fetchDocuments]);

  const uploadDocument = useCallback(
    async (input: UploadDocumentInput) => {
      const created = await documentService.upload(input);
      await fetchDocuments();
      return created;
    },
    [fetchDocuments],
  );

  const deleteDocument = useCallback(async (id: string) => {
    await documentService.remove(id);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const reindexDocument = useCallback(async (id: string) => {
    const updated = await documentService.reindex(id);
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)));
  }, []);

  return {
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
  };
}
