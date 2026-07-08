import { NavLink } from 'react-router-dom';
import {
  Brain,
  LayoutDashboard,
  FileText,
  Sparkles,
  Microscope,
  ShieldCheck,
  GraduationCap,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/', icon: LayoutDashboard },
  { label: 'Documents', to: '/documents', icon: FileText },
  { label: 'Knowledge Assistant', to: '/knowledge', icon: Sparkles },
  { label: 'Root Cause Analysis', to: '/rca', icon: Microscope },
  { label: 'Compliance', to: '/compliance', icon: ShieldCheck },
  { label: 'Lessons Learned', to: '/lessons', icon: GraduationCap },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse?: (() => void) | undefined;
  onNavigate?: (() => void) | undefined;
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div
        className={cn(
          'flex h-16 items-center gap-2.5 border-b px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-soft">
          <Brain className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">INDUS-BRAIN</p>
            <p className="text-[11px] text-muted-foreground">AI Knowledge</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 h-5 w-1 rounded-r-full bg-primary transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t p-3">
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:flex',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={cn('h-[18px] w-[18px] transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        ) : null}
      </div>
    </div>
  );
}
