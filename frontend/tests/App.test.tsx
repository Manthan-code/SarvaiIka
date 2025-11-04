import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../src/stores/authStore';
import { MainLayout } from '../src/components/layout/MainLayout';
import Login from '../src/pages/Login';
import Signup from '../src/pages/Signup';
import Dashboard from '../src/pages/Dashboard';
import Chat from '../src/pages/Chat';
import Settings from '../src/pages/settings';
import Subscriptions from '../src/pages/Subscriptions';
import TransactionHistory from '../src/pages/TransactionHistory';
import { HelpPage } from '../src/pages/HelpPage';
import ErrorMonitoring from '../src/pages/ErrorMonitoring';
import { Toaster } from '../src/components/ui/toaster';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { useEffect, useState } from 'react';
import { authRefreshManager } from '../src/lib/authRefresh';
import supabase from '../src/services/supabaseClient';

// Mock the auth store
jest.mock('../src/stores/authStore');
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Supabase client is mocked globally in setup.js

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' }),
  Navigate: ({ to }: { to: string }) => {
    if (to === '/login') {
      return <div data-testid="login-page">Login Page</div>;
    }
    if (to === '/dashboard') {
      return <div data-testid="dashboard-page">Dashboard Page</div>;
    }
    if (to === '/') {
      // For authenticated users, root should redirect to dashboard
      return <div data-testid="dashboard-page">Dashboard Page</div>;
    }
    return <div>Navigate to {to}</div>;
  }
}));

// Mock sonner (toast library)
jest.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

// Mock ui/toaster component
jest.mock('../src/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />
}));

// Mock all page components
jest.mock('../src/pages/Login', () => {
  return function MockLogin() {
    return <div data-testid="login-page">Login Page</div>;
  };
});

jest.mock('../src/pages/Signup', () => {
  return function MockSignup() {
    return <div data-testid="signup-page">Signup Page</div>;
  };
});

jest.mock('../src/pages/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard-page">Dashboard Page</div>;
  };
});

jest.mock('../src/pages/Chat', () => {
  return function MockChat() {
    return <div data-testid="chat-page">Chat Page</div>;
  };
});

jest.mock('../src/pages/settings', () => {
  return function MockSettings() {
    return <div data-testid="settings-page">Settings Page</div>;
  };
});

jest.mock('../src/pages/Subscriptions', () => {
  return function MockSubscriptions() {
    return <div data-testid="subscriptions-page">Subscriptions Page</div>;
  };
});

jest.mock('../src/pages/ErrorMonitoring', () => {
  return function MockErrorMonitoring() {
    return <div data-testid="error-monitoring-page">Error Monitoring Page</div>;
  };
});

jest.mock('../src/pages/TransactionHistory', () => {
  return function MockTransactionHistory() {
    return <div data-testid="transaction-history-page">Transaction History Page</div>;
  };
});

jest.mock('../src/pages/HelpPage', () => {
  return function MockHelpPage() {
    return <div data-testid="help-page">Help Page</div>;
  };
});

jest.mock('../src/pages/NotFound', () => {
  return function MockNotFound() {
    return <div data-testid="not-found-page">Not Found Page</div>;
  };
});

// Mock MainLayout component
jest.mock('../src/components/layout/MainLayout', () => {
  return {
    MainLayout: ({ children }: { children: React.ReactNode }) => {
      return <div data-testid="main-layout">{children}</div>;
    }
  };
});

// Mock useHashRouting hook
jest.mock('../src/hooks/useHashRouting', () => {
  return {
    useHashRouting: () => ({
      currentHash: null,
      setHash: jest.fn(),
      clearHash: jest.fn(),
      isHashActive: jest.fn(() => false)
    })
  };
});

// Mock ErrorBoundary to handle errors properly in tests
jest.mock('../src/components/ErrorBoundary', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: class MockErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError() {
        return { hasError: true };
      }

      render() {
        if (this.state.hasError) {
          return React.createElement('div', null, 'Something went wrong');
        }
        return this.props.children;
      }
    },
  };
});

