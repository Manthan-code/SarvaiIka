import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { MainLayout } from './MainLayout';
import ErrorBoundary from '../ErrorBoundary';
import { useAuthStore } from '../../stores/authStore';
import AnimatedLoadingPage from '../AnimatedLoadingPage';

export const ProtectedLayout: React.FC = () => {
  const { session, user, loading } = useAuthStore();
  
  if (loading) {
    return (
      <AnimatedLoadingPage 
        duration={1000}
      />
    );
  }
    
  if (!session || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErrorBoundary>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ErrorBoundary>
  );
};