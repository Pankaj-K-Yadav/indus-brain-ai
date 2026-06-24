import { Router } from 'express';
import { searchKnowledge } from '../controllers/knowledge.controller.js';

const router = Router();

router.post('/search', searchKnowledge);

export default router;
