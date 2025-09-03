import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { NotFoundPage } from '@/pages/NotFoundPage';

interface FeatureProtectedRouteProps {
  children: React.ReactNode;
  featureKey: string;
  redirectTo?: string;
  fallback?: React.ReactNode;
  return404?: boolean;
}

export const FeatureProtectedRoute: React.FC<FeatureProtectedRouteProps> = ({
  children,
  featureKey,
  redirectTo = '/dashboard',
  fallback,
  return404 = true,
}) => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const location = useLocation();
  const { isEnabled: featureEnabled, loading: featureLoading } = useFeatureFlag(featureKey);

  // Show loading spinner while checking authentication or feature
  if (authLoading || featureLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is super admin, redirect to admin page (they should only access admin features)
  if (user?.isSuperAdmin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  // Check if feature is enabled
  if (!featureEnabled) {
    // If return404 is true, show 404 page instead of redirecting
    if (return404) {
      return <NotFoundPage />;
    }

    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default FeatureProtectedRoute;
