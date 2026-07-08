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
import { type FilterQuery } from 'mongoose';
import { env, uploadDir } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/httpError.js';
import { assertObjectId } from '../utils/validation.js';
import { escapeRegExp } from '../utils/text.js';
import {
  resolveFileType,
  toDocumentDTO,
  type IDocument,
  type DocumentDTO,
  type DocumentDoc,
  type ProcessingStage,
} from '../models/document.model.js';
import { documentRepository } from '../repositories/document.repository.js';
import { documentProcessorService } from './documentProcessor.service.js';
import { embeddingService } from './embedding.service.js';
import { vectorRepository, type ChunkRecord } from '../repositories/vector.repository.js';
import { chunkPages, type TextChunk } from '../utils/chunking.js';
import { knowledgeGraphService } from './knowledgeGraph.service.js';

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

// Surfaced when extraction yields zero usable text (scanned / image-only PDF).
const NO_TEXT_ERROR = 'No extractable text (Scanned/Image PDF. OCR required)';

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
    const fileType = resolveFileType(input.file.mimetype, input.file.originalName);
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
        // The pipeline runs in the background, so the document starts as
        // 'processing' and the response returns immediately (no request timeout
        // on long OCR/embedding work). Clients poll for the final status.
        status: 'processing',
        processingStage: 'queued',
      });
    } catch (error) {
      await removeFile(input.file.filename);
      throw error;
    }

    logger.info('Document uploaded; processing in background', {
      id: String(created._id),
      title: created.title,
      fileType,
    });

    // Fire-and-forget: runPipeline never throws (it records failures on the
    // document); the catch is a last-resort guard against unexpected crashes.
    void this.runPipeline(created).catch((error) => {
      logger.error('Background pipeline crashed', {
        documentId: String(created._id),
        error: String(error),
      });
    });

    return toDocumentDTO(created);
  }

  /**
   * Ingestion pipeline: extract -> chunk -> embed -> index into ChromaDB.
   * Returns the updated document and never throws (failures are recorded on the
   * document and logged). Status contract enforced here:
   *   - "processed" is set ONLY after a successful ChromaDB upsert (truly searchable).
   *   - any failure leaves the document with status="failed", indexed=false,
   *     and a human-readable processingError.
   */
  private async runPipeline(doc: DocumentDoc): Promise<DocumentDoc> {
    const documentId = String(doc._id);
    const startedAt = Date.now();

    // TRANSITION: uploaded -> processing (work has started).
    await documentRepository.updateById(documentId, { status: 'processing' });
    logger.info('Pipeline started', { documentId, status: 'processing', fileType: doc.fileType });

    // Fine-grained progress hook: records the current pipeline stage for live UI
    // polling. Ordered (awaited) so stages never appear out of sequence.
    const onStage = async (stage: ProcessingStage): Promise<void> => {
      await documentRepository.updateById(documentId, { processingStage: stage });
    };

    // ---- Stage 1: text extraction (emits extracting_text / ocr / chunking) ----
    let fullText: string;
    let pageCount: number;
    let chunks: TextChunk[];
    try {
      const result = await documentProcessorService.processDocument(
        doc.filename,
        doc.fileType,
        onStage,
      );
      fullText = result.fullText;
      pageCount = result.pageCount;
      chunks = result.chunks;
    } catch (error) {
      // TRANSITION: processing -> failed (the file could not be read/parsed).
      logger.error('Pipeline failed: extraction', {
        documentId,
        status: 'failed',
        error: String(error),
        durationMs: Date.now() - startedAt,
      });
      const failed = await documentRepository.updateById(documentId, {
        status: 'failed',
        processingStage: 'failed',
        indexed: false,
        processingError: `Extraction failed: ${String(error)}`,
      });
      return failed ?? doc;
    }

    // Persist extracted content + counts regardless of indexing outcome so the
    // document can later be re-indexed without re-uploading.
    const storedContent = fullText.slice(0, MAX_CONTENT_CHARS);
    await documentRepository.updateById(documentId, {
      pageCount,
      chunkCount: chunks.length,
      contentText: storedContent,
      contentLength: storedContent.length,
    });

    // ---- Stage 2: guard — no extractable text --------------------------------
    if (chunks.length === 0) {
      // TRANSITION: processing -> failed (scanned/image-only PDF, nothing to index).
      // NOTE: this is NOT "processed" — there is no searchable content.
      logger.warn('Pipeline failed: no extractable text', {
        documentId,
        status: 'failed',
        pageCount,
        durationMs: Date.now() - startedAt,
      });
      const empty = await documentRepository.updateById(documentId, {
        status: 'failed',
        processingStage: 'failed',
        indexed: false,
        processingError: NO_TEXT_ERROR,
      });
      return empty ?? doc;
    }

    // ---- Stage 3: knowledge graph (best-effort, MongoDB only) ----------------
    // Runs for EVERY text-bearing document, independent of vector indexing, so a
    // Chroma/embedding failure never deprives a document of its graph. A KG
    // failure is swallowed and never affects status. ChromaDB is untouched here.
    await onStage('knowledge_graph');
    await this.extractKnowledgeGraph(documentId, fullText);

    // ---- Stage 4: embedding + ChromaDB indexing ------------------------------
    let indexedDoc: DocumentDoc;
    try {
      await onStage('embedding');
      const records = this.buildChunkRecords(doc, chunks);
      const vectorsInserted = await this.embedAndUpsert(records);

      // TRANSITION: processing -> processed (ONLY reached after a successful
      // ChromaDB upsert). processingError is cleared on success.
      indexedDoc =
        (await documentRepository.updateById(documentId, {
          status: 'processed',
          processingStage: 'indexed',
          indexed: true,
          processingError: '',
        })) ?? doc;
      logger.info('Pipeline succeeded: indexed', {
        documentId,
        status: 'processed',
        pageCount,
        chunkCount: records.length,
        vectorsInserted,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      // TRANSITION: processing -> failed (embedding/upsert failed, e.g. Gemini
      // quota / 429). Store the ACTUAL provider error so the cause is visible
      // (the UI classifies "quota exceeded" from this message).
      logger.error('Pipeline failed: embedding/indexing', {
        documentId,
        status: 'failed',
        pageCount,
        chunkCount: chunks.length,
        error: String(error),
        durationMs: Date.now() - startedAt,
      });
      const partial = await documentRepository.updateById(documentId, {
        status: 'failed',
        processingStage: 'failed',
        indexed: false,
        processingError: String(error),
      });
      return partial ?? doc;
    }

    return indexedDoc;
  }

  /** Best-effort knowledge-graph extraction; failures are logged, never thrown. */
  private async extractKnowledgeGraph(documentId: string, text: string): Promise<void> {
    if (!env.KG_ENABLED) return;
    try {
      await knowledgeGraphService.extractAndStore(documentId, text);
    } catch (error) {
      logger.warn('Knowledge graph extraction failed', { documentId, error: String(error) });
    }
  }

  /** Build vector-store records from a document's chunks. */
  private buildChunkRecords(doc: DocumentDoc, chunks: TextChunk[]): ChunkRecord[] {
    const documentId = String(doc._id);
    return chunks.map((c) => ({
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
  }

  /** Embed chunk text and upsert into ChromaDB. Returns vectors inserted. */
  private async embedAndUpsert(records: ChunkRecord[]): Promise<number> {
    const embeddings = await embeddingService.embedDocuments(records.map((r) => r.text));
    await vectorRepository.upsertChunks(records, embeddings);
    return records.length;
  }

  /**
   * Re-run embedding + indexing for an existing document without re-uploading.
   * Reuses stored extracted text when present, otherwise re-extracts from the
   * file. On success the document becomes processed + indexed; on embedding
   * failure it stays indexed=false and the error is surfaced to the caller.
   */
  async reindexDocument(id: string): Promise<DocumentDTO> {
    assertObjectId(id, 'document id');
    const doc = await documentRepository.findByIdWithContent(id);
    if (!doc) {
      throw HttpError.notFound(`Document not found: ${id}`);
    }

    const documentId = String(doc._id);
    const startedAt = Date.now();
    // TRANSITION: (any) -> processing while the re-index runs.
    await documentRepository.updateById(documentId, {
      status: 'processing',
      processingStage: 'embedding',
    });

    // Prefer stored extracted text; fall back to re-extraction from the file.
    let chunks: TextChunk[];
    let pageCount = doc.pageCount;
    const stored = doc.contentText?.trim() ?? '';
    let sourceText = stored;
    if (stored.length > 0) {
      chunks = chunkPages([{ pageNumber: null, text: stored }], {
        chunkSize: env.CHUNK_SIZE,
        chunkOverlap: env.CHUNK_OVERLAP,
      });
    } else {
      const result = await documentProcessorService.processDocument(doc.filename, doc.fileType);
      chunks = result.chunks;
      pageCount = result.pageCount;
      sourceText = result.fullText;
      const storedContent = result.fullText.slice(0, MAX_CONTENT_CHARS);
      await documentRepository.updateById(documentId, {
        pageCount,
        chunkCount: chunks.length,
        contentText: storedContent,
        contentLength: storedContent.length,
      });
    }

    // TRANSITION: processing -> failed (no extractable text — not searchable).
    if (chunks.length === 0) {
      await documentRepository.updateById(documentId, {
        status: 'failed',
        processingStage: 'failed',
        indexed: false,
        processingError: NO_TEXT_ERROR,
      });
      logger.warn('Re-index failed: no extractable text', { documentId, status: 'failed' });
      throw HttpError.badRequest(NO_TEXT_ERROR);
    }

    // Best-effort knowledge-graph refresh for the text-bearing document
    // (independent of vector indexing; never throws).
    await this.extractKnowledgeGraph(documentId, sourceText);

    try {
      const records = this.buildChunkRecords(doc, chunks);
      const vectorsInserted = await this.embedAndUpsert(records);
      // TRANSITION: processing -> processed (reached only after ChromaDB upsert).
      const indexed = await documentRepository.updateById(documentId, {
        status: 'processed',
        processingStage: 'indexed',
        indexed: true,
        chunkCount: records.length,
        processingError: '',
      });
      logger.info('Re-index succeeded: indexed', {
        documentId,
        status: 'processed',
        pageCount,
        chunkCount: records.length,
        vectorsInserted,
        durationMs: Date.now() - startedAt,
      });
      return toDocumentDTO(indexed ?? doc);
    } catch (error) {
      // TRANSITION: processing -> failed (embedding/upsert error, e.g. Gemini
      // quota). Persist the ACTUAL provider error, then surface it to the caller.
      logger.error('Re-index failed: embedding/indexing', {
        documentId,
        status: 'failed',
        chunkCount: chunks.length,
        error: String(error),
        durationMs: Date.now() - startedAt,
      });
      await documentRepository.updateById(documentId, {
        status: 'failed',
        processingStage: 'failed',
        indexed: false,
        processingError: String(error),
      });
      throw new HttpError(502, `Re-index failed: ${String(error)}`);
    }
  }

  async listDocuments(filters: ListDocumentsFilters): Promise<DocumentDTO[]> {
    const query: FilterQuery<IDocument> = {};

    if (filters.search) {
      // Escape user input so a search term can't act as a regex (ReDoS / injection).
      const term = new RegExp(escapeRegExp(filters.search.trim()), 'i');
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
    assertObjectId(id, 'document id');
    const document = await documentRepository.findById(id);
    if (!document) {
      throw HttpError.notFound(`Document not found: ${id}`);
    }
    return toDocumentDTO(document);
  }

  async deleteDocument(id: string): Promise<DocumentDTO> {
    assertObjectId(id, 'document id');
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
    // Best-effort knowledge-graph cleanup (MongoDB entities + relationships).
    try {
      await knowledgeGraphService.deleteForDocument(id);
    } catch (error) {
      logger.warn('Knowledge graph cleanup failed on delete', { id, error: String(error) });
    }
    logger.info('Document deleted', { id });
    return toDocumentDTO(deleted);
  }
}

export const documentService = new DocumentService();
