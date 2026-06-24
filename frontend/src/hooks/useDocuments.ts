/**
 * Data hook for the Documents feature. Handles listing (with search),
 * uploading, and deleting, plus loading/error state.
 */
import { useCallback, useEffect, useState } from 'react';
import { documentService } from '@/services/documentService';
import type { DocumentDTO, UploadDocumentInput } from '@/types/document';

interface UseDocumentsResult {
  documents: DocumentDTO[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => Promise<void>;
  uploadDocument: (input: UploadDocumentInput) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export function useDocuments(): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchDocuments = useCallback(async (term: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await documentService.list(term.trim() ? { search: term.trim() } : {});
      setDocuments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search-driven fetch.
  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchDocuments(search);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, fetchDocuments]);

  const refresh = useCallback(() => fetchDocuments(search), [fetchDocuments, search]);

  const uploadDocument = useCallback(
    async (input: UploadDocumentInput) => {
      await documentService.upload(input);
      await fetchDocuments(search);
    },
    [fetchDocuments, search],
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      await documentService.remove(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    },
    [],
  );

  return {
    documents,
    isLoading,
    error,
    search,
    setSearch,
    refresh,
    uploadDocument,
    deleteDocument,
  };
}
