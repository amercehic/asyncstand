import { Outlet } from 'react-router-dom';
import { Toaster, ThemeToggle } from '@/components/ui';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { Navbar } from '@/components/Navbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PageErrorBoundary>
        <Outlet />
      </PageErrorBoundary>
      <Toaster position="top-center" richColors closeButton />

      {/* Fixed theme toggle in bottom-right corner */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-card border border-border rounded-full w-12 h-12 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ease-out flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
