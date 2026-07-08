/**
 * Relationship repository. Persistence + queries for knowledge-graph edges.
 */
import type { FilterQuery } from 'mongoose';
import {
  RelationshipModel,
  type IRelationship,
  type RelationshipDoc,
} from '../models/relationship.model.js';

class RelationshipRepository {
  insertMany(relationships: IRelationship[]): Promise<RelationshipDoc[]> {
    return RelationshipModel.insertMany(relationships) as unknown as Promise<RelationshipDoc[]>;
  }

  findByDocument(documentId: string): Promise<RelationshipDoc[]> {
    return RelationshipModel.find({ documentId }).sort({ predicate: 1 }).exec();
  }

  findByDocumentIds(documentIds: string[]): Promise<RelationshipDoc[]> {
    return RelationshipModel.find({ documentId: { $in: documentIds } }).exec();
  }

  search(filter: FilterQuery<IRelationship>, limit = 100): Promise<RelationshipDoc[]> {
    return RelationshipModel.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await RelationshipModel.deleteMany({ documentId }).exec();
  }

  count(filter: FilterQuery<IRelationship> = {}): Promise<number> {
    return RelationshipModel.countDocuments(filter).exec();
  }
}

export const relationshipRepository = new RelationshipRepository();
