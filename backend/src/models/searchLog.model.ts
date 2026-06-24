/**
 * Search log model. Records knowledge-search queries for analytics and
 * observability (search volume, top topics, confidence trends).
 */
import { Schema, model, type HydratedDocument } from 'mongoose';

export const ASSISTANT_TYPES = ['general', 'sop', 'maintenance', 'incident', 'safety'] as const;
export type AssistantType = (typeof ASSISTANT_TYPES)[number];

export interface ISearchLog {
  query: string;
  assistant: AssistantType;
  confidence: number;
  sourceCount: number;
  answered: boolean;
}

const searchLogSchema = new Schema<ISearchLog>(
  {
    query: { type: String, required: true, trim: true },
    assistant: { type: String, required: true, enum: [...ASSISTANT_TYPES], default: 'general' },
    confidence: { type: Number, required: true, default: 0 },
    sourceCount: { type: Number, required: true, default: 0 },
    answered: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false },
);

export type SearchLogDoc = HydratedDocument<ISearchLog>;

export const SearchLogModel = model<ISearchLog>('SearchLog', searchLogSchema);
