import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { useEffect, useState, ReactNode, Suspense } from 'react';
import { useAuthStore } from './stores/authStore';
import { authRefreshManager } from './lib/authRefresh';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedLayout } from './components/layout/ProtectedLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import AnimatedLoadingPage from './components/AnimatedLoadingPage';
// Lazy imports for better code splitting
import { lazy } from 'react';
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Settings = lazy(() => import('./pages/settings'));
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'));
const ShareChat = lazy(() => import('./pages/ShareChat'));
const EnhancedStreamingChat = lazy(() => import('./components/EnhancedStreamingChat'));

// Admin page imports
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageBackgroundImages = lazy(() => import('./pages/admin/ManageBackgroundImages'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));

// Debug page imports
const SessionDebug = lazy(() => import('./pages/debug/SessionDebug'));
const SelectiveCleanupTest = lazy(() => import('./components/test/SelectiveCleanupTest'));

// Import lazy components that already exist
import { 
  SubscriptionsWithLoading as Subscriptions,
  HelpPageWithLoading as HelpPage,
  ErrorMonitoringWithLoading as ErrorMonitoring
} from './components/LazyComponents';
import { Toaster } from './components/ui/toaster';
import ErrorBoundary from './components/ErrorBoundary';
import AsyncErrorBoundary from './components/AsyncErrorBoundary';
import StreamingErrorBoundary from './components/StreamingErrorBoundary';
import GlobalErrorHandler, { trackPerformanceMetrics } from './components/GlobalErrorHandler';
import PerformanceMonitor from './components/PerformanceMonitor';
import AdminRoute from './components/AdminRoute';
import { LoadingFallback } from './components/LazyComponents';
import supabase from './services/supabaseClient';
import { BackgroundProvider } from './contexts/BackgroundContext';

// OAuth callback component
const OAuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setSession } = useAuthStore();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if there's a hash fragment in the URL (OAuth callback)
        if (window.location.hash) {
          // Let Supabase handle the OAuth callback automatically
          // The onAuthStateChange listener will catch the SIGNED_IN event
          console.log('OAuth callback detected, waiting for auth state change...');
          
          // Set a timeout to redirect to login if auth doesn't complete
          const timeout = setTimeout(() => {
            console.error('OAuth callback timeout');
            navigate('/login?error=oauth_timeout');
          }, 10000); // 10 second timeout
          
          // Listen for auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            clearTimeout(timeout);
            
            if (event === 'SIGNED_IN' && session) {
              console.log('OAuth sign in successful');
              setSession(session);
              setUser(session.user);
              subscription.unsubscribe();
              navigate('/dashboard');
            } else if (event === 'SIGNED_OUT' || !session) {
              console.log('OAuth sign in failed or signed out');
              subscription.unsubscribe();
              navigate('/login?error=oauth_failed');
            }
          });
          
          return;
        }
        
        // If no hash, check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          navigate('/login?error=session_error');
          return;
        }

        if (session) {
          setSession(session);
          setUser(session.user);
          navigate('/dashboard');
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login?error=oauth_failed');
      }
    };

    handleAuthCallback();
  }, [navigate, setUser, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, user, loading } = useAuthStore();
  
  if (loading) {
    return (
      <AnimatedLoadingPage 
        duration={1000}
      />
    );
  }
    
  return (session && user) ? <>{children}</> : <Navigate to="/login" replace />;
};

// Auth route wrapper (redirects to dashboard if already authenticated)
const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { session, user, loading } = useAuthStore();
  
  if (loading) {
    return (
      <AnimatedLoadingPage 
        duration={1000}
      />
    );
  }
  
  return (session && user) ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

// Root redirect component
const RootRedirect = () => {
  const { session, user, loading } = useAuthStore();
  
  if (loading) {
    return (
      <AnimatedLoadingPage 
        duration={1000}
      />
    );
  }
    
  // Check authentication using session instead of authToken
  return <Navigate to={(session && user) ? "/dashboard" : "/login"} replace />;
};

// Check if this is truly an initial visit (not a page refresh) - do this outside component to prevent flash
const getIsRealInitialLoad = () => {
  const hasVisited = sessionStorage.getItem('app-visited');
  if (!hasVisited) {
    sessionStorage.setItem('app-visited', 'true');
    return true;
  }
  return false;
};

