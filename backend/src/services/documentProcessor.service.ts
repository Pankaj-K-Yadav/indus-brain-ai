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
import { parseCsv, parseXlsx, type SheetData } from '../utils/spreadsheet.js';
import { ocrPdf, ocrImage } from './ocr.service.js';
import type { FileType, ProcessingStage } from '../models/document.model.js';

export interface ProcessedDocument {
  fullText: string;
  pageCount: number;
  chunks: TextChunk[];
}

/** Optional progress hook invoked as the processor moves between stages. */
export type StageCallback = (stage: ProcessingStage) => void | Promise<void>;

function combinedLength(pages: PageText[]): number {
  return pages.reduce((sum, p) => sum + p.text.trim().length, 0);
}

async function extractPdf(
  buffer: Buffer,
  onStage?: StageCallback,
): Promise<{ pages: PageText[]; pageCount: number }> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  const pages: PageText[] = [];
  let pageCount = 0;
  try {
    pageCount = pdf.numPages;
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

  // OCR fallback: only when the PDF has NO embedded text (scanned / image-only)
  // and OCR is enabled. Recovered text is returned in the same shape as normal
  // extraction, so downstream chunking/embedding/indexing is unchanged.
  if (combinedLength(pages) === 0 && env.OCR_ENABLED) {
    logger.info('OCR Started', { reason: 'no embedded text layer', pageCount });
    await onStage?.('ocr');
    try {
      const ocrPages = await ocrPdf(buffer);
      const ocrLength = combinedLength(ocrPages);
      logger.info('OCR Completed', { pages: ocrPages.length, textLength: ocrLength });
      if (ocrLength > 0) {
        return { pages: ocrPages, pageCount: pageCount || ocrPages.length };
      }
      // OCR produced no text either -> fall through; caller marks it failed.
    } catch (error) {
      // OCR is best-effort: a failure must not crash the upload. Falling through
      // leaves the document text-less, so the pipeline marks it failed (OCR required).
      logger.error('OCR Failed', { error: String(error) });
    }
  }

  return { pages, pageCount };
}

async function extractDocx(buffer: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
  const { value } = await mammoth.extractRawText({ buffer });
  // DOCX has no fixed page model; treat the document as a single logical unit.
  return { pages: [{ pageNumber: null, text: value }], pageCount: 1 };
}

/**
 * Image (PNG/JPG): there is no text layer, so OCR is the only source of text.
 * Mirrors the PDF OCR contract — a disabled/failed OCR yields empty text, which
 * the pipeline then marks as "failed (no extractable text)".
 */
async function extractImage(
  buffer: Buffer,
  onStage?: StageCallback,
): Promise<{ pages: PageText[]; pageCount: number }> {
  if (!env.OCR_ENABLED) {
    return { pages: [{ pageNumber: 1, text: '' }], pageCount: 1 };
  }
  logger.info('OCR Started', { reason: 'image upload' });
  await onStage?.('ocr');
  try {
    const text = await ocrImage(buffer);
    logger.info('OCR Completed', { textLength: text.length });
    return { pages: [{ pageNumber: 1, text }], pageCount: 1 };
  } catch (error) {
    logger.error('OCR Failed', { error: String(error) });
    return { pages: [{ pageNumber: 1, text: '' }], pageCount: 1 };
  }
}

/**
 * Turn a sheet's rows into retrieval-friendly text. The first non-empty row is
 * treated as headers so each data row reads as "Header: value | Header: value",
 * which preserves column semantics for entity extraction and RAG.
 */
function sheetToText(sheet: SheetData): string {
  const rows = sheet.rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length === 0) return '';

  const headers = (rows[0] ?? []).map((h) => h.trim());
  const lines: string[] = [`Sheet: ${sheet.name}`];

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r] ?? [];
    const parts: string[] = [];
    for (let c = 0; c < cells.length; c += 1) {
      const value = (cells[c] ?? '').trim();
      if (!value) continue;
      const header = headers[c]?.trim();
      parts.push(header ? `${header}: ${value}` : value);
    }
    if (parts.length > 0) lines.push(parts.join(' | '));
  }

  // Header-only sheet: keep the headers themselves as content.
  if (lines.length === 1) lines.push(headers.filter(Boolean).join(' | '));
  return lines.join('\n');
}

/**
 * Spreadsheet (XLSX/CSV): each sheet becomes one page of "Header: value" text.
 * XLSX pages carry the sheet ordinal as a page reference; CSV is a single unit.
 */
async function extractSpreadsheet(
  buffer: Buffer,
  fileType: 'xlsx' | 'csv',
): Promise<{ pages: PageText[]; pageCount: number }> {
  const sheets: SheetData[] =
    fileType === 'csv'
      ? [{ name: 'CSV', rows: parseCsv(buffer.toString('utf8')) }]
      : parseXlsx(buffer);

  const pages: PageText[] = sheets.map((sheet, i) => ({
    pageNumber: fileType === 'csv' ? null : i + 1,
    text: sheetToText(sheet),
  }));

  if (pages.length === 0) pages.push({ pageNumber: null, text: '' });
  return { pages, pageCount: fileType === 'csv' ? 1 : Math.max(1, sheets.length) };
}

class DocumentProcessorService {
  /** Dispatch extraction by file type. Exhaustive — the compiler flags any new type. */
  private extract(
    buffer: Buffer,
    fileType: FileType,
    onStage?: StageCallback,
  ): Promise<{ pages: PageText[]; pageCount: number }> {
    switch (fileType) {
      case 'pdf':
        return extractPdf(buffer, onStage);
      case 'docx':
        return extractDocx(buffer);
      case 'xlsx':
      case 'csv':
        return extractSpreadsheet(buffer, fileType);
      case 'png':
      case 'jpg':
        return extractImage(buffer, onStage);
      default: {
        const exhaustive: never = fileType;
        throw new Error(`Unsupported file type: ${String(exhaustive)}`);
      }
    }
  }

  /**
   * Read a stored upload, extract text per page, and chunk it. `onStage` (when
   * provided) reports fine-grained progress for live status updates.
   */
  async processDocument(
    filename: string,
    fileType: FileType,
    onStage?: StageCallback,
  ): Promise<ProcessedDocument> {
    const filePath = path.join(uploadDir, filename);
    const buffer = await readFile(filePath);

    await onStage?.('extracting_text');
    const { pages, pageCount } = await this.extract(buffer, fileType, onStage);

    const fullText = pages
      .map((p) => p.text)
      .join('\n\n')
      .trim();

    await onStage?.('chunking');
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
