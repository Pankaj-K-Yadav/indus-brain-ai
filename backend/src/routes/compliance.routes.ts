import { Router } from 'express';
import { analyzeCompliance } from '../controllers/compliance.controller.js';

const router = Router();

router.post('/analyze', analyzeCompliance);

export default router;
