import { useMemo } from 'react';
import { FileText, DatabaseZap, HardDrive, AlertTriangle, Layers } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { formatFileSize } from '@/lib/format';
import type { DocumentDTO } from '@/types/document';

interface DocumentStatsProps {
  documents: DocumentDTO[];
}

export function DocumentStats({ documents }: DocumentStatsProps) {
  const stats = useMemo(() => {
    const total = documents.length;
    const indexed = documents.filter((d) => d.indexed).length;
    const failed = documents.filter((d) => d.status === 'failed').length;
    const chunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);
    const storage = documents.reduce((sum, d) => sum + d.fileSize, 0);
    return { total, indexed, failed, chunks, storage };
  }, [documents]);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Total Documents" value={stats.total} icon={FileText} accent="indigo" hint="In knowledge base" />
      <StatCard label="Indexed" value={stats.indexed} icon={DatabaseZap} accent="emerald" hint="Searchable via AI" />
      <StatCard label="Storage Used" value={formatFileSize(stats.storage)} icon={HardDrive} accent="blue" hint="Across all files" />
      <StatCard label="Failed Uploads" value={stats.failed} icon={AlertTriangle} accent="red" hint="Need attention" />
      <StatCard label="Chunks" value={stats.chunks.toLocaleString()} icon={Layers} accent="purple" hint="Knowledge fragments" />
    </div>
  );
}
