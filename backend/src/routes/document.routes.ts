import { Router } from 'express';
import {
  uploadDocument,
  listDocuments,
  getDocumentById,
  deleteDocument,
} from '../controllers/document.controller.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

router.post('/upload', uploadSingle('file'), uploadDocument);
router.get('/', listDocuments);
router.get('/:id', getDocumentById);
router.delete('/:id', deleteDocument);

export default router;
