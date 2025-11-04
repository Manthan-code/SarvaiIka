import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';

// Pass-through AdminRoute to avoid role logic in this unit test
jest.mock('@/components/AdminRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-route">{children}</div>
  )
}));

// Mock MainLayout to render children
jest.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  )
}));

// Mock ErrorBoundary to pass-through
jest.mock('@/components/ErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  )
}));

describe('AdminLayout', () => {
  it('wraps children with AdminRoute, ErrorBoundary, and MainLayout', () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/users" element={<div data-testid="child">Users</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('admin-route')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});