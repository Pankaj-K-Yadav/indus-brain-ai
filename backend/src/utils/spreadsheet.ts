/**
 * Dependency-light spreadsheet readers for the ingestion pipeline.
 *
 * CSV is parsed in-process (RFC-4180-style: quoted fields, escaped quotes, CRLF).
 * XLSX is an OOXML zip; we unzip with `fflate` (zero-dependency) and read the
 * worksheet + shared-string XML directly. We only need cell *values* as text to
 * feed chunking / entity extraction / RAG, so a focused reader is preferable to a
 * heavy spreadsheet library (and keeps the dependency surface — and audit — clean).
 */
import { unzipSync, strFromU8 } from 'fflate';

export interface SheetData {
  name: string;
  rows: string[][];
}

/** Parse CSV text into a matrix of cell strings. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

/** Concatenate the inner text of every <t> node in an XML fragment. */
function extractRunText(fragment: string): string {
  const parts = fragment.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
  if (!parts) return '';
  return parts.map((p) => decodeXml(p.replace(/<t[^>]*>/, '').replace(/<\/t>$/, ''))).join('');
}

function parseSharedStrings(xml: string): string[] {
  const items = xml.match(/<si>[\s\S]*?<\/si>/g);
  return items ? items.map(extractRunText) : [];
}

/** Convert an A1-style cell reference's column letters to a 0-based index. */
function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (let i = 0; i < letters.length; i += 1) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, n - 1);
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rowMatches = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g);
  if (!rowMatches) return [];

  return rowMatches.map((rowXml) => {
    const cells = rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? [];
    const row: string[] = [];
    let cursor = 0;
    for (const cell of cells) {
      const ref = cell.match(/\br="([A-Z]+)\d+"/)?.[1];
      const index = ref ? columnIndex(ref) : cursor;
      const type = cell.match(/\bt="([^"]+)"/)?.[1];

      let value = '';
      if (type === 'inlineStr') {
        value = extractRunText(cell);
      } else {
        const raw = cell.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
        const decoded = raw !== undefined ? decodeXml(raw) : '';
        if (type === 's') {
          const i = Number(decoded);
          value = Number.isInteger(i) ? (shared[i] ?? '') : '';
        } else if (type === 'b') {
          value = decoded === '1' ? 'TRUE' : 'FALSE';
        } else {
          value = decoded;
        }
      }

      while (row.length < index) row.push('');
      row[index] = value;
      cursor = index + 1;
    }
    return row;
  });
}

/** Read an XLSX buffer into per-sheet row matrices, preserving sheet order/names. */
export function parseXlsx(buffer: Buffer): SheetData[] {
  const files = unzipSync(new Uint8Array(buffer));
  const read = (name: string): string | null => {
    const entry = files[name];
    return entry ? strFromU8(entry) : null;
  };

  const sharedXml = read('xl/sharedStrings.xml');
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];

  const sheets: SheetData[] = [];
  const workbookXml = read('xl/workbook.xml');
  const relsXml = read('xl/_rels/workbook.xml.rels');

  if (workbookXml && relsXml) {
    const relTargets = new Map<string, string>();
    for (const rel of relsXml.match(/<Relationship\b[^>]*>/g) ?? []) {
      const id = rel.match(/Id="([^"]+)"/)?.[1];
      const target = rel.match(/Target="([^"]+)"/)?.[1];
      if (id && target) relTargets.set(id, target.replace(/^\/?xl\//, '').replace(/^\//, ''));
    }
    for (const sheet of workbookXml.match(/<sheet\b[^>]*\/?>/g) ?? []) {
      const name = decodeXml(sheet.match(/name="([^"]+)"/)?.[1] ?? 'Sheet');
      const rid = sheet.match(/r:id="([^"]+)"/)?.[1];
      const target = rid ? relTargets.get(rid) : undefined;
      const xml = target ? read(`xl/${target}`) : null;
      if (xml) sheets.push({ name, rows: parseSheet(xml, shared) });
    }
  }

  // Fallback when the workbook/rels mapping is missing or non-standard.
  if (sheets.length === 0) {
    const sheetFiles = Object.keys(files)
      .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
      .sort();
    sheetFiles.forEach((file, i) => {
      const xml = read(file);
      if (xml) sheets.push({ name: `Sheet ${i + 1}`, rows: parseSheet(xml, shared) });
    });
  }

  return sheets;
}
