import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mutable auth store state
let mockAuthState: any = {
  user: null,
  session: null,
  loading: false,
  setUser: jest.fn(),
  setSession: jest.fn(),
  clearAuthState: jest.fn(),
  resyncCacheSelectively: jest.fn(),
  setLoading: jest.fn(),
};

jest.mock('../src/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// Supabase client mock
let nextAuthEvent: { event: string; session: any } | null = null;
const unsubscribe = jest.fn();
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: jest.fn((cb: any) => {
      // If an OAuth hash exists and a queued event is present, trigger callback asynchronously
      if (nextAuthEvent && window.location.hash) {
        const payload = nextAuthEvent;
        // Clear queued event so it triggers only once
        nextAuthEvent = null;
        setTimeout(() => cb(payload.event, payload.session), 0);
      }
      return { data: { subscription: { unsubscribe } } };
    }),
  },
};

jest.mock('../src/services/supabaseClient', () => ({
  __esModule: true,
  default: mockSupabase,
}));

// Mock pages and components used by App for stability
jest.mock('../src/pages/Login', () => ({ __esModule: true, default: () => <div data-testid="login-page">Login Page</div> }));
jest.mock('../src/pages/Signup', () => ({ __esModule: true, default: () => <div>Signup Page</div> }));
jest.mock('../src/pages/Dashboard', () => ({ __esModule: true, default: () => <div data-testid="dashboard-page">Dashboard Page</div> }));
jest.mock('../src/pages/Chat', () => ({ __esModule: true, default: () => <div>Chat Page</div> }));
jest.mock('../src/pages/settings', () => ({ __esModule: true, default: () => <div>Settings Page</div> }));
jest.mock('../src/pages/TransactionHistory', () => ({ __esModule: true, default: () => <div>Transaction History Page</div> }));

jest.mock('../src/components/LazyComponents', () => ({
  __esModule: true,
  SubscriptionsWithLoading: () => <div>Subscriptions Page</div>,
  HelpPageWithLoading: () => <div>Help Page</div>,
  ErrorMonitoringWithLoading: () => <div>Error Monitoring Page</div>,
  LoadingFallback: () => <div>Loading...</div>,
}));

jest.mock('../src/components/GlobalErrorHandler', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div>, trackPerformanceMetrics: jest.fn() }));
jest.mock('../src/components/ErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/AsyncErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/StreamingErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/ui/toaster', () => ({ Toaster: () => <div /> }));
jest.mock('../src/contexts/BackgroundContext', () => ({ BackgroundProvider: ({ children }: any) => <div>{children}</div> }));

jest.mock('../src/components/AnimatedLoadingPage', () => ({ __esModule: true, default: ({ duration }: { duration: number }) => <div data-testid="animated-loading">Animated Loading ({duration})</div> }));

// Mock useUserRole to control admin status across tests
let mockUserRole: any = { isAdmin: false, isLoading: false, role: 'user', isModerator: false, profile: { role: 'user' }, error: null, refreshProfile: jest.fn() };
jest.mock('../src/hooks/useUserRole', () => ({ __esModule: true, useUserRole: () => mockUserRole }));

// Mock admin pages to simple components so we can assert rendering
jest.mock('../src/pages/admin/ManageUsers', () => ({ __esModule: true, default: () => <div data-testid="manage-users-page">Manage Users Page</div> }));
jest.mock('../src/pages/admin/ManageBackgroundImages', () => ({ __esModule: true, default: () => <div data-testid="manage-bg-page">Manage Background Images Page</div> }));

// Minimal MainLayout to render children; do NOT mock ProtectedLayout/AdminLayout to exercise them via App
jest.mock('../src/components/layout/MainLayout', () => ({ MainLayout: ({ children }: any) => <div data-testid="main-layout">{children}</div> }));

beforeEach(() => {
  // Reset sessionStorage and mocks
  window.sessionStorage.clear();
  mockAuthState = {
    user: null,
    session: null,
    loading: false,
    setUser: jest.fn((u: any) => { mockAuthState.user = u; }),
    setSession: jest.fn((s: any) => { mockAuthState.session = s; }),
    clearAuthState: jest.fn(() => { mockAuthState.user = null; mockAuthState.session = null; }),
    resyncCacheSelectively: jest.fn(async () => {}),
    setLoading: jest.fn((v: boolean) => { mockAuthState.loading = v; }),
  };
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  unsubscribe.mockClear();
});

