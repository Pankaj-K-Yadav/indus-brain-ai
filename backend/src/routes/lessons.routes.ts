import { Router } from 'express';
import { getLessonsOverview, getLessonsSummary } from '../controllers/lessons.controller.js';

const router = Router();

router.get('/overview', getLessonsOverview);
router.post('/summary', getLessonsSummary);

export default router;
