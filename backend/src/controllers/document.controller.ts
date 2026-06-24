/**
 * Document controller. Validates HTTP input, delegates to the document service,
 * and shapes responses. No persistence or business logic here.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseOrThrow, z } from '../utils/validation.js';
import { HttpError } from '../utils/httpError.js';
import { DOCUMENT_STATUSES } from '../models/document.model.js';
import { documentService } from '../services/document.service.js';
import type { ApiSuccess } from '../types/index.js';

const uploadBodySchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  category: z.string().trim().min(1).max(100).default('general'),
});

const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
});

const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

function ok<T>(res: Response, status: number, data: T): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(status).json(body);
}

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw HttpError.badRequest('No file uploaded. Attach a PDF or DOCX file in the "file" field.');
  }

  const { title, category } = parseOrThrow(uploadBodySchema, req.body);

  const document = await documentService.createDocument({
    title,
    category,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });

  ok(res, 201, document);
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseOrThrow(listQuerySchema, req.query);
  const documents = await documentService.listDocuments(filters);
  ok(res, 200, documents);
});

export const getDocumentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParamSchema, req.params);
  const document = await documentService.getDocumentById(id);
  ok(res, 200, document);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parseOrThrow(idParamSchema, req.params);
  await documentService.deleteDocument(id);
  ok(res, 200, { id, deleted: true });
});