describe('App coverage-focused scenarios', () => {
  it('shows animated loading page on real initial visit', async () => {
    // Ensure first visit (no app-visited flag)
    window.history.pushState({}, '', '/');
    const App = require('../src/App').default;

    render(<App />);

    // Animated loading page should be visible
    expect(screen.getByTestId('animated-loading')).toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login when visited flag set', async () => {
    // Pretend user has visited before to skip animated gate
    window.sessionStorage.setItem('app-visited', 'true');

    // Unauthenticated state
    mockAuthState.loading = false;
    mockAuthState.user = null;
    mockAuthState.session = null;

    window.history.pushState({}, '', '/');
    const App = require('../src/App').default;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('OAuthCallback navigates to dashboard on SIGNED_IN event', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    // Visit OAuth callback route WITHOUT hash to exercise getSession branch
    window.history.pushState({}, '', '/auth/callback');

    // Prepare session returned via getSession
    const session = { user: { id: 'u1', email: 'test@example.com' } };
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

    const App = require('../src/App').default;
    render(<App />);

    // Wait for lazy Dashboard to appear
    const dash = await screen.findByTestId('dashboard-page');
    expect(dash).toBeInTheDocument();
  });
});

describe('Additional route coverage for RootRedirect, ProtectedLayout, and AdminLayout', () => {
  it('RootRedirect sends authenticated users to /dashboard', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    const session = { user: { id: 'u2', email: 'auth@example.com' } };
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    window.history.pushState({}, '', '/');

    const App = require('../src/App').default;
    render(<App />);

    const dash = await screen.findByTestId('dashboard-page');
    expect(dash).toBeInTheDocument();
  });

  it('ProtectedLayout redirects unauthenticated users to /login', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    window.history.pushState({}, '', '/dashboard');

    const App = require('../src/App').default;
    render(<App />);

    const login = await screen.findByTestId('login-page');
    expect(login).toBeInTheDocument();
  });

  it('ProtectedLayout renders dashboard for authenticated users', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    const session = { user: { id: 'u3', email: 'user@example.com' } };
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    window.history.pushState({}, '', '/dashboard');

    const App = require('../src/App').default;
    render(<App />);

    const dash = await screen.findByTestId('dashboard-page');
    expect(dash).toBeInTheDocument();
  });

  it('Admin route redirects unauthenticated users to /login', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockUserRole = { ...mockUserRole, isAdmin: false, isLoading: false, role: 'user', profile: { role: 'user' } };
    window.history.pushState({}, '', '/admin/users');

    const App = require('../src/App').default;
    render(<App />);

    const login = await screen.findByTestId('login-page');
    expect(login).toBeInTheDocument();
  });

  it('Admin route redirects authenticated non-admin users to /dashboard', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    const session = { user: { id: 'u4', email: 'nonadmin@example.com' } };
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    mockUserRole = { ...mockUserRole, isAdmin: false, isLoading: false, role: 'user', profile: { role: 'user' } };
    window.history.pushState({}, '', '/admin/users');

    const App = require('../src/App').default;
    render(<App />);

    const dash = await screen.findByTestId('dashboard-page');
    expect(dash).toBeInTheDocument();
  });

  it('Admin route renders for authenticated admin users', async () => {
    window.sessionStorage.setItem('app-visited', 'true');
    const session = { user: { id: 'u5', email: 'admin@example.com' } };
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    mockUserRole = { ...mockUserRole, isAdmin: true, isLoading: false, role: 'admin', profile: { role: 'admin' } };
    window.history.pushState({}, '', '/admin/users');

    const App = require('../src/App').default;
    render(<App />);

    // Should render inside MainLayout and show the mocked admin page
    expect(await screen.findByTestId('main-layout')).toBeInTheDocument();
    expect(await screen.findByTestId('manage-users-page')).toBeInTheDocument();
  });
});