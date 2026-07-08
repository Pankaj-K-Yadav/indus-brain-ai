/**
 * A titled card rendering a bulleted or numbered list, with an empty fallback.
 * Shared by the RCA and Compliance pages (Evidence / Actions / Recommendations).
 */
import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ListCardProps {
  icon: ReactNode;
  title: string;
  items: string[];
  empty: string;
  ordered?: boolean;
}

export function ListCard({ icon, title, items, empty, ordered }: ListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : ordered ? (
          <ol className="space-y-2 text-sm">
            {items.map((it, i) => (
              <li key={it} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((it) => (
              <li key={it} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
