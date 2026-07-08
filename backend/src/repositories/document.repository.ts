/**
 * Document repository. Encapsulates all persistence access for documents — the
 * rest of the application never imports the Mongoose model directly.
 */
import type { FilterQuery } from 'mongoose';
import { DocumentModel, type IDocument, type DocumentDoc } from '../models/document.model.js';

export type CreateDocumentData = Pick<
  IDocument,
  'title' | 'filename' | 'originalName' | 'fileType' | 'fileSize' | 'uploadDate' | 'category' | 'status'
> &
  Partial<Pick<IDocument, 'processingStage'>>;

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

  /** Like findById, but includes the `contentText` field (excluded by default). */
  findByIdWithContent(id: string): Promise<DocumentDoc | null> {
    return DocumentModel.findById(id).select('+contentText').exec();
  }

  findByIds(ids: string[]): Promise<DocumentDoc[]> {
    return DocumentModel.find({ _id: { $in: ids } }).exec();
  }

  updateById(id: string, update: Partial<IDocument>): Promise<DocumentDoc | null> {
    return DocumentModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  deleteById(id: string): Promise<DocumentDoc | null> {
    return DocumentModel.findByIdAndDelete(id).exec();
  }

  count(filter: FilterQuery<IDocument> = {}): Promise<number> {
    return DocumentModel.countDocuments(filter).exec();
  }

  /** Sum of chunkCount across all documents (for analytics). */
  async totalChunks(): Promise<number> {
    const [row] = await DocumentModel.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$chunkCount' } } },
    ]).exec();
    return row?.total ?? 0;
  }

  /** Total bytes of all uploaded files. */
  async totalStorage(): Promise<number> {
    const [row] = await DocumentModel.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$fileSize' } } },
    ]).exec();
    return row?.total ?? 0;
  }

  /** Aggregate content length + chunk count for the average-chunk-size metric. */
  async contentStats(): Promise<{ totalContentChars: number; totalChunks: number }> {
    const [row] = await DocumentModel.aggregate<{ chars: number; chunks: number }>([
      { $group: { _id: null, chars: { $sum: '$contentLength' }, chunks: { $sum: '$chunkCount' } } },
    ]).exec();
    return { totalContentChars: row?.chars ?? 0, totalChunks: row?.chunks ?? 0 };
  }

  /** Document counts grouped by category, most common first. */
  async topCategories(limit = 6): Promise<{ category: string; count: number }[]> {
    const rows = await DocumentModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]).exec();
    return rows.map((r) => ({ category: r._id, count: r.count }));
  }

  /** Document counts bucketed by upload month (YYYY-MM) for trend charts. */
  async monthlyTrend(): Promise<{ period: string; count: number }[]> {
    const rows = await DocumentModel.aggregate<{ _id: { y: number; m: number }; count: number }>([
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]).exec();
    return rows.map((r) => ({
      period: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`,
      count: r.count,
    }));
  }

  findByStatuses(statuses: IDocument['status'][], limit = 10): Promise<DocumentDoc[]> {
    return DocumentModel.find({ status: { $in: statuses } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}

export const documentRepository = new DocumentRepository();
