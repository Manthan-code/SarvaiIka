import React from 'react';
import { Outlet } from 'react-router-dom';
import { MainLayout } from './MainLayout';
import AdminRoute from '../AdminRoute';
import ErrorBoundary from '../ErrorBoundary';

export const AdminLayout: React.FC = () => {
  return (
    <AdminRoute>
      <ErrorBoundary>
        <MainLayout>
          <Outlet />
        </MainLayout>
      </ErrorBoundary>
    </AdminRoute>
  );
};