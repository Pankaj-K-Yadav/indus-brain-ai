/**
 * Lessons Learned controller. Exposes the deterministic dashboard and the
 * grounded AI summary.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { lessonsService } from '../services/lessons.service.js';
import type { ApiSuccess } from '../types/index.js';

export const getLessonsOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await lessonsService.getOverview();
  const body: ApiSuccess<typeof overview> = { success: true, data: overview };
  res.status(200).json(body);
});

export const getLessonsSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await lessonsService.generateSummary();
  const body: ApiSuccess<typeof summary> = { success: true, data: summary };
  res.status(200).json(body);
});
