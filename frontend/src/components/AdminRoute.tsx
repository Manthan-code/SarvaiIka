import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUserRole } from '@/hooks/useUserRole';
import AnimatedLoadingPage from './AnimatedLoadingPage';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { session, user, loading: authLoading } = useAuthStore();
  const isAuthenticated = !!session && !!user;
  const { isAdmin, isLoading: roleLoading, profile, error } = isAuthenticated ? useUserRole() : { isAdmin: false, isLoading: false, profile: null, error: null };

  console.log('🔍 AdminRoute: Auth state:', { 
    isAuthenticated, 
    authLoading, 
    roleLoading, 
    isAdmin, 
    userEmail: user?.email,
    profileRole: profile?.role,
    error 
  });

  // Show loading while checking authentication and role
  if (authLoading || roleLoading) {
    return (
      <AnimatedLoadingPage 
        duration={1000}
      />
    );
  }

  // Redirect to login if not authenticated
  if (!session || !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if authenticated but not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render admin content if user is authenticated and is admin
  return <>{children}</>;
};

export default AdminRoute;