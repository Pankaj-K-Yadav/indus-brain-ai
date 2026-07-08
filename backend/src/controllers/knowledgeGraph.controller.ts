/**
 * Knowledge Graph controller. Validates input and delegates to the KG service.
 * Read/search only — extraction happens automatically during ingestion.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseOrThrow, z } from '../utils/validation.js';
import { ENTITY_TYPES } from '../models/entity.model.js';
import { knowledgeGraphService } from '../services/knowledgeGraph.service.js';
import type { ApiSuccess } from '../types/index.js';

function ok<T>(res: Response, data: T): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(200).json(body);
}

const idParamSchema = z.object({ id: z.string().trim().min(1) });

const entityQuerySchema = z.object({
  type: z.enum(ENTITY_TYPES).optional(),
  q: z.string().trim().min(1).optional(),
  documentId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const relationshipQuerySchema = z.object({
  predicate: z.string().trim().min(1).optional(),
  entity: z.string().trim().min(1).optional(),
  documentId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const getDocumentGraph = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParamSchema, req.params);
  ok(res, await knowledgeGraphService.getDocumentGraph(id));
});

export const searchEntities = asyncHandler(async (req: Request, res: Response) => {
  const params = parseOrThrow(entityQuerySchema, req.query);
  ok(res, await knowledgeGraphService.searchEntities(params));
});

export const searchRelationships = asyncHandler(async (req: Request, res: Response) => {
  const params = parseOrThrow(relationshipQuerySchema, req.query);
  ok(res, await knowledgeGraphService.searchRelationships(params));
});

export const getGraphStats = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await knowledgeGraphService.getStats());
});
