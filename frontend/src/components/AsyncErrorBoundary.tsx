import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { errorTrackingService } from '../services/errorTrackingService';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isNetworkError: boolean;
  retryCount: number;
}

class AsyncErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private unhandledRejectionHandler: (event: PromiseRejectionEvent) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isNetworkError: false,
      retryCount: 0,
    };
    
    this.unhandledRejectionHandler = this.handleUnhandledRejection.bind(this);
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state when children change
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({
        hasError: false,
        error: null,
        isNetworkError: false,
        retryCount: 0,
      });
    }
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    
    // Track error with error tracking service
    errorTrackingService.captureException(error, {
      tags: { component: 'AsyncErrorBoundary' }
    });
    
    this.setState({
      hasError: true,
      error,
      isNetworkError: this.isNetworkError(error),
      retryCount: 0,
    });
    
    if (this.props.onError) {
      this.props.onError(error);
    }
    
    event.preventDefault();
  };

  private isNetworkError(error: Error): boolean {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'NetworkError' ||
      error.name === 'TypeError'
    );
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isNetworkError = 
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'NetworkError' ||
      error.name === 'TypeError';

    return {
      hasError: true,
      error,
      isNetworkError,
    };
  }

  componentDidCatch(error: Error) {
    console.error('AsyncErrorBoundary caught an error:', error);
    
    // Track error with error tracking service
    errorTrackingService.reportError({
      message: error.message,
      details: error.stack,
      component: 'AsyncErrorBoundary',
      severity: this.state.isNetworkError ? 'medium' : 'high',
      stackTrace: error.stack
    });
    
    if (this.props.onError) {
      this.props.onError(error);
    }

    // Auto-retry for network errors
    if (this.state.isNetworkError && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  scheduleRetry = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff
    
    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1,
      }));
    }, delay);
  };

  handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      isNetworkError: false,
      retryCount: 0,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleManualRetry);
      }

      // Network error UI
      if (this.state.isNetworkError) {
        return (
          <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <WifiOff className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Connection Problem
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Unable to connect to the server. Please check your internet connection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {this.state.retryCount < this.maxRetries && (
                  <Alert>
                    <Wifi className="h-4 w-4" />
                    <AlertDescription>
                      Automatically retrying... (Attempt {this.state.retryCount + 1} of {this.maxRetries})
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button
                  onClick={this.handleManualRetry}
                  className="w-full flex items-center justify-center gap-2"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                
                {(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && (
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-700">
                      Error Details
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }

      // General async error UI
      return (
        <div className="flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-gray-600">
                An error occurred while loading this content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={this.handleManualRetry}
                className="w-full flex items-center justify-center gap-2"
                variant="default"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              
              {(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700">
                    Error Details
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AsyncErrorBoundary;

// Hook for handling async errors in functional components
export const useAsyncError = () => {
  const [, setError] = React.useState();
  
  const throwError = React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);

  return throwError;
};

// Higher-order component for wrapping async components
export const withAsyncErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <AsyncErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AsyncErrorBoundary>
  );

  WrappedComponent.displayName = `withAsyncErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Utility function to wrap async functions with error boundary support
export const withErrorHandling = <T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>,
  onError?: (error: Error) => void
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (onError) {
        onError(errorObj);
      }
      
      throw errorObj;
    }
  };
};