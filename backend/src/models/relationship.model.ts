/**
 * Knowledge-graph Relationship model. A directed edge between two entities,
 * e.g. (Pump P101) -[located_in]-> (Unit 5). Stored in MongoDB.
 */
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { EntityType } from './entity.model.js';

export interface IRelationship {
  documentId: Types.ObjectId;
  subject: string;
  subjectNormalized: string;
  subjectType?: EntityType;
  predicate: string;
  object: string;
  objectNormalized: string;
  objectType?: EntityType;
  subjectEntityId?: Types.ObjectId;
  objectEntityId?: Types.ObjectId;
}

const relationshipSchema = new Schema<IRelationship>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    subjectNormalized: { type: String, required: true, index: true },
    subjectType: { type: String },
    predicate: { type: String, required: true, trim: true, index: true },
    object: { type: String, required: true, trim: true },
    objectNormalized: { type: String, required: true, index: true },
    objectType: { type: String },
    subjectEntityId: { type: Schema.Types.ObjectId, ref: 'Entity' },
    objectEntityId: { type: Schema.Types.ObjectId, ref: 'Entity' },
  },
  { timestamps: true, versionKey: false },
);

export type RelationshipDoc = HydratedDocument<IRelationship>;
export const RelationshipModel = model<IRelationship>('Relationship', relationshipSchema);

export interface RelationshipDTO {
  id: string;
  documentId: string;
  subject: string;
  subjectType?: EntityType;
  predicate: string;
  object: string;
  objectType?: EntityType;
}

export function toRelationshipDTO(doc: RelationshipDoc): RelationshipDTO {
  return {
    id: String(doc._id),
    documentId: String(doc.documentId),
    subject: doc.subject,
    predicate: doc.predicate,
    object: doc.object,
    ...(doc.subjectType ? { subjectType: doc.subjectType } : {}),
    ...(doc.objectType ? { objectType: doc.objectType } : {}),
  };
}
