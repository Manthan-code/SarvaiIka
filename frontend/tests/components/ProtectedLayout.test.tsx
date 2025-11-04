import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import { ProtectedLayout } from '../../src/components/layout/ProtectedLayout';

// Auth store mock is mapped via jest.config moduleNameMapper
import { useAuthStore } from '../../tests/__mocks__/authStore';

// Mock AnimatedLoadingPage to a simple element for detectability
jest.mock('../../src/components/AnimatedLoadingPage', () => ({ __esModule: true, default: ({ duration }: any) => (
  <div data-testid="animated-loading">Loading... {duration}</div>
)}));

// Mock MainLayout to render children directly
jest.mock('../../src/components/layout/MainLayout', () => ({ __esModule: true, MainLayout: ({ children }: any) => (
  <div data-testid="main-layout">{children}</div>
)}));

// Mock ErrorBoundary to pass through children
jest.mock('../../src/components/ErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => (
  <div data-testid="error-boundary">{children}</div>
)}));

describe('ProtectedLayout', () => {
  beforeEach(() => {
    // reset auth store default state
    (useAuthStore as any).getState().user = { email: 'test@example.com', id: 'user-1' };
    (useAuthStore as any).getState().session = { access_token: 'token' };
    (useAuthStore as any).getState().loading = false;
  });

  it('renders loading state when auth is loading', () => {
    (useAuthStore as any).getState().loading = true;

    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard' }]}> 
        <Routes>
          <Route element={<ProtectedLayout />}> 
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('animated-loading')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated (no session or user)', () => {
    (useAuthStore as any).getState().user = null;
    (useAuthStore as any).getState().session = null;

    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard' }]}> 
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedLayout />}> 
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('renders children inside layout when authenticated', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/subscriptions' }]}> 
        <Routes>
          <Route element={<ProtectedLayout />}> 
            <Route path="/subscriptions" element={<div>Subscriptions Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions Content')).toBeInTheDocument();
  });
});