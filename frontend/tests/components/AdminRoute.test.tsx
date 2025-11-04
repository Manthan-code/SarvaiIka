import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from '@/components/AdminRoute';
import AnimatedLoadingPage from '@/components/AnimatedLoadingPage';

// Mocks
// Ensure AnimatedLoadingPage mock matches the module path used by AdminRoute
jest.mock('../../src/components/AnimatedLoadingPage', () => ({ __esModule: true, default: () => <div data-testid="animated-loading">Loading...</div> }));
jest.mock('@/components/AnimatedLoadingPage', () => ({ __esModule: true, default: () => <div data-testid="animated-loading">Loading...</div> }));

jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn(() => ({ isAdmin: true, isLoading: false, profile: { role: 'admin' }, error: null }))
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'u', email: 'e' },
    session: { access_token: 't' },
    loading: false
  }))
}));

const TestAdminPage = () => <div>Admin Content</div>;
const LoginPage = () => <div>Login Page</div>;
const DashboardPage = () => <div>Dashboard Page</div>;

const setupRoutes = (element: React.ReactNode, initialPath = '/admin') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin" element={element} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminRoute', () => {
  beforeEach(() => {
    const { useAuthStore } = require('@/stores/authStore');
    const { useUserRole } = require('@/hooks/useUserRole');
    (useAuthStore as jest.Mock).mockImplementation(() => ({ user: { id: 'u', email: 'e' }, session: { access_token: 't' }, loading: false }));
    (useUserRole as jest.Mock).mockImplementation(() => ({ isAdmin: true, isLoading: false, profile: { role: 'admin' }, error: null }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows loading while auth or role is loading', () => {
    const { useAuthStore } = require('@/stores/authStore');
    const { useUserRole } = require('@/hooks/useUserRole');
    (useAuthStore as jest.Mock).mockImplementation(() => ({ user: null, session: null, loading: true }));
    (useUserRole as jest.Mock).mockImplementation(() => ({ isAdmin: false, isLoading: true, profile: null, error: null }));

    setupRoutes(
      <AdminRoute>
        <TestAdminPage />
      </AdminRoute>
    );

    expect(screen.getByTestId('animated-loading')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    const { useAuthStore } = require('@/stores/authStore');
    (useAuthStore as jest.Mock).mockImplementation(() => ({ user: null, session: null, loading: false }));

    setupRoutes(
      <AdminRoute>
        <TestAdminPage />
      </AdminRoute>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /dashboard when authenticated but not admin', () => {
    const { useUserRole } = require('@/hooks/useUserRole');
    (useUserRole as jest.Mock).mockImplementation(() => ({ isAdmin: false, isLoading: false, profile: { role: 'user' }, error: null }));

    setupRoutes(
      <AdminRoute>
        <TestAdminPage />
      </AdminRoute>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('renders children when authenticated and admin', () => {
    setupRoutes(
      <AdminRoute>
        <TestAdminPage />
      </AdminRoute>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});