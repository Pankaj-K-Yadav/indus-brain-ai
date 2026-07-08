/**
 * File-type presentation helpers shared by the upload form and document table,
 * so iconography stays consistent across every supported format.
 */
import { FileText, FileSpreadsheet, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import type { DocumentFileType } from '@/types/document';

/** Icon for a known document file type. */
export function fileTypeIcon(type: DocumentFileType): LucideIcon {
  switch (type) {
    case 'pdf':
    case 'docx':
      return FileText;
    case 'xlsx':
    case 'csv':
      return FileSpreadsheet;
    case 'png':
    case 'jpg':
      return ImageIcon;
    default:
      return FileText;
  }
}

/** Accepted upload extensions, mirrored from the backend's resolver. */
export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg';
export const ACCEPTED_EXTENSIONS_RE = /\.(pdf|docx|xlsx|csv|png|jpe?g)$/i;

/** Resolve a client-side file type from a filename (best-effort, for icons/labels). */
export function fileTypeFromName(name: string): DocumentFileType | null {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.xlsx':
      return 'xlsx';
    case '.csv':
      return 'csv';
    case '.png':
      return 'png';
    case '.jpg':
    case '.jpeg':
      return 'jpg';
    default:
      return null;
  }
}
