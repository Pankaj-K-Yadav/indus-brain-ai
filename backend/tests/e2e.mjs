/**
 * End-to-end tests for the INDUS-BRAIN AI knowledge pipeline.
 *
 * Runs against the compiled output in ../dist. Covers:
 *   A. PDF text extraction + chunking (local, no external services)
 *   B. ChromaDB vector upsert / similarity search / delete (needs ChromaDB)
 *   C. Gemini embeddings + RAG answer (needs a real GEMINI_API_KEY; auto-skips)
 *
 * Usage (from backend/):  npm run build && node tests/e2e.mjs
 */
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

let pass = 0;
let fail = 0;
let skipped = 0;
const lines = [];
const ok = (n, c, d) => {
  if (c) {
    pass += 1;
    lines.push(`  PASS  ${n}`);
  } else {
    fail += 1;
    lines.push(`  FAIL  ${n}${d ? ` -> ${d}` : ''}`);
  }
};
const skip = (n, why) => {
  skipped += 1;
  lines.push(`  SKIP  ${n} (${why})`);
};

/** Build a valid multi-page PDF with extractable text using pdf-lib. */
async function buildPdf(textLines) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([612, 792]);
  let y = 740;
  for (const line of textLines) {
    if (y < 60) {
      page = pdf.addPage([612, 792]);
      y = 740;
    }
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 16;
  }
  // Disable object streams for compatibility with pdf-parse's bundled pdf.js.
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

// Use a temporary collection so vector tests never touch real data.
process.env.CHROMA_COLLECTION = `indus_e2e_${process.pid}`;

try {
  // ---- Phase A: extraction + chunking -------------------------------------
  const { documentProcessorService } = await import('../dist/services/documentProcessor.service.js');
  const { uploadDir } = await import('../dist/config/index.js');
  await mkdir(uploadDir, { recursive: true });

  const fixtureName = `e2e-${process.pid}.pdf`;
  const sentences = [];
  for (let i = 0; i < 40; i += 1) {
    sentences.push(
      `Step ${i + 1}: To restart Pump A safely follow the shutdown procedure and wear PPE.`,
    );
  }
  await writeFile(path.join(uploadDir, fixtureName), await buildPdf(sentences));

  const processed = await documentProcessorService.processDocument(fixtureName, 'pdf');
  ok('A1 extraction produced text', processed.fullText.length > 100, `len=${processed.fullText.length}`);
  ok('A2 extraction mentions "Pump A"', processed.fullText.includes('Pump A'));
  ok('A3 pageCount >= 1', processed.pageCount >= 1, String(processed.pageCount));
  ok('A4 chunking produced chunks', processed.chunks.length >= 1, String(processed.chunks.length));
  ok('A5 chunk has page reference', processed.chunks[0]?.pageNumber === 1, String(processed.chunks[0]?.pageNumber));
  ok('A6 chunk indices sequential', processed.chunks.every((c, i) => c.chunkIndex === i));
  await unlink(path.join(uploadDir, fixtureName)).catch(() => {});

  // ---- Phase B: ChromaDB vector layer (deterministic vectors) -------------
  const { vectorRepository } = await import('../dist/repositories/vector.repository.js');
  const { pingChroma } = await import('../dist/integrations/chroma.js');

  const chromaUp = await pingChroma();
  if (!chromaUp) {
    skip('B vector tests', 'ChromaDB not reachable at CHROMA_URL');
  } else {
    const DIM = 16;
    const oneHot = (idx) => Array.from({ length: DIM }, (_, j) => (j === idx ? 1 : 0));
    const records = Array.from({ length: 5 }, (_, i) => ({
      chunkId: `e2e:${process.pid}:${i}`,
      documentId: `e2e-doc-${process.pid}`,
      text: `Vector test chunk number ${i} about industrial equipment`,
      pageNumber: i + 1,
      chunkIndex: i,
      category: 'maintenance',
      title: 'E2E Vector Doc',
      originalName: 'e2e.pdf',
      fileType: 'pdf',
    }));
    const embeddings = records.map((_, i) => oneHot(i));
    await vectorRepository.upsertChunks(records, embeddings);

    const countAfter = await vectorRepository.count();
    ok('B1 upsert increased count', countAfter >= 5, String(countAfter));

    const matches = await vectorRepository.query(oneHot(2), 3);
    ok('B2 query returns matches', matches.length > 0, String(matches.length));
    ok('B3 top match is the nearest vector', matches[0]?.chunkId === `e2e:${process.pid}:2`, matches[0]?.chunkId);
    ok('B4 top match similarity high', (matches[0]?.score ?? 0) > 0.9, String(matches[0]?.score));
    ok('B5 metadata preserved (page)', matches[0]?.pageNumber === 3, String(matches[0]?.pageNumber));
    ok('B6 metadata preserved (category)', matches[0]?.category === 'maintenance');

    await vectorRepository.deleteByDocument(`e2e-doc-${process.pid}`);
    const afterDelete = await vectorRepository.query(oneHot(2), 3);
    ok(
      'B7 delete removed chunks',
      !afterDelete.some((m) => m.documentId === `e2e-doc-${process.pid}`),
      'still present',
    );
  }

  // ---- Phase C: Gemini embeddings + generation (gated) --------------------
  const key = process.env.GEMINI_API_KEY ?? '';
  const hasRealKey = key.length > 0 && !key.toLowerCase().includes('placeholder');
  if (!hasRealKey) {
    skip('C Gemini embeddings + generation', 'no real GEMINI_API_KEY');
  } else {
    const { embeddingService } = await import('../dist/services/embedding.service.js');
    const { getGenerativeModel } = await import('../dist/integrations/gemini.js');

    const vec = await embeddingService.embedQuery('How do I restart Pump A?');
    ok('C1 Gemini embedding returned vector', Array.isArray(vec) && vec.length > 0, String(vec?.length));

    const docVecs = await embeddingService.embedDocuments(['chunk one', 'chunk two']);
    ok('C2 batch embedding returns one vector per text', docVecs.length === 2, String(docVecs.length));

    const gen = await getGenerativeModel().generateContent('Reply with the single word: READY');
    const text = gen.response.text().trim();
    ok('C3 Gemini generation responded', text.length > 0, text.slice(0, 40));
    // Full RAG (embed -> index -> retrieve -> answer) is verified live against
    // the running API in the application verification step.
  }
} catch (err) {
  fail += 1;
  lines.push(`  ERROR ${String(err)}`);
} finally {
  console.log('\n===== E2E KNOWLEDGE PIPELINE TESTS =====');
  console.log(lines.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped\n`);
  process.exit(fail === 0 ? 0 : 1);
}
