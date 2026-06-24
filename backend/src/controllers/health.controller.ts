/**
 * Health controller. Reports service liveness and MongoDB connectivity.
 * Infrastructure status only — no business logic.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getMongoStatus } from '../integrations/index.js';

interface HealthResponse {
  status: 'ok';
  service: 'indus-brain-ai';
  timestamp: string;
  mongodb: 'connected' | 'disconnected';
}

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'indus-brain-ai',
    timestamp: new Date().toISOString(),
    mongodb: getMongoStatus(),
  };

  res.status(200).json(body);
});
