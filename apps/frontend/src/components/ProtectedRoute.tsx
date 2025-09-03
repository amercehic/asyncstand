import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts';

type Role = 'owner' | 'admin' | 'member';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/login',
  allowedRoles,
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

  // Redirect to login if not authenticated, preserving the intended destination
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If user is super admin, redirect to admin page (they should only access admin features)
  if (user?.isSuperAdmin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  // Optional role guard
  if (allowedRoles && user && !allowedRoles.includes(user.role as Role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
