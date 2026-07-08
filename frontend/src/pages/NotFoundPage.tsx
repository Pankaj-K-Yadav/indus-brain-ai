import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <DashboardLayout title="Not found" subtitle="That page doesn’t exist.">
      <EmptyState
        icon={<Compass className="h-8 w-8" />}
        title="Page not found"
        description="The page you’re looking for doesn’t exist or has moved."
        action={
          <Link to="/" className={buttonVariants()}>
            Back to Overview
          </Link>
        }
      />
    </DashboardLayout>
  );
}
