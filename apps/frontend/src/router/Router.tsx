import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/router/Layout';
import { ErrorPage } from '@/pages/ErrorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Lazy load pages with preloading hints for better performance
const LandingPage = React.lazy(() =>
  import(/* webpackChunkName: "auth" */ '@/pages/LandingPage').then(module => ({
    default: module.LandingPage,
  }))
);
const LoginPage = React.lazy(() =>
  import(/* webpackChunkName: "auth" */ '@/pages/LoginPage').then(module => ({
    default: module.LoginPage,
  }))
);
const SignUpPage = React.lazy(() =>
  import(/* webpackChunkName: "auth" */ '@/pages/SignUpPage').then(module => ({
    default: module.SignUpPage,
  }))
);
const DashboardPage = React.lazy(() =>
  import(/* webpackChunkName: "dashboard" */ '@/pages/DashboardPage').then(module => ({
    default: module.DashboardPage,
  }))
);
const TeamsPage = React.lazy(() =>
  import(/* webpackChunkName: "teams" */ '@/pages/TeamsPage').then(module => ({
    default: module.TeamsPage,
  }))
);
const TeamDetailPage = React.lazy(() =>
  import(/* webpackChunkName: "teams" */ '@/pages/TeamDetailPage').then(module => ({
    default: module.TeamDetailPage,
  }))
);
const StandupsPage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupsPage').then(module => ({
    default: module.StandupsPage,
  }))
);
const StandupConfigPage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupConfigPage').then(module => ({
    default: module.StandupConfigPage,
  }))
);
const StandupResponsePage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupResponsePage').then(module => ({
    default: module.StandupResponsePage,
  }))
);
const StandupWizardPage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupWizardPage').then(module => ({
    default: module.StandupWizardPage,
  }))
);
const IntegrationsPage = React.lazy(() =>
  import(/* webpackChunkName: "integrations" */ '@/pages/IntegrationsPage').then(module => ({
    default: module.IntegrationsPage,
  }))
);
const IntegrationDetailsPage = React.lazy(() =>
  import(/* webpackChunkName: "integrations" */ '@/pages/IntegrationDetailsPage').then(module => ({
    default: module.IntegrationDetailsPage,
  }))
);
const StandupDetailsPage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupDetailsPage').then(module => ({
    default: module.StandupDetailsPage,
  }))
);
const StandupConfigDetailsPage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupConfigDetailsPage').then(module => ({
    default: module.StandupConfigDetailsPage,
  }))
);
const StandupResponsesPage = React.lazy(() =>
  import(/* webpackChunkName: "standups" */ '@/pages/StandupResponsesPage').then(module => ({
    default: module.StandupResponsesPage,
  }))
);
const MagicTokenStandupPage = React.lazy(() =>
  import(/* webpackChunkName: "magic-token" */ '@/pages/MagicTokenStandupPage').then(module => ({
    default: module.MagicTokenStandupPage,
  }))
);
const ForgotPasswordPage = React.lazy(() =>
  import(/* webpackChunkName: "auth" */ '@/pages/ForgotPasswordPage').then(module => ({
    default: module.ForgotPasswordPage,
  }))
);
const ResetPasswordPage = React.lazy(() =>
  import(/* webpackChunkName: "auth" */ '@/pages/ResetPasswordPage').then(module => ({
    default: module.ResetPasswordPage,
  }))
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
        path: 'forgot-password',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ForgotPasswordPage />
          </Suspense>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'reset-password',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ResetPasswordPage />
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
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
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
        path: 'standups',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupsPage />
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
        path: 'teams/:teamId/standups/wizard',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupWizardPage />
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
        path: 'standups/:standupId/responses',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupResponsesPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'integrations',
        element: (
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <Suspense fallback={<PageLoader />}>
              <IntegrationsPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'integrations/:integrationId',
        element: (
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <Suspense fallback={<PageLoader />}>
              <IntegrationDetailsPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'standups/:standupId',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupDetailsPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'standups/:standupId/edit',
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
        path: 'standups/:standupId/details',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <StandupConfigDetailsPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: 'standup/submit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <MagicTokenStandupPage />
          </Suspense>
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
