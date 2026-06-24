/**
 * Document service. Orchestrates Document Management plus the Phase 2 knowledge
 * pipeline: on upload a document's text is extracted, chunked, embedded, and
 * indexed into the vector store. Extraction/chunking run locally and always
 * succeed; embedding + indexing degrade gracefully (the upload still succeeds
 * and the document is marked processed-but-not-indexed) so the API never breaks
 * when Gemini/ChromaDB are unavailable.
 */
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { isValidObjectId, type FilterQuery } from 'mongoose';
import { uploadDir } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/httpError.js';
import {
  SUPPORTED_MIME_TYPES,
  toDocumentDTO,
  type IDocument,
  type DocumentDTO,
  type DocumentDoc,
} from '../models/document.model.js';
import { documentRepository } from '../repositories/document.repository.js';
import { documentProcessorService } from './documentProcessor.service.js';
import { embeddingService } from './embedding.service.js';
import { vectorRepository, type ChunkRecord } from '../repositories/vector.repository.js';

export interface UploadedFileInput {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface CreateDocumentInput {
  title: string;
  category: string;
  file: UploadedFileInput;
}

export interface ListDocumentsFilters {
  search?: string | undefined;
  category?: string | undefined;
  status?: string | undefined;
}

const MAX_CONTENT_CHARS = 1_000_000;

function assertObjectId(id: string): void {
  if (!isValidObjectId(id)) {
    throw HttpError.badRequest(`Invalid document id: ${id}`);
  }
}

async function removeFile(filename: string): Promise<void> {
  const target = path.join(uploadDir, filename);
  try {
    await unlink(target);
    logger.info('Deleted upload file', { filename });
  } catch (error) {
    logger.warn('Failed to delete upload file', { filename, error: String(error) });
  }
}

class DocumentService {
  async createDocument(input: CreateDocumentInput): Promise<DocumentDTO> {
    const fileType = SUPPORTED_MIME_TYPES[input.file.mimetype as SupportedMimeKey];
    if (!fileType) {
      await removeFile(input.file.filename);
      throw HttpError.badRequest(`Unsupported file type: ${input.file.mimetype}`);
    }

    let created: DocumentDoc;
    try {
      created = await documentRepository.create({
        title: input.title,
        filename: input.file.filename,
        originalName: input.file.originalName,
        fileType,
        fileSize: input.file.size,
        uploadDate: new Date(),
        category: input.category,
        status: 'uploaded',
      });
    } catch (error) {
      await removeFile(input.file.filename);
      throw error;
    }

    logger.info('Document uploaded', { id: String(created._id), title: created.title, fileType });

    const processed = await this.runPipeline(created);
    return toDocumentDTO(processed);
  }

  /**
   * Extract -> chunk -> embed -> index. Returns the updated document. Never
   * throws: failures are recorded on the document and logged.
   */
  private async runPipeline(doc: DocumentDoc): Promise<DocumentDoc> {
    const documentId = String(doc._id);
    await documentRepository.updateById(documentId, { status: 'processing' });

    let fullText: string;
    let pageCount: number;
    let chunks: { text: string; pageNumber: number | null; chunkIndex: number }[];
    try {
      const result = await documentProcessorService.processDocument(doc.filename, doc.fileType);
      fullText = result.fullText;
      pageCount = result.pageCount;
      chunks = result.chunks;
    } catch (error) {
      logger.error('Text extraction failed', { documentId, error: String(error) });
      const failed = await documentRepository.updateById(documentId, {
        status: 'failed',
        processingError: `extraction: ${String(error)}`,
      });
      return failed ?? doc;
    }

    // Persist extracted content + counts regardless of indexing outcome.
    await documentRepository.updateById(documentId, {
      pageCount,
      chunkCount: chunks.length,
      contentText: fullText.slice(0, MAX_CONTENT_CHARS),
    });

    if (chunks.length === 0) {
      logger.warn('No text chunks produced', { documentId });
      const empty = await documentRepository.updateById(documentId, { status: 'processed', indexed: false });
      return empty ?? doc;
    }

    // Embedding + vector indexing (best-effort).
    try {
      const records: ChunkRecord[] = chunks.map((c) => ({
        chunkId: `${documentId}:${c.chunkIndex}`,
        documentId,
        text: c.text,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        category: doc.category,
        title: doc.title,
        originalName: doc.originalName,
        fileType: doc.fileType,
      }));

      const embeddings = await embeddingService.embedDocuments(records.map((r) => r.text));
      await vectorRepository.upsertChunks(records, embeddings);

      const indexed = await documentRepository.updateById(documentId, {
        status: 'processed',
        indexed: true,
      });
      logger.info('Document indexed', { documentId, chunks: records.length });
      return indexed ?? doc;
    } catch (error) {
      logger.error('Embedding/indexing failed; document extracted but not indexed', {
        documentId,
        error: String(error),
      });
      const partial = await documentRepository.updateById(documentId, {
        status: 'processed',
        indexed: false,
        processingError: `indexing: ${String(error)}`,
      });
      return partial ?? doc;
    }
  }

  async listDocuments(filters: ListDocumentsFilters): Promise<DocumentDTO[]> {
    const query: FilterQuery<IDocument> = {};

    if (filters.search) {
      const term = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ title: term }, { originalName: term }];
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.status) {
      query.status = filters.status as IDocument['status'];
    }

    const documents = await documentRepository.findMany(query);
    return documents.map(toDocumentDTO);
  }

  async getDocumentById(id: string): Promise<DocumentDTO> {
    assertObjectId(id);
    const document = await documentRepository.findById(id);
    if (!document) {
      throw HttpError.notFound(`Document not found: ${id}`);
    }
    return toDocumentDTO(document);
  }

  async deleteDocument(id: string): Promise<DocumentDTO> {
    assertObjectId(id);
    const deleted = await documentRepository.deleteById(id);
    if (!deleted) {
      throw HttpError.notFound(`Document not found: ${id}`);
    }
    await removeFile(deleted.filename);
    // Best-effort vector cleanup — never fail the delete if the store is down.
    try {
      await vectorRepository.deleteByDocument(id);
    } catch (error) {
      logger.warn('Vector cleanup failed on delete', { id, error: String(error) });
    }
    logger.info('Document deleted', { id });
    return toDocumentDTO(deleted);
  }
}

type SupportedMimeKey = keyof typeof SUPPORTED_MIME_TYPES;

export const documentService = new DocumentService();
