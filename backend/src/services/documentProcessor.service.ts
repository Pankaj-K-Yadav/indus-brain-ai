/**
 * Document processing service. Extracts text from PDF/DOCX files (preserving
 * page references where available) and produces overlapping, metadata-rich
 * chunks ready for embedding and vector indexing.
 *
 * This stage has no external-service dependencies — it runs purely locally, so
 * text extraction and chunking always succeed even when Gemini/ChromaDB are
 * unavailable.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
// Maintained pdf.js — the legacy build runs in Node without a DOM/canvas.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { env, uploadDir } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { chunkPages, type PageText, type TextChunk } from '../utils/chunking.js';
import type { FileType } from '../models/document.model.js';

export interface ProcessedDocument {
  fullText: string;
  pageCount: number;
  chunks: TextChunk[];
}

async function extractPdf(buffer: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  const pages: PageText[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push({ pageNumber: i, text });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return { pages, pageCount: pdf.numPages };
}

async function extractDocx(buffer: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
  const { value } = await mammoth.extractRawText({ buffer });
  // DOCX has no fixed page model; treat the document as a single logical unit.
  return { pages: [{ pageNumber: null, text: value }], pageCount: 1 };
}

class DocumentProcessorService {
  /**
   * Read a stored upload, extract text per page, and chunk it.
   */
  async processDocument(filename: string, fileType: FileType): Promise<ProcessedDocument> {
    const filePath = path.join(uploadDir, filename);
    const buffer = await readFile(filePath);

    const { pages, pageCount } =
      fileType === 'pdf' ? await extractPdf(buffer) : await extractDocx(buffer);

    const fullText = pages
      .map((p) => p.text)
      .join('\n\n')
      .trim();

    const chunks = chunkPages(pages, {
      chunkSize: env.CHUNK_SIZE,
      chunkOverlap: env.CHUNK_OVERLAP,
    });

    logger.info('Document processed', {
      filename,
      fileType,
      pageCount,
      textLength: fullText.length,
      chunkCount: chunks.length,
    });

    return { fullText, pageCount, chunks };
  }
}

export const documentProcessorService = new DocumentProcessorService();
