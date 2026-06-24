/**
 * Knowledge controller. Validates search input and delegates to the RAG
 * knowledge service.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseOrThrow, z } from '../utils/validation.js';
import { ASSISTANT_TYPES } from '../models/searchLog.model.js';
import { knowledgeService } from '../services/knowledge.service.js';
import type { ApiSuccess } from '../types/index.js';

const searchSchema = z.object({
  query: z.string().trim().min(3, 'query must be at least 3 characters').max(1000),
  assistant: z.enum(ASSISTANT_TYPES).optional(),
});

export const searchKnowledge = asyncHandler(async (req: Request, res: Response) => {
  const { query, assistant } = parseOrThrow(searchSchema, req.body);
  const result = await knowledgeService.search({ query, ...(assistant ? { assistant } : {}) });
  const body: ApiSuccess<typeof result> = { success: true, data: result };
  res.status(200).json(body);
});
