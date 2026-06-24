import { useRef, useState, type FormEvent } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { UploadDocumentInput } from '@/types/document';

const ACCEPTED = '.pdf,.docx';

interface DocumentUploadFormProps {
  onUpload: (input: UploadDocumentInput) => Promise<void>;
}

export function DocumentUploadForm({ onUpload }: DocumentUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setTitle('');
    setCategory('general');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError('Please choose a PDF or DOCX file.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpload({ file, title: title.trim(), category: category.trim() || 'general' });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload document</CardTitle>
        <CardDescription>Add a PDF or DOCX file to the knowledge base.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="doc-title">
              Title
            </label>
            <Input
              id="doc-title"
              placeholder="e.g. Pump Maintenance Manual"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="doc-category">
              Category
            </label>
            <Input
              id="doc-category"
              placeholder="general"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="doc-file">
              File
            </label>
            <Input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isSubmitting}
              className="cursor-pointer file:mr-3 file:cursor-pointer"
            />
          </div>

          <div className="md:col-span-3 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive" role="alert">
              {error ?? ''}
            </p>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