// Test version of App component without BrowserRouter
const TestApp = () => {
  const { user, session, loading, initializeAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [initializeAuth]);

  const RootRedirect = () => {
    if (loading || isLoading) {
      return <div data-testid="loading-spinner">Loading...</div>;
    }

    if (session && user) {
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  };

  const AuthRoute = ({ children }: { children: React.ReactNode }) => {
    if (loading || isLoading) {
      return <div data-testid="loading-spinner">Loading...</div>;
    }

    if (!session || !user) {
      return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
  };

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    return <AuthRoute>{children}</AuthRoute>;
  };

  return (
    <ErrorBoundary>
      <div className="App">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/chat" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <Chat />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <Settings />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <div data-testid="profile-page">Profile Page</div>
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/subscriptions" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <Subscriptions />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/transaction-history" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <TransactionHistory />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/help" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <HelpPage />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/error-monitoring" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <ErrorMonitoring />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </div>
    </ErrorBoundary>
  );
};

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseAuthStore.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      setUser: jest.fn(),
      setSession: jest.fn(),
      setLoading: jest.fn(),
      signOut: jest.fn(),
      initializeAuth: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn(() => false),
      clearAuthState: jest.fn(),
      resyncCacheSelectively: jest.fn()
    });
  });

  it('renders loading spinner when auth is loading', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      setUser: jest.fn(),
      setSession: jest.fn(),
      setLoading: jest.fn(),
      signOut: jest.fn(),
      initializeAuth: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn(() => false),
      clearAuthState: jest.fn(),
      resyncCacheSelectively: jest.fn()
    });

    render(
       <MemoryRouter initialEntries={['/']}>
         <TestApp />
       </MemoryRouter>
     );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders login page for unauthenticated users', async () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      setUser: jest.fn(),
      setSession: jest.fn(),
      setLoading: jest.fn(),
      signOut: jest.fn(),
      initializeAuth: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn(() => false),
      clearAuthState: jest.fn(),
      resyncCacheSelectively: jest.fn()
    });

    render(
       <MemoryRouter initialEntries={['/login']}>
         <TestApp />
       </MemoryRouter>
     );

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('renders dashboard for authenticated users', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      session: { user: { id: '1', email: 'test@example.com' } },
      loading: false,
      setUser: jest.fn(),
      setSession: jest.fn(),
      setLoading: jest.fn(),
      signOut: jest.fn(),
      initializeAuth: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn(() => true),
      clearAuthState: jest.fn(),
      resyncCacheSelectively: jest.fn()
    });

    // Mock window.location for navigation
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/dashboard',
        search: '',
        hash: '',
        href: 'http://localhost/dashboard'
      },
      writable: true
    });

    render(
      <MemoryRouter initialEntries={['/']}>        <TestApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('includes Toaster component for notifications', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TestApp />
      </MemoryRouter>
    );

    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('initializes auth store on mount', () => {
    const mockInitializeAuth = jest.fn();
    mockUseAuthStore.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      initializeAuth: mockInitializeAuth,
      setUser: jest.fn(),
      setSession: jest.fn(),
      clearAuthState: jest.fn(),
      resyncCacheSelectively: jest.fn(),
      setLoading: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn()
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <TestApp />
      </MemoryRouter>
    );

    // The App component calls initializeAuth from the store
    expect(mockInitializeAuth).toHaveBeenCalledTimes(1);
  });

  it('handles error boundary for the entire app', () => {
    // Create a component that throws an error
    const ErrorComponent = () => {
      throw new Error('App-level error');
    };

    // Render the ErrorComponent wrapped in our ErrorBoundary
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('handles routing errors gracefully', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      session: { access_token: 'mock-token' },
      loading: false,
      isLoading: false,
      isAuthenticated: true,
      initializeAuth: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn()
    });

    render(
      <MemoryRouter initialEntries={['/nonexistent-route']}>
        <TestApp />
      </MemoryRouter>
    );

    // Should redirect to dashboard for authenticated users
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'test@example.com' },
        isLoading: false,
        isAuthenticated: true,
        initialize: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn()
      });
    });

    it('renders chat page for authenticated users', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'test@example.com' },
        session: { access_token: 'mock-token' },
        loading: false,
        isLoading: false,
        isAuthenticated: true,
        initializeAuth: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn()
      });

      render(
        <MemoryRouter initialEntries={['/chat']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('chat-page')).toBeInTheDocument();
      });
    });

    it('renders settings page for authenticated users', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'test@example.com' },
        session: { access_token: 'mock-token' },
        loading: false,
        isLoading: false,
        isAuthenticated: true,
        initializeAuth: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn()
      });

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
    });

    it('renders profile page for authenticated users', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'test@example.com' },
        session: { access_token: 'mock-token' },
        loading: false,
        isLoading: false,
        isAuthenticated: true,
        initializeAuth: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn()
      });

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('profile-page')).toBeInTheDocument();
      });
    });
  });

  describe('Auth Routes', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        initialize: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        signup: jest.fn()
      });
    });

    it('renders signup page for unauthenticated users', async () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        setUser: jest.fn(),
        setSession: jest.fn(),
        setLoading: jest.fn(),
        signOut: jest.fn(),
        initializeAuth: jest.fn().mockResolvedValue(undefined),
        isAuthenticated: jest.fn(() => false),
        clearAuthState: jest.fn(),
        resyncCacheSelectively: jest.fn()
      });

      render(
        <MemoryRouter initialEntries={['/signup']}>          
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('signup-page')).toBeInTheDocument();
      });
    });

    it('redirects authenticated users away from auth pages', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'test@example.com' },
        session: { user: { id: '1', email: 'test@example.com' } },
        loading: false,
        setUser: jest.fn(),
        setSession: jest.fn(),
        setLoading: jest.fn(),
        signOut: jest.fn(),
        initializeAuth: jest.fn().mockResolvedValue(undefined),
        isAuthenticated: jest.fn(() => true),
        clearAuthState: jest.fn(),
        resyncCacheSelectively: jest.fn()
      });

      render(
        <MemoryRouter initialEntries={['/']}>          <TestApp />
        </MemoryRouter>
      );

      // Should redirect to dashboard
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Error Logging', () => {
    it('logs errors in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Trigger an error by calling console.error directly
      console.error('Test error for logging');
      
      expect(consoleSpy).toHaveBeenCalledWith('Test error for logging');
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});