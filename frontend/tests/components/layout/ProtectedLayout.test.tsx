import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@testing-library/jest-dom';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

// Mock useAuthStore to control auth state
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn()
}));

// Mock AnimatedLoadingPage to a simple marker
jest.mock('@/components/AnimatedLoadingPage', () => ({
  __esModule: true,
  default: ({ duration }: { duration: number }) => (
    <div data-testid="animated-loading-page">Loading... ({duration})</div>
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

// Intercept Navigate to visualize redirects in tests
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Navigate to {to}</div>
}));

const { useAuthStore } = require('@/stores/authStore');

describe('ProtectedLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading page when auth store is loading', () => {
    useAuthStore.mockReturnValue({ session: null, user: null, loading: true });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('animated-loading-page')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    useAuthStore.mockReturnValue({ session: null, user: null, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('navigate')).toHaveTextContent('Navigate to /login');
  });

  it('renders children when authenticated', () => {
    useAuthStore.mockReturnValue({ session: { access_token: 't' }, user: { id: 'u1' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<div data-testid="child">Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});