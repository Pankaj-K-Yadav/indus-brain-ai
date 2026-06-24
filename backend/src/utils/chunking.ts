/**
 * Text chunking utilities. Produces overlapping, boundary-aware chunks suitable
 * for embedding and retrieval, preserving page references.
 */

export interface PageText {
  pageNumber: number | null;
  text: string;
}

export interface TextChunk {
  text: string;
  pageNumber: number | null;
  chunkIndex: number;
}

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

const WHITESPACE = /\s+/g;

function normalize(text: string): string {
  return text.replace(WHITESPACE, ' ').trim();
}

/**
 * Split a single page's text into overlapping chunks at sentence boundaries
 * where possible, falling back to hard splits for very long sentences.
 */
function chunkText(text: string, options: ChunkOptions): string[] {
  const clean = normalize(text);
  if (!clean) return [];
  if (clean.length <= options.chunkSize) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+|\S+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (piece.length > options.chunkSize) {
      // Hard-split an over-long sentence.
      pushCurrent();
      current = '';
      for (let i = 0; i < piece.length; i += options.chunkSize) {
        chunks.push(piece.slice(i, i + options.chunkSize));
      }
      continue;
    }

    if (current.length + piece.length + 1 > options.chunkSize) {
      pushCurrent();
      // Start the next chunk with a tail overlap from the previous one.
      const overlapText = current.slice(Math.max(0, current.length - options.chunkOverlap));
      current = `${overlapText} ${piece}`.trim();
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  pushCurrent();

  return chunks;
}

/**
 * Chunk an array of pages, tagging each chunk with its page number and a global
 * sequential index.
 */
export function chunkPages(pages: PageText[], options: ChunkOptions): TextChunk[] {
  const result: TextChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pieces = chunkText(page.text, options);
    for (const piece of pieces) {
      result.push({ text: piece, pageNumber: page.pageNumber, chunkIndex });
      chunkIndex += 1;
    }
  }

  return result;
}
