/**
 * Analytics controller. Exposes aggregated platform metrics for the dashboard.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyticsService } from '../services/analytics.service.js';
import type { ApiSuccess } from '../types/index.js';

export const getAnalyticsOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await analyticsService.getOverview();
  const body: ApiSuccess<typeof overview> = { success: true, data: overview };
  res.status(200).json(body);
});
