const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

// Initialize Sentry
function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new ProfilingIntegration(),
    ],
    
    // Error filtering
    beforeSend(event) {
      // Filter out certain errors in development
      if (process.env.NODE_ENV === 'development') {
        // Skip certain development-only errors
        if (event.exception?.values?.[0]?.value?.includes('ECONNREFUSED')) {
          return null;
        }
      }
      return event;
    },
    
    // Release tracking
    release: process.env.npm_package_version || '1.0.0',
  });

  isSentryInitialized = true;
  console.log('Sentry initialized for backend');
}

// Check if Sentry is initialized
let isSentryInitialized = false;

// Enhanced error tracking utilities
const sentryErrorTracker = {
  captureException: (error, context = {}) => {
    if (!isSentryInitialized) {
      console.error('Sentry not initialized, logging error:', error.message);
      return null;
    }
    return Sentry.captureException(error, {
      tags: context.tags || {},
      extra: context.extra || {},
      user: context.user || {},
      level: context.level || 'error'
    });
  },

  captureMessage: (message, level = 'info', context = {}) => {
    if (!isSentryInitialized) {
      console.log('Sentry not initialized, logging message:', message);
      return null;
    }
    return Sentry.captureMessage(message, level, {
      tags: context.tags || {},
      extra: context.extra || {},
      user: context.user || {}
    });
  },

  setUser: (user) => {
    if (!isSentryInitialized) {
      return;
    }
    Sentry.setUser(user);
  },

  addBreadcrumb: (breadcrumb) => {
    if (!isSentryInitialized) {
      return;
    }
    Sentry.addBreadcrumb(breadcrumb);
  },

  // Express middleware
  requestHandler: () => {
    if (!isSentryInitialized) {
      return (req, res, next) => next();
    }
    return Sentry.Handlers.requestHandler();
  },
  errorHandler: () => {
    if (!isSentryInitialized) {
      return (error, req, res, next) => next(error);
    }
    return Sentry.Handlers.errorHandler();
  }
};

module.exports = {
  initSentry,
  sentryErrorTracker,
  Sentry
};