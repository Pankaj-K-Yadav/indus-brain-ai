/**
 * Knowledge Graph service. Extracts industrial entities and their relationships
 * from a document's text using Gemini, and persists them in MongoDB (no Neo4j,
 * no graph DB). Also serves graph reads/searches.
 *
 * Extraction is best-effort and isolated from the indexing pipeline: a failure
 * here (e.g. Gemini quota) never changes a document's processed/indexed status,
 * and ChromaDB is never touched.
 */
import { Types, type FilterQuery } from 'mongoose';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { z, assertObjectId } from '../utils/validation.js';
import { escapeRegExp } from '../utils/text.js';
import { parseJsonResponse } from '../utils/json.js';
import { getGeminiClient } from '../integrations/gemini.js';
import {
  ENTITY_TYPES,
  normalizeName,
  toEntityDTO,
  type EntityType,
  type IEntity,
  type EntityDTO,
} from '../models/entity.model.js';
import {
  toRelationshipDTO,
  type IRelationship,
  type RelationshipDoc,
  type RelationshipDTO,
} from '../models/relationship.model.js';
import { entityRepository, type EntityTypeCount } from '../repositories/entity.repository.js';
import { relationshipRepository } from '../repositories/relationship.repository.js';
import { documentRepository } from '../repositories/document.repository.js';

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

const extractionSchema = z.object({
  entities: z
    .array(z.object({ type: z.string(), name: z.string() }))
    .default([]),
  relationships: z
    .array(
      z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.string(),
        subjectType: z.string().nullish(),
        objectType: z.string().nullish(),
      }),
    )
    .default([]),
});

function coerceType(value: string | null | undefined): EntityType | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return ENTITY_TYPE_SET.has(normalized) ? (normalized as EntityType) : undefined;
}

function normalizePredicate(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildPrompt(text: string): string {
  return `You are an information-extraction engine for industrial technical documents.
Extract entities and relationships from the TEXT below.

Return ONLY JSON of this exact shape:
{
  "entities": [{ "type": "<entity_type>", "name": "<concrete value>" }],
  "relationships": [{ "subject": "<name>", "predicate": "<snake_case_verb>", "object": "<name>", "subjectType": "<entity_type|null>", "objectType": "<entity_type|null>" }]
}

entity_type must be one of:
equipment, manufacturer, location, pressure, temperature, voltage, personnel, maintenance_schedule, safety_procedure, inspection_date, other

Rules:
- Only include facts explicitly supported by the text.
- "name" is the concrete value, e.g. "Pump P101", "Siemens", "Unit 5", "150 PSI", "75°C", "440V".
- predicate is snake_case, e.g. located_in, manufactured_by, operates_at, monitored_by, maintained_by, requires, inspected_on, part_of.
- If nothing is found, return {"entities":[],"relationships":[]}.

TEXT:
"""
${text}
"""`;
}

export interface ExtractionResult {
  entities: number;
  relationships: number;
}

export interface DocumentGraph {
  documentId: string;
  entities: EntityDTO[];
  relationships: RelationshipDTO[];
}

export interface KnowledgeGraphStats {
  totalEntities: number;
  totalRelationships: number;
  entitiesByType: EntityTypeCount[];
}

export interface RelatedDocument {
  documentId: string;
  title: string;
}

export interface RelatedEntity {
  type: EntityType;
  name: string;
}

export interface GraphContext {
  relatedDocuments: RelatedDocument[];
  relatedEquipment: string[];
  relatedEntities: RelatedEntity[];
  followUpQuestions: string[];
}

/**
 * Grounded follow-up questions derived from the documents' own relationships and
 * equipment — never invented, so they cannot introduce hallucinated topics.
 */
function buildFollowUps(relationships: RelationshipDoc[], equipment: string[]): string[] {
  const questions = new Set<string>();
  for (const r of relationships) {
    if (questions.size >= 4) break;
    const p = r.predicate;
    if (p === 'manufactured_by') questions.add(`What other equipment is manufactured by ${r.object}?`);
    else if (p === 'located_in') questions.add(`What else is located in ${r.object}?`);
    else if (p.includes('maintenance') || p === 'maintained_by')
      questions.add(`What is the maintenance schedule for ${r.subject}?`);
    else if (p.includes('inspect')) questions.add(`When was ${r.subject} last inspected?`);
    else if (p.includes('safety') || p.includes('require'))
      questions.add(`What safety procedures apply to ${r.subject}?`);
  }
  for (const eq of equipment) {
    if (questions.size >= 4) break;
    questions.add(`What are the operating parameters of ${eq}?`);
  }
  return [...questions].slice(0, 4);
}

class KnowledgeGraphService {
  /**
   * Extract + persist the graph for a document. Idempotent: it first removes any
   * existing graph for the document, then writes the freshly extracted one.
   */
  async extractAndStore(documentId: string, text: string): Promise<ExtractionResult> {
    const bounded = text.slice(0, env.KG_MAX_CHARS).trim();
    if (bounded.length === 0) {
      await this.deleteForDocument(documentId);
      return { entities: 0, relationships: 0 };
    }

    const model = getGeminiClient().getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await withRetry(() => model.generateContent(buildPrompt(bounded)), {
      label: 'kg-extract',
      retries: 2,
    });
    const parsed = extractionSchema.parse(parseJsonResponse(result.response.text()));

    const docObjectId = new Types.ObjectId(documentId);

    // Dedupe entities by (type, normalizedName).
    const entityMap = new Map<string, IEntity>();
    for (const e of parsed.entities) {
      const name = e.name.trim();
      if (!name) continue;
      const type = coerceType(e.type) ?? 'other';
      const normalizedName = normalizeName(name);
      entityMap.set(`${type}|${normalizedName}`, {
        documentId: docObjectId,
        type,
        name,
        normalizedName,
      });
    }
    const entityDocsToInsert = [...entityMap.values()];

    // Re-extraction is idempotent: clear the old graph first.
    await this.deleteForDocument(documentId);

    const insertedEntities =
      entityDocsToInsert.length > 0 ? await entityRepository.insertMany(entityDocsToInsert) : [];

    // Map normalizedName -> entity _id for relationship linking.
    const idByName = new Map<string, Types.ObjectId>();
    for (const doc of insertedEntities) {
      if (!idByName.has(doc.normalizedName)) idByName.set(doc.normalizedName, doc._id);
    }

    const relationshipDocs: IRelationship[] = [];
    for (const r of parsed.relationships) {
      const subject = r.subject.trim();
      const object = r.object.trim();
      const predicate = normalizePredicate(r.predicate);
      if (!subject || !object || !predicate) continue;
      const subjectNormalized = normalizeName(subject);
      const objectNormalized = normalizeName(object);
      const subjectType = coerceType(r.subjectType);
      const objectType = coerceType(r.objectType);
      const subjectEntityId = idByName.get(subjectNormalized);
      const objectEntityId = idByName.get(objectNormalized);
      relationshipDocs.push({
        documentId: docObjectId,
        subject,
        subjectNormalized,
        predicate,
        object,
        objectNormalized,
        ...(subjectType ? { subjectType } : {}),
        ...(objectType ? { objectType } : {}),
        ...(subjectEntityId ? { subjectEntityId } : {}),
        ...(objectEntityId ? { objectEntityId } : {}),
      });
    }

    if (relationshipDocs.length > 0) {
      await relationshipRepository.insertMany(relationshipDocs);
    }

    logger.info('Knowledge graph extracted', {
      documentId,
      entities: insertedEntities.length,
      relationships: relationshipDocs.length,
    });
    return { entities: insertedEntities.length, relationships: relationshipDocs.length };
  }

  async deleteForDocument(documentId: string): Promise<void> {
    await Promise.all([
      entityRepository.deleteByDocument(documentId),
      relationshipRepository.deleteByDocument(documentId),
    ]);
  }

  async getDocumentGraph(documentId: string): Promise<DocumentGraph> {
    assertObjectId(documentId);
    const [entities, relationships] = await Promise.all([
      entityRepository.findByDocument(documentId),
      relationshipRepository.findByDocument(documentId),
    ]);
    return {
      documentId,
      entities: entities.map(toEntityDTO),
      relationships: relationships.map(toRelationshipDTO),
    };
  }

  async searchEntities(params: {
    type?: string | undefined;
    q?: string | undefined;
    documentId?: string | undefined;
    limit?: number | undefined;
  }): Promise<EntityDTO[]> {
    const filter: FilterQuery<IEntity> = {};
    if (params.type && ENTITY_TYPE_SET.has(params.type)) filter.type = params.type as EntityType;
    if (params.q)
      filter.normalizedName = { $regex: escapeRegExp(normalizeName(params.q)), $options: 'i' };
    if (params.documentId) {
      assertObjectId(params.documentId, 'document id');
      filter.documentId = new Types.ObjectId(params.documentId);
    }
    const docs = await entityRepository.search(filter, params.limit ?? 100);
    return docs.map(toEntityDTO);
  }

  async searchRelationships(params: {
    predicate?: string | undefined;
    entity?: string | undefined;
    documentId?: string | undefined;
    limit?: number | undefined;
  }): Promise<RelationshipDTO[]> {
    const filter: FilterQuery<IRelationship> = {};
    if (params.predicate) filter.predicate = normalizePredicate(params.predicate);
    if (params.entity) {
      const normalized = escapeRegExp(normalizeName(params.entity));
      filter.$or = [
        { subjectNormalized: { $regex: normalized, $options: 'i' } },
        { objectNormalized: { $regex: normalized, $options: 'i' } },
      ];
    }
    if (params.documentId) {
      assertObjectId(params.documentId, 'document id');
      filter.documentId = new Types.ObjectId(params.documentId);
    }
    const docs = await relationshipRepository.search(filter, params.limit ?? 100);
    return docs.map(toRelationshipDTO);
  }

  /**
   * Build graph context for a set of source documents (used to enrich RAG
   * answers): related equipment/entities in those documents, other documents
   * connected via shared entities, and grounded follow-up questions.
   */
  async getContext(documentIds: string[]): Promise<GraphContext> {
    const empty: GraphContext = {
      relatedDocuments: [],
      relatedEquipment: [],
      relatedEntities: [],
      followUpQuestions: [],
    };
    if (documentIds.length === 0) return empty;

    const [entities, relationships] = await Promise.all([
      entityRepository.findByDocumentIds(documentIds),
      relationshipRepository.findByDocumentIds(documentIds),
    ]);

    const equipment = new Map<string, string>();
    const others = new Map<string, RelatedEntity>();
    const names = new Set<string>();
    for (const e of entities) {
      names.add(e.normalizedName);
      if (e.type === 'equipment') {
        if (!equipment.has(e.normalizedName)) equipment.set(e.normalizedName, e.name);
      } else {
        const key = `${e.type}|${e.normalizedName}`;
        if (!others.has(key)) others.set(key, { type: e.type, name: e.name });
      }
    }
    const relatedEquipment = [...equipment.values()].slice(0, 8);
    const relatedEntities = [...others.values()].slice(0, 12);

    const relatedDocIds = await entityRepository.findRelatedDocumentIds(
      [...names],
      documentIds,
      5,
    );
    const relatedDocs = relatedDocIds.length > 0 ? await documentRepository.findByIds(relatedDocIds) : [];
    const relatedDocuments: RelatedDocument[] = relatedDocs.map((d) => ({
      documentId: String(d._id),
      title: d.title,
    }));

    return {
      relatedDocuments,
      relatedEquipment,
      relatedEntities,
      followUpQuestions: buildFollowUps(relationships, relatedEquipment),
    };
  }

  async getStats(): Promise<KnowledgeGraphStats> {
    const [totalEntities, totalRelationships, entitiesByType] = await Promise.all([
      entityRepository.count(),
      relationshipRepository.count(),
      entityRepository.countByType(),
    ]);
    return { totalEntities, totalRelationships, entitiesByType };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
