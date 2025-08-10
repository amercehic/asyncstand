import { Outlet } from 'react-router-dom';
import { Toaster, ThemeToggle } from '@/components/ui';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <PageErrorBoundary>
        <Outlet />
      </PageErrorBoundary>
      <Toaster position="top-center" richColors closeButton />

      {/* Fixed theme toggle in bottom-right corner */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-card border border-border rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
