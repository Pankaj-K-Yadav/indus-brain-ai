/**
 * Entity repository. Persistence + aggregations for knowledge-graph entities.
 */
import type { FilterQuery } from 'mongoose';
import { EntityModel, type IEntity, type EntityDoc } from '../models/entity.model.js';

export interface EntityTypeCount {
  type: string;
  count: number;
}

class EntityRepository {
  insertMany(entities: IEntity[]): Promise<EntityDoc[]> {
    return EntityModel.insertMany(entities) as unknown as Promise<EntityDoc[]>;
  }

  findByDocument(documentId: string): Promise<EntityDoc[]> {
    return EntityModel.find({ documentId }).sort({ type: 1, name: 1 }).exec();
  }

  findByDocumentIds(documentIds: string[]): Promise<EntityDoc[]> {
    return EntityModel.find({ documentId: { $in: documentIds } }).exec();
  }

  /**
   * Distinct document ids (excluding the given ones) that contain any of the
   * supplied normalized entity names — i.e. documents related via shared entities.
   */
  async findRelatedDocumentIds(
    normalizedNames: string[],
    excludeDocumentIds: string[],
    limit: number,
  ): Promise<string[]> {
    if (normalizedNames.length === 0) return [];
    const ids = await EntityModel.distinct('documentId', {
      normalizedName: { $in: normalizedNames },
      documentId: { $nin: excludeDocumentIds },
    }).exec();
    return ids.map((value) => String(value)).slice(0, limit);
  }

  search(filter: FilterQuery<IEntity>, limit = 100): Promise<EntityDoc[]> {
    return EntityModel.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await EntityModel.deleteMany({ documentId }).exec();
  }

  count(filter: FilterQuery<IEntity> = {}): Promise<number> {
    return EntityModel.countDocuments(filter).exec();
  }

  async countByType(): Promise<EntityTypeCount[]> {
    const rows = await EntityModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();
    return rows.map((r) => ({ type: r._id, count: r.count }));
  }

  /** Equipment that appears across multiple documents (repeated components). */
  async repeatedComponents(
    limit = 8,
  ): Promise<{ name: string; documentCount: number; occurrences: number }[]> {
    const rows = await EntityModel.aggregate<{
      name: string;
      occurrences: number;
      documentCount: number;
    }>([
      { $match: { type: 'equipment' } },
      {
        $group: {
          _id: '$normalizedName',
          name: { $first: '$name' },
          occurrences: { $sum: 1 },
          docs: { $addToSet: '$documentId' },
        },
      },
      { $project: { name: 1, occurrences: 1, documentCount: { $size: '$docs' } } },
      { $sort: { documentCount: -1, occurrences: -1 } },
      { $limit: limit },
    ]).exec();
    return rows.map((r) => ({
      name: r.name,
      documentCount: r.documentCount,
      occurrences: r.occurrences,
    }));
  }

  /** Most frequently mentioned entities (any type), by document spread. */
  async frequentEntities(
    limit = 10,
  ): Promise<{ type: string; name: string; documentCount: number }[]> {
    const rows = await EntityModel.aggregate<{
      type: string;
      name: string;
      documentCount: number;
    }>([
      {
        $group: {
          _id: { type: '$type', name: '$normalizedName' },
          name: { $first: '$name' },
          type: { $first: '$type' },
          docs: { $addToSet: '$documentId' },
        },
      },
      { $project: { name: 1, type: 1, documentCount: { $size: '$docs' } } },
      { $sort: { documentCount: -1 } },
      { $limit: limit },
    ]).exec();
    return rows.map((r) => ({ type: r.type, name: r.name, documentCount: r.documentCount }));
  }
}

export const entityRepository = new EntityRepository();
