/**
 * API router aggregator. Feature routers are mounted here as they are added.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import documentRoutes from './document.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);

export default router;
