/**
 * API router aggregator. Feature routers are mounted here as they are added.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import documentRoutes from './document.routes.js';
import knowledgeRoutes from './knowledge.routes.js';
import analyticsRoutes from './analytics.routes.js';
import graphRoutes from './knowledgeGraph.routes.js';
import rcaRoutes from './rca.routes.js';
import complianceRoutes from './compliance.routes.js';
import lessonsRoutes from './lessons.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/graph', graphRoutes);
router.use('/rca', rcaRoutes);
router.use('/compliance', complianceRoutes);
router.use('/lessons', lessonsRoutes);

export default router;
