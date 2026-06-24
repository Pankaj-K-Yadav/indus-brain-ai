import type { ReactNode } from 'react';
import { FileText, LayoutDashboard, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';

interface NavItem {
  label: string;
  icon: ReactNode;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Documents', icon: <FileText className="h-4 w-4" />, active: true },
];

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ title, subtitle, actions, children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Brain className="h-6 w-6 text-primary" />
          <span className="text-sm font-bold tracking-tight">{env.appName}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                item.active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          Industrial Knowledge Intelligence
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
