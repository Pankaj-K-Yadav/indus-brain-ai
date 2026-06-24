import { useMemo } from 'react';
import { FileText, FileType2, HardDrive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatFileSize } from '@/lib/format';
import type { DocumentDTO } from '@/types/document';

interface DocumentStatsProps {
  documents: DocumentDTO[];
}

export function DocumentStats({ documents }: DocumentStatsProps) {
  const stats = useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);
    const pdfCount = documents.filter((doc) => doc.fileType === 'pdf').length;
    const docxCount = documents.filter((doc) => doc.fileType === 'docx').length;
    return { total: documents.length, totalSize, pdfCount, docxCount };
  }, [documents]);

  const cards = [
    { label: 'Total documents', value: String(stats.total), icon: <FileText className="h-5 w-5" /> },
    {
      label: 'PDF / DOCX',
      value: `${stats.pdfCount} / ${stats.docxCount}`,
      icon: <FileType2 className="h-5 w-5" />,
    },
    {
      label: 'Storage used',
      value: formatFileSize(stats.totalSize),
      icon: <HardDrive className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              {card.icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-xl font-semibold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
