import { Router } from 'express';
import { analyzeRootCause } from '../controllers/rca.controller.js';

const router = Router();

router.post('/analyze', analyzeRootCause);

export default router;
