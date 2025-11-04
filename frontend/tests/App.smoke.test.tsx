import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mutable mock state used by authStore and supabaseClient mocks
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

let mockSession: any = null;

// Top-level mocks driven by mutable state
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

jest.mock('../src/services/supabaseClient', () => ({
  __esModule: true,
  default: {
    auth: {
      getSession: jest.fn().mockImplementation(async () => ({ data: { session: mockSession }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

// Mock auth refresh manager to avoid side effects
jest.mock('../src/lib/authRefresh', () => ({
  authRefreshManager: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock lazy-loaded pages and components referenced in App
jest.mock('../src/pages/Login', () => ({ __esModule: true, default: () => <div>Login Page</div> }));
jest.mock('../src/pages/Signup', () => ({ __esModule: true, default: () => <div>Signup Page</div> }));
jest.mock('../src/pages/Dashboard', () => ({ __esModule: true, default: () => <div data-testid="dashboard-page">Dashboard Page</div> }));
jest.mock('../src/pages/Chat', () => ({ __esModule: true, default: () => <div>Chat Page</div> }));
jest.mock('../src/pages/settings', () => ({ __esModule: true, default: () => <div>Settings Page</div> }));
jest.mock('../src/pages/TransactionHistory', () => ({ __esModule: true, default: () => <div>Transaction History Page</div> }));

// Mock LazyComponents exports used in App
jest.mock('../src/components/LazyComponents', () => ({
  __esModule: true,
  SubscriptionsWithLoading: () => <div>Subscriptions Page</div>,
  HelpPageWithLoading: () => <div>Help Page</div>,
  ErrorMonitoringWithLoading: () => <div>Error Monitoring Page</div>,
  LoadingFallback: () => <div>Loading...</div>,
}));

// Mock layouts
jest.mock('../src/components/layout/MainLayout', () => ({ MainLayout: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/layout/ProtectedLayout', () => {
  const { Outlet } = require('react-router-dom');
  return { ProtectedLayout: () => <Outlet /> };
});
jest.mock('../src/components/layout/AdminLayout', () => {
  const { Outlet } = require('react-router-dom');
  return { AdminLayout: () => <Outlet /> };
});

// Mock other components
jest.mock('../src/components/AnimatedLoadingPage', () => ({ __esModule: true, default: () => <div>Animated Loading</div> }));
jest.mock('../src/components/ErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/AsyncErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/StreamingErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../src/components/GlobalErrorHandler', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div>, trackPerformanceMetrics: () => {} }));
jest.mock('../src/components/ui/toaster', () => ({ Toaster: () => <div /> }));

// Mock BackgroundProvider
jest.mock('../src/contexts/BackgroundContext', () => ({ BackgroundProvider: ({ children }: any) => <div>{children}</div> }));

// Ensure clean state between tests
beforeEach(() => {
  // Mark app as visited to bypass initial animated loading gate
  window.sessionStorage.setItem('app-visited', 'true');

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
  mockSession = null;
});

// Smoke tests

describe('App smoke routing', () => {
  it('redirects unauthenticated user from root to /login', async () => {
    // Unauthenticated state
    mockAuthState.loading = false;
    mockAuthState.user = null;
    mockAuthState.session = null;
    mockSession = null;

    window.history.pushState({}, '', '/');
    const App = require('../src/App').default;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('renders login route explicitly', async () => {
    // Unauthenticated state
    mockAuthState.loading = false;
    mockAuthState.user = null;
    mockAuthState.session = null;
    mockSession = null;

    window.history.pushState({}, '', '/login');
    const App = require('../src/App').default;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('renders dashboard for authenticated session', async () => {
    // Authenticated state
    mockSession = { user: { id: 'u1', email: 'e' } };
    mockAuthState.loading = false;
    mockAuthState.session = mockSession;
    mockAuthState.user = mockSession.user;

    window.history.pushState({}, '', '/');
    const App = require('../src/App').default;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });
});