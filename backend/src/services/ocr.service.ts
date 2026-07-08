/**
 * OCR service. Fallback text recovery for scanned / image-only PDFs that carry
 * no embedded text layer. Pages are rendered to images (pdf-to-img) and read
 * with Tesseract (tesseract.js, open-source). A single worker is lazily created
 * and reused across requests for efficiency.
 *
 * This module is only invoked by the document processor when normal extraction
 * yields zero text, so it never affects the happy path.
 */
import { createWorker, type Worker } from 'tesseract.js';
import { pdf } from 'pdf-to-img';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { PageText } from '../utils/chunking.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(env.OCR_LANGUAGE);
  }
  return workerPromise;
}

/**
 * Terminate the cached Tesseract worker (native child process + WASM heap) if
 * one was created. Called during graceful shutdown so the process can exit
 * cleanly. Safe to call when no worker exists.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
    logger.info('OCR worker terminated');
  } catch (error) {
    logger.warn('Failed to terminate OCR worker', { error: String(error) });
  }
}

/**
 * Run OCR over a single image buffer (PNG/JPG). Returns the recognized text,
 * reusing the same shared Tesseract worker as the PDF path.
 */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text.trim();
}

/**
 * Run OCR over every page of a PDF buffer. Returns one PageText per page (text
 * may be empty for blank pages). Bounded by OCR_MAX_PAGES to cap cost.
 */
export async function ocrPdf(buffer: Buffer): Promise<PageText[]> {
  const worker = await getWorker();
  const document = await pdf(buffer, { scale: 2 });

  const pages: PageText[] = [];
  let pageNumber = 0;
  for await (const image of document) {
    pageNumber += 1;
    if (pageNumber > env.OCR_MAX_PAGES) {
      logger.warn('OCR page limit reached; remaining pages skipped', {
        limit: env.OCR_MAX_PAGES,
        totalPages: document.length,
      });
      break;
    }
    const { data } = await worker.recognize(Buffer.from(image));
    pages.push({ pageNumber, text: data.text.trim() });
  }

  return pages;
}
