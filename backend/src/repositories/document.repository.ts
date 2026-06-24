/**
 * Document repository. Encapsulates all persistence access for documents — the
 * rest of the application never imports the Mongoose model directly.
 */
import type { FilterQuery } from 'mongoose';
import { DocumentModel, type IDocument, type DocumentDoc } from '../models/document.model.js';

export type CreateDocumentData = Pick<
  IDocument,
  'title' | 'filename' | 'originalName' | 'fileType' | 'fileSize' | 'uploadDate' | 'category' | 'status'
>;

class DocumentRepository {
  create(data: CreateDocumentData): Promise<DocumentDoc> {
    return DocumentModel.create(data);
  }

  findMany(filter: FilterQuery<IDocument> = {}): Promise<DocumentDoc[]> {
    return DocumentModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<DocumentDoc | null> {
    return DocumentModel.findById(id).exec();
  }

  deleteById(id: string): Promise<DocumentDoc | null> {
    return DocumentModel.findByIdAndDelete(id).exec();
  }

  count(filter: FilterQuery<IDocument> = {}): Promise<number> {
    return DocumentModel.countDocuments(filter).exec();
  }
}

export const documentRepository = new DocumentRepository();
