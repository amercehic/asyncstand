import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts';
import { NotFoundPage } from '@/pages/NotFoundPage';

interface SuperAdminRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
  return404?: boolean;
}

export const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({
  children,
  redirectTo = '/dashboard',
  fallback,
  return404 = true,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
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

  // Check if user is a super admin
  if (!user?.isSuperAdmin) {
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

interface SuperAdminGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on super admin status
 * Unlike SuperAdminRoute, this doesn't redirect - it just shows/hides content
 */
export const SuperAdminGate: React.FC<SuperAdminGateProps> = ({ children, fallback = null }) => {
  const { user } = useAuth();

  return <>{user?.isSuperAdmin ? children : fallback}</>;
};

export default SuperAdminRoute;
