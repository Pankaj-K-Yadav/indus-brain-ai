import { cn } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  className?: string;
}

/** Gradient initials avatar (placeholder identity). */
function Avatar({ name = '', className }: AvatarProps) {
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'IB';

  return (
    <div
      className={cn(
        'flex h-9 w-9 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-xs font-semibold text-primary-foreground shadow-soft',
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export { Avatar };
