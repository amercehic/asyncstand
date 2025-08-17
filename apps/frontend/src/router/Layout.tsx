import { Outlet } from 'react-router-dom';
import { Toaster, ThemeToggle } from '@/components/ui';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { Navbar } from '@/components/Navbar';
import { AlertTriangle, CircleCheckBig, CircleX, Info } from 'lucide-react';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PageErrorBoundary>
        <Outlet />
      </PageErrorBoundary>
      <Toaster
        position="top-right"
        expand={true}
        richColors={true}
        closeButton={true}
        icons={{
          success: <CircleCheckBig className="w-4 h-4" />,
          error: <CircleX className="w-4 h-4" />,
          warning: <AlertTriangle className="w-4 h-4" />,
          info: <Info className="w-4 h-4" />,
        }}
        toastOptions={{
          style: {
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            color: 'var(--popover-foreground)',
          },
          className: 'toast-custom',
          duration: 4000,
          classNames: {
            success: '!border-l-4 !border-l-green-500',
            error: '!border-l-4 !border-l-red-500',
            warning: '!border-l-4 !border-l-orange-500',
            info: '!border-l-4 !border-l-blue-500',
            icon: 'toast-icon',
            closeButton:
              'toast-close !text-black hover:!text-black !bg-white !border !border-black/15 !shadow-none !outline-none focus:!outline-none focus:!ring-0 ring-0',
            title: 'toast-title',
            description: 'toast-description',
          },
        }}
      />

      {/* Fixed theme toggle in bottom-right corner */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-card border border-border rounded-full w-12 h-12 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ease-out flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
