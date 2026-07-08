import { Router } from 'express';
import {
  getDocumentGraph,
  searchEntities,
  searchRelationships,
  getGraphStats,
} from '../controllers/knowledgeGraph.controller.js';

const router = Router();

router.get('/stats', getGraphStats);
router.get('/entities', searchEntities);
router.get('/relationships', searchRelationships);
router.get('/documents/:id', getDocumentGraph);

export default router;
