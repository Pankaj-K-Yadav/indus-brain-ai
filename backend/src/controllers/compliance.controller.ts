/**
 * Compliance controller. Validates input and delegates to the compliance agent.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseOrThrow, z } from '../utils/validation.js';
import { complianceService } from '../services/compliance.service.js';
import type { ApiSuccess } from '../types/index.js';

const analyzeSchema = z.object({
  sopDocumentId: z.string().trim().min(1, 'sopDocumentId is required'),
  regulationDocumentId: z.string().trim().min(1).optional(),
  regulationCategory: z.string().trim().min(1).optional(),
});

export const analyzeCompliance = asyncHandler(async (req: Request, res: Response) => {
  const { sopDocumentId, regulationDocumentId, regulationCategory } = parseOrThrow(
    analyzeSchema,
    req.body,
  );
  const result = await complianceService.analyze({
    sopDocumentId,
    ...(regulationDocumentId ? { regulationDocumentId } : {}),
    ...(regulationCategory ? { regulationCategory } : {}),
  });
  const body: ApiSuccess<typeof result> = { success: true, data: result };
  res.status(200).json(body);
});
