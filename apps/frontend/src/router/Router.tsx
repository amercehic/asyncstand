import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/router/Layout';
import { ErrorPage } from '@/pages/ErrorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Lazy load pages for better performance
const LandingPage = React.lazy(() =>
  import('@/pages/LandingPage').then(module => ({ default: module.LandingPage }))
);
const LoginPage = React.lazy(() =>
  import('@/pages/LoginPage').then(module => ({ default: module.LoginPage }))
);
const SignUpPage = React.lazy(() =>
  import('@/pages/SignUpPage').then(module => ({ default: module.SignUpPage }))
);
const DashboardPage = React.lazy(() =>
  import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage }))
);
const TeamsPage = React.lazy(() =>
  import('@/pages/TeamsPage').then(module => ({ default: module.TeamsPage }))
);
const TeamDetailPage = React.lazy(() =>
  import('@/pages/TeamDetailPage').then(module => ({ default: module.TeamDetailPage }))
);
const StandupConfigPage = React.lazy(() =>
  import('@/pages/StandupConfigPage').then(module => ({ default: module.StandupConfigPage }))
);
const StandupResponsePage = React.lazy(() =>
  import('@/pages/StandupResponsePage').then(module => ({ default: module.StandupResponsePage }))
);
const IntegrationsPage = React.lazy(() =>
  import('@/pages/IntegrationsPage').then(module => ({ default: module.IntegrationsPage }))
);

// Loading component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <LandingPage />
          </Suspense>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'login',
        element: (
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'signup',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SignUpPage />
          </Suspense>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'teams',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <TeamsPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'teams/:teamId',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <TeamDetailPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'teams/:teamId/standups/create',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupConfigPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'standups/:instanceId/respond',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupResponsePage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'integrations',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <IntegrationsPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
