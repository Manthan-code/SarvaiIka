import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary, { useErrorHandler, withErrorBoundary } from '../src/components/ErrorBoundary';
import AsyncErrorBoundary, { useAsyncError, withAsyncErrorBoundary } from '../src/components/AsyncErrorBoundary';

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Test component that throws an error
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

// Test component for async errors
const AsyncThrowError = ({ shouldThrow = false, errorType = 'generic' }) => {
  const throwAsyncError = useAsyncError();
  
  React.useEffect(() => {
    if (shouldThrow) {
      const error = errorType === 'network' 
        ? new Error('Failed to fetch')
        : new Error('Async error');
      
      if (errorType === 'network') {
        error.name = 'NetworkError';
      }
      
      throwAsyncError(error);
    }
  }, [shouldThrow, errorType, throwAsyncError]);
  
  return <div>Async component</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('catches and displays error when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Test error message" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('We\'re sorry, but something unexpected happened. Please try again.')).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Development error" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Error Details:')).toBeInTheDocument();
    expect(screen.getByText('Development error')).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Production error" />
      </ErrorBoundary>
    );
    
    expect(screen.queryByText('Error Details:')).not.toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('calls onError callback when error occurs', () => {
    const onErrorMock = jest.fn();
    
    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} errorMessage="Callback test error" />
      </ErrorBoundary>
    );
    
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Callback test error' }),
      expect.any(Object)
    );
  });

  // TODO: Fix ErrorBoundary retry functionality
  it.skip('resets error state when Try Again button is clicked', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Try Again'));
    
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  it('navigates to home when Go Home button is clicked', () => {
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: '' };
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByText('Go Home'));
    
    expect(window.location.href).toBe('/');
    
    (window as any).location = originalLocation;
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

describe('AsyncErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders children when there is no error', () => {
    render(
      <AsyncErrorBoundary>
        <AsyncThrowError shouldThrow={false} />
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByText('Async component')).toBeInTheDocument();
  });

  it('catches and displays network errors with specific UI', async () => {
    render(
      <AsyncErrorBoundary>
        <AsyncThrowError shouldThrow={true} errorType="network" />
      </AsyncErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to the server. Please check your internet connection.')).toBeInTheDocument();
    });
  });

  it('catches and displays generic async errors', async () => {
    render(
      <AsyncErrorBoundary>
        <AsyncThrowError shouldThrow={true} errorType="generic" />
      </AsyncErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('An error occurred while loading this content.')).toBeInTheDocument();
    });
  });

  it('shows auto-retry message for network errors', async () => {
    render(
      <AsyncErrorBoundary>
        <AsyncThrowError shouldThrow={true} errorType="network" />
      </AsyncErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Automatically retrying.../)).toBeInTheDocument();
    });
  });

  it('calls onError callback when async error occurs', async () => {
    const onErrorMock = jest.fn();
    
    render(
      <AsyncErrorBoundary onError={onErrorMock}>
        <AsyncThrowError shouldThrow={true} errorType="generic" />
      </AsyncErrorBoundary>
    );
    
    await waitFor(() => {
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Async error' })
      );
    });
  });

  // TODO: Fix retry functionality test
  it.skip('resets error state when Try Again button is clicked', async () => {
    render(
      <AsyncErrorBoundary>
        <AsyncThrowError shouldThrow={true} errorType="generic" />
      </AsyncErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
    
    // Verify the Try Again button is present
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    
    // Click the Try Again button should reset the error boundary
    fireEvent.click(screen.getByText('Try Again'));
    
    // After clicking retry, the error UI should be gone
    await waitFor(() => {
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  it('renders custom fallback when provided', async () => {
    const customFallback = (error: Error, retry: () => void) => (
      <div>
        <span>Custom async error: {error.message}</span>
        <button onClick={retry}>Custom Retry</button>
      </div>
    );
    
    render(
      <AsyncErrorBoundary fallback={customFallback}>
        <AsyncThrowError shouldThrow={true} errorType="generic" />
      </AsyncErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Custom async error: Async error')).toBeInTheDocument();
      expect(screen.getByText('Custom Retry')).toBeInTheDocument();
    });
  });
});

describe('useErrorHandler hook', () => {
  it('captures and throws errors', () => {
    const TestComponent = () => {
      const { captureError } = useErrorHandler();
      
      return (
        <button onClick={() => captureError(new Error('Hook error'))}>
          Trigger Error
        </button>
      );
    };
    
    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByText('Trigger Error'));
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    const TestComponent = () => <ThrowError shouldThrow={true} />;
    const WrappedComponent = withErrorBoundary(TestComponent);
    
    render(<WrappedComponent />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('passes through props to wrapped component', () => {
    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);
    
    render(<WrappedComponent message="Test message" />);
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });
});

describe('withAsyncErrorBoundary HOC', () => {
  it('wraps component with async error boundary', async () => {
    const TestComponent = () => <AsyncThrowError shouldThrow={true} errorType="network" />;
    const WrappedComponent = withAsyncErrorBoundary(TestComponent);
    
    render(<WrappedComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    });
  });
});

describe('Error boundary integration', () => {
  it('handles nested error boundaries correctly', () => {
    render(
      <ErrorBoundary>
        <div>
          <AsyncErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Nested error" />
          </AsyncErrorBoundary>
        </div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('isolates errors to specific boundary levels', async () => {
    render(
      <div>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="First error" />
        </ErrorBoundary>
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </div>
    );
    
    expect(screen.getAllByText('Something went wrong')).toHaveLength(1);
    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});