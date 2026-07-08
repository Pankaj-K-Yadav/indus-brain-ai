import type { ReactNode } from 'react';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface TopbarProps {
  title: string;
  subtitle?: string | undefined;
  onMenuClick: () => void;
  actions?: ReactNode;
}

export function Topbar({ title, subtitle, onMenuClick, actions }: TopbarProps) {
  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        {subtitle ? (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
        ) : null}
      </div>

      <button
        type="button"
        className="hidden h-10 w-56 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 lg:flex"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      {actions}
      <ThemeToggle />
      <Avatar name="Indus Brain" />
    </header>
  );
}