function App() {
  const { setUser, setSession, clearAuthState, resyncCacheSelectively, loading, setLoading } = useAuthStore();
  
  // Get initial load status immediately to prevent flash
  const [isRealInitialLoad] = useState(() => getIsRealInitialLoad());
  const [showLoadingPage, setShowLoadingPage] = useState(isRealInitialLoad);
  const [isInitialLoad, setIsInitialLoad] = useState(isRealInitialLoad);

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          clearAuthState();
          setLoading(false);
          return;
        }

        if (session) {
          setSession(session);
          setUser(session.user);
          
          // Start auth refresh manager
          authRefreshManager.start();
          
          // Only resync cache on real initial load, not on navigation
          if (isRealInitialLoad) {
            console.log('Initial app load - checking cache freshness');
            await resyncCacheSelectively();
          } else {
            console.log('Navigation detected - skipping cache resync to prevent profile reload');
          }
        } else {
          clearAuthState();
        }
        
        // Set loading to false after initialization
        setLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearAuthState();
        setLoading(false);
      }
    };

    initializeAuth();
    trackPerformanceMetrics();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
          
          setSession(session);
          setUser(session.user);
          authRefreshManager.start();
        } else if (event === 'SIGNED_OUT') {
          clearAuthState();
          authRefreshManager.stop();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
          setUser(session.user);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      authRefreshManager.stop();
    };
  }, [setUser, setSession, clearAuthState, setLoading, resyncCacheSelectively]);

  // Handle loading page timing - only for real initial loads
  useEffect(() => {
    if (!loading && isInitialLoad && isRealInitialLoad) {
      // Ensure loading page shows for at least 1.5 seconds
      const minLoadingTime = 1500;
      const loadingTimer = setTimeout(() => {
        setShowLoadingPage(false);
        setIsInitialLoad(false);
      }, minLoadingTime);

      return () => clearTimeout(loadingTimer);
    }
  }, [loading, isInitialLoad, isRealInitialLoad]);

  // Show loading page during initial load (only for real initial visits)
  if ((showLoadingPage || (loading && isInitialLoad)) && isRealInitialLoad) {
    return (
      <AnimatedLoadingPage 
        onLoadingComplete={() => {
          setShowLoadingPage(false);
          setIsInitialLoad(false);
        }}
        duration={1500}
      />
    );
  }

  // Fallback loading state (should rarely be reached due to animated loading page)
  if (loading) {
    return (
      <AnimatedLoadingPage 
        duration={1000}
      />
    );
  }

  return (
    <GlobalErrorHandler>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          // Log errors to console in development
          console.error('Application Error:', error, errorInfo);
          
          // In production, you could send this to an error tracking service
          if (process.env.NODE_ENV === 'production') {
            // Example: logErrorToService(error, errorInfo);
          }
        }}
      >
        <BackgroundProvider>
          <Router>
          <div className="App">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Root redirect */}
              <Route index element={<RootRedirect />} />
            
            {/* Auth routes */}
            <Route path="/login" element={
              <AuthRoute>
                <ErrorBoundary>
                  <Login />
                </ErrorBoundary>
              </AuthRoute>
            } />
            <Route path="/signup" element={
              <AuthRoute>
                <ErrorBoundary>
                  <Signup />
                </ErrorBoundary>
              </AuthRoute>
            } />
            
            {/* OAuth callback route */}
            <Route path="/auth/callback" element={
              <ErrorBoundary>
                <OAuthCallback />
              </ErrorBoundary>
            } />

            {/* Public share route */}
            <Route path="/share/:shareId" element={
              <ErrorBoundary>
                <ShareChat />
              </ErrorBoundary>
            } />
            
            {/* Protected routes with persistent layout */}
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat/:chatId?" element={
                <StreamingErrorBoundary>
                  <AsyncErrorBoundary>
                    <ErrorBoundary>
                      <Chat />
                    </ErrorBoundary>
                  </AsyncErrorBoundary>
                </StreamingErrorBoundary>
              } />
              {/* Debug streaming route to validate SSE and model flow */}
              <Route path="/streaming" element={<EnhancedStreamingChat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/subscriptions" element={
                <AsyncErrorBoundary>
                  <ErrorBoundary>
                    <Subscriptions />
                  </ErrorBoundary>
                </AsyncErrorBoundary>
              } />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/transactions" element={<TransactionHistory />} />
              <Route path="/error-monitoring" element={
                <AsyncErrorBoundary>
                  <ErrorBoundary>
                    <ErrorMonitoring />
                  </ErrorBoundary>
                </AsyncErrorBoundary>
              } />
            </Route>
              
            {/* Admin routes with persistent layout */}
            <Route element={<AdminLayout />}>
              <Route path="/admin/users" element={<ManageUsers />} />
              <Route path="/admin/background-images" element={<ManageBackgroundImages />} />
              <Route path="/admin/system-settings" element={<SystemSettings />} />
            </Route>
              
            {/* Debug routes with persistent layout */}
            <Route element={<ProtectedLayout />}>
              <Route path="/debug/session" element={<SessionDebug />} />
              <Route path="/debug/cleanup-test" element={<SelectiveCleanupTest />} />
            </Route>
            
              {/* Catch all - redirect to root */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
          {/* Only show PerformanceMonitor in development mode */}
          {import.meta.env.DEV && <PerformanceMonitor />}
          </div>
          </Router>
        </BackgroundProvider>
      </ErrorBoundary>
    </GlobalErrorHandler>
  );
}

export default App;