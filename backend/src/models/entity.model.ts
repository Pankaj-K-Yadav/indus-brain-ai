/**
 * Knowledge-graph Entity model. An entity is an industrial concept extracted
 * from a document (equipment, manufacturer, location, a reading, etc.).
 * Stored in MongoDB — no external graph database.
 */
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const ENTITY_TYPES = [
  'equipment',
  'manufacturer',
  'location',
  'pressure',
  'temperature',
  'voltage',
  'personnel',
  'maintenance_schedule',
  'safety_procedure',
  'inspection_date',
  'other',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface IEntity {
  documentId: Types.ObjectId;
  type: EntityType;
  name: string;
  normalizedName: string;
}

const entitySchema = new Schema<IEntity>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    type: { type: String, required: true, enum: [...ENTITY_TYPES], index: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

// Avoid duplicate entities per document; speed up entity search.
entitySchema.index({ documentId: 1, type: 1, normalizedName: 1 }, { unique: true });
entitySchema.index({ name: 'text' });

export type EntityDoc = HydratedDocument<IEntity>;
export const EntityModel = model<IEntity>('Entity', entitySchema);

export interface EntityDTO {
  id: string;
  documentId: string;
  type: EntityType;
  name: string;
}

export function toEntityDTO(doc: EntityDoc): EntityDTO {
  return {
    id: String(doc._id),
    documentId: String(doc.documentId),
    type: doc.type,
    name: doc.name,
  };
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
