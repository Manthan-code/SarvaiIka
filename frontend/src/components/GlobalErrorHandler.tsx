import React, { Component, ReactNode } from 'react';
import { errorTrackingService } from '../services/errorTrackingService';
import { notificationService } from '../services/notificationService';

interface Props {
  children: ReactNode;
}

interface State {
  hasGlobalError: boolean;
}

class GlobalErrorHandler extends Component<Props, State> {
  private unhandledErrorHandler: (event: ErrorEvent) => void;
  private unhandledRejectionHandler: (event: PromiseRejectionEvent) => void;
  private manualErrorHandler: (event: CustomEvent) => void;
  private originalConsoleError: typeof console.error;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasGlobalError: false,
    };

    this.unhandledErrorHandler = this.handleUnhandledError.bind(this);
    this.unhandledRejectionHandler = this.handleUnhandledRejection.bind(this);

    this.manualErrorHandler = (event: CustomEvent) => {
      this.handleManualError(event);
    };
  }

  componentDidMount() {
    // Store original console.error before overriding
    this.originalConsoleError = console.error;
    
    // Global error handlers
    window.addEventListener('error', this.unhandledErrorHandler);
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
    window.addEventListener('manual-error-report', this.manualErrorHandler as EventListener);
    
    // Console error override for development
    if (process.env.NODE_ENV === 'development') {
      console.error = (...args: any[]) => {
        // Call original console.error
        this.originalConsoleError.apply(console, args);
        
        // Track console errors in development (but avoid tracking our own error logs)
        if (args.length > 0 && typeof args[0] === 'string' && 
            !args[0].includes('🚨 Global Error Handler') &&
            !args[0].includes('Error tracked:') &&
            !args[0].includes('Error handled:') &&
            !args[0].includes('Error loading messages:') &&
            !args[0].includes('Failed to load resource:')) {
          const error = new Error(args[0]);
          this.trackError(error, { source: 'console.error', args });
        }
      };
    }
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.unhandledErrorHandler);
    window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
    window.removeEventListener('manual-error-report', this.manualErrorHandler as EventListener);
    
    // Restore original console.error
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
    }
  }

  handleUnhandledError = (event: ErrorEvent) => {
    const error = event.error || new Error(event.message);
    
    this.trackError(error, {
      source: 'unhandled-error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href
    });

    // Prevent default browser error handling in production
    if (process.env.NODE_ENV === 'production') {
      event.preventDefault();
    }
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    
    this.trackError(error, {
      source: 'unhandled-rejection',
      url: window.location.href,
      reason: event.reason
    });

    // Prevent default browser error handling in production
    if (process.env.NODE_ENV === 'production') {
      event.preventDefault();
    }
  };

  handleManualError = (event: CustomEvent) => {
    const { error, metadata } = event.detail;
    this.trackError(error, { 
      source: 'manual-report',
      ...metadata 
    });
  };

  private trackError = (error: Error, metadata: Record<string, any> = {}) => {
    try {
      // Track with error tracking service
      errorTrackingService.captureException(error, {
        tags: {
          component: 'GlobalErrorHandler',
          source: metadata.source || 'unknown'
        },
        extra: metadata
      });

      // Report to error API service
      errorTrackingService.reportError({
        message: error.message,
        details: error.stack || 'No stack trace available',
        component: 'GlobalErrorHandler',
        severity: this.getErrorSeverity(error),
        stackTrace: error.stack,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      });

      // Show user notification for critical errors
      if (this.isCriticalError(error)) {
        notificationService.showNotification({
          type: 'error',
          title: 'Application Error',
          message: 'An unexpected error occurred. Our team has been notified.',
          duration: 5000
        });
      }

      // Log to console in development using original console.error to avoid recursion
      if (process.env.NODE_ENV === 'development') {
        this.originalConsoleError('🚨 Global Error Handler - Error:', error);
        this.originalConsoleError('🚨 Global Error Handler - Metadata:', metadata);
      }
    } catch (trackingError) {
      // Fallback if error tracking fails (use original console.error to avoid recursion)
      this.originalConsoleError('Error tracking failed:', trackingError);
      this.originalConsoleError('Original error:', error);
    }
  };

  private getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' | 'critical' => {
    const message = error.message.toLowerCase();
    const stack = (error.stack || '').toLowerCase();

    // Critical errors
    if (
      message.includes('chunk') ||
      message.includes('loading') ||
      message.includes('network') ||
      message.includes('fetch')
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      message.includes('auth') ||
      message.includes('permission') ||
      message.includes('unauthorized') ||
      stack.includes('payment') ||
      stack.includes('billing')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (
      message.includes('validation') ||
      message.includes('format') ||
      stack.includes('component')
    ) {
      return 'medium';
    }

    return 'low';
  };

  private isCriticalError = (error: Error): boolean => {
    const criticalKeywords = [
      'chunk',
      'loading',
      'network',
      'auth',
      'payment',
      'billing'
    ];

    const message = error.message.toLowerCase();
    const stack = (error.stack || '').toLowerCase();

    return criticalKeywords.some(keyword => 
      message.includes(keyword) || stack.includes(keyword)
    );
  };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.trackError(error, {
      source: 'react-error-boundary',
      componentStack: errorInfo.componentStack,
      errorBoundary: 'GlobalErrorHandler'
    });

    this.setState({ hasGlobalError: true });
  }

  render() {
    if (this.state.hasGlobalError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc',
          borderRadius: '4px',
          margin: '20px'
        }}>
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Please refresh the page or try again later.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorHandler;

// Hook for manually reporting errors
export const useGlobalErrorHandler = () => {
  const reportError = React.useCallback((error: Error, metadata?: Record<string, any>) => {
    // Dispatch a custom event that the GlobalErrorHandler can catch
    const event = new CustomEvent('manual-error-report', {
      detail: { error, metadata }
    });
    window.dispatchEvent(event);
  }, []);

  const reportWarning = React.useCallback((message: string, metadata?: Record<string, any>) => {
    const warning = new Error(message);
    warning.name = 'Warning';
    reportError(warning, { ...metadata, severity: 'low' });
  }, [reportError]);

  return {
    reportError,
    reportWarning
  };
};

// Performance monitoring integration
export const trackPerformanceMetrics = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (perfData) {
          const metrics = {
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
          };

          // Report slow page loads as warnings
          if (metrics.loadTime > 3000) {
            const event = new CustomEvent('manual-error-report', {
              detail: {
                error: new Error('Slow page load detected'),
                metadata: {
                  severity: 'medium',
                  source: 'performance-monitoring',
                  metrics
                }
              }
            });
            window.dispatchEvent(event);
          }
        }
      }, 0);
    });
  }
};