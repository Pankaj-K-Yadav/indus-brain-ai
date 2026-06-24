/**
 * Document service. Orchestrates the Document Management use cases: persisting
 * uploaded files' metadata, querying, and deletion (including local file
 * cleanup). Business rules live here; HTTP concerns do not.
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
} from '../models/document.model.js';
import { documentRepository } from '../repositories/document.repository.js';

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
    // File may already be gone; log and continue rather than failing the request.
    logger.warn('Failed to delete upload file', { filename, error: String(error) });
  }
}

class DocumentService {
  async createDocument(input: CreateDocumentInput): Promise<DocumentDTO> {
    const fileType = SUPPORTED_MIME_TYPES[input.file.mimetype as SupportedMimeKey];
    if (!fileType) {
      // Defensive: middleware already filters, but never trust upstream blindly.
      await removeFile(input.file.filename);
      throw HttpError.badRequest(`Unsupported file type: ${input.file.mimetype}`);
    }

    try {
      const created = await documentRepository.create({
        title: input.title,
        filename: input.file.filename,
        originalName: input.file.originalName,
        fileType,
        fileSize: input.file.size,
        uploadDate: new Date(),
        category: input.category,
        status: 'uploaded',
      });
      logger.info('Document created', { id: String(created._id), title: created.title, fileType });
      return toDocumentDTO(created);
    } catch (error) {
      // Roll back the orphaned file if the DB write fails.
      await removeFile(input.file.filename);
      throw error;
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
    logger.info('Document deleted', { id });
    return toDocumentDTO(deleted);
  }
}

type SupportedMimeKey = keyof typeof SUPPORTED_MIME_TYPES;

export const documentService = new DocumentService();
