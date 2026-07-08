/**
 * RCA controller. Validates input and delegates to the Root Cause Analysis agent.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseOrThrow, z } from '../utils/validation.js';
import { rcaService } from '../services/rca.service.js';
import type { ApiSuccess } from '../types/index.js';

const analyzeSchema = z.object({
  problem: z.string().trim().min(5, 'Describe the problem in at least 5 characters').max(1000),
  equipment: z.string().trim().min(1).max(200).optional(),
});

export const analyzeRootCause = asyncHandler(async (req: Request, res: Response) => {
  const { problem, equipment } = parseOrThrow(analyzeSchema, req.body);
  const result = await rcaService.analyze({ problem, ...(equipment ? { equipment } : {}) });
  const body: ApiSuccess<typeof result> = { success: true, data: result };
  res.status(200).json(body);
});
