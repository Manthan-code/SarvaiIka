import * as Sentry from '@sentry/react';

// Sentry configuration
const sentryConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE || 'development',
  debug: import.meta.env.MODE === 'development',
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  beforeSend(event, hint) {
    // Filter out development errors
    if (import.meta.env.MODE === 'development') {
      console.log('Sentry event:', event);
    }
    
    // Don't send events in development unless explicitly enabled
    if (import.meta.env.MODE === 'development' && !import.meta.env.VITE_SENTRY_DEBUG) {
      return null;
    }
    
    return event;
  },
  // Performance monitoring
  profilesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,
};

// Initialize Sentry
export const initSentry = () => {
  if (sentryConfig.dsn) {
    Sentry.init(sentryConfig);
    console.log('Sentry initialized for environment:', sentryConfig.environment);
  } else {
    console.warn('Sentry DSN not found. Error tracking will use local service only.');
  }
};

// Enhanced error tracking service integration
export const sentryErrorTracker = {
  captureException: (error: Error, context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: 'error' | 'warning' | 'info' | 'debug';
    user?: { id?: string; email?: string; username?: string };
  }) => {
    if (!sentryConfig.dsn) return null;
    
    return Sentry.withScope((scope) => {
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      
      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      if (context?.level) {
        scope.setLevel(context.level);
      }
      
      if (context?.user) {
        scope.setUser(context.user);
      }
      
      return Sentry.captureException(error);
    });
  },
  
  captureMessage: (message: string, level: 'error' | 'warning' | 'info' | 'debug' = 'info', context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }) => {
    if (!sentryConfig.dsn) return null;
    
    return Sentry.withScope((scope) => {
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      
      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      scope.setLevel(level);
      return Sentry.captureMessage(message);
    });
  },
  
  setUser: (user: { id?: string; email?: string; username?: string }) => {
    Sentry.setUser(user);
  },
  
  addBreadcrumb: (breadcrumb: {
    message: string;
    category?: string;
    level?: 'error' | 'warning' | 'info' | 'debug';
    data?: Record<string, any>;
  }) => {
    Sentry.addBreadcrumb(breadcrumb);
  }
};

// React imports for router integration


export { Sentry };
export default sentryConfig;