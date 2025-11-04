import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import StreamingErrorBoundary, { useStreamingError, withStreamingErrorBoundary } from '../../src/components/StreamingErrorBoundary';
import { errorTrackingService } from '../../src/services/errorTrackingService';
import { notificationService } from '../../src/services/notificationService';

// Mock services
jest.mock('../../src/services/errorTrackingService', () => ({
  errorTrackingService: {
    captureError: jest.fn(),
    captureException: jest.fn(),
    reportError: jest.fn()
  }
}));

jest.mock('../../src/services/notificationService', () => ({
  notificationService: {
    showNotification: jest.fn()
  }
}));

// Mock UI components
jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

jest.mock('../../src/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

jest.mock('../../src/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Wifi: () => <div data-testid="wifi-icon" />,
  WifiOff: () => <div data-testid="wifi-off-icon" />,
  MessageSquare: () => <div data-testid="message-square-icon" />
}));

const mockErrorTrackingService = errorTrackingService as jest.Mocked<typeof errorTrackingService>;
const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Test components
const ThrowError = ({ shouldThrow = false, errorType = 'generic' }: { 
  shouldThrow?: boolean; 
  errorType?: 'generic' | 'streaming' | 'network'; 
}) => {
  if (shouldThrow) {
    const error = new Error(`${errorType} test error`);
    if (errorType === 'streaming') {
      error.name = 'StreamingError';
    } else if (errorType === 'network') {
      error.name = 'NetworkError';
    }
    throw error;
  }
  return <div>No error</div>;
};

const StreamingComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  const { dispatchStreamingError } = useStreamingError();
  
  React.useEffect(() => {
    if (shouldThrow) {
      const error = new Error('Streaming connection failed');
      error.name = 'StreamingError';
      dispatchStreamingError(error);
    }
  }, [shouldThrow, dispatchStreamingError]);
  
  return <div>Streaming component</div>;
};

describe('StreamingErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Use spies instead of replacing add/removeEventListener to avoid breaking React internals
    jest.spyOn(window, 'addEventListener');
    jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <StreamingErrorBoundary>
        <div>Test content</div>
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches and displays streaming errors', () => {
    render(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={true} errorType="streaming" />
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText(/chat connection issue/i)).toBeInTheDocument();
    expect(screen.getByText(/retry connection/i)).toBeInTheDocument();
  });

  it('catches and displays network errors', () => {
    render(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={true} errorType="network" />
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('catches and displays generic errors', () => {
    render(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={true} errorType="generic" />
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('handles retry functionality', async () => {
    const { rerender } = render(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={true} errorType="streaming" />
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText(/chat connection issue/i)).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button', { name: /retry connection/i });
    fireEvent.click(retryButton);
    
    // After retry, component should reset; ensure child no longer throws
    rerender(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={false} />
      </StreamingErrorBoundary>
    );
    
    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  it('tracks errors with error tracking service', () => {
    render(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={true} errorType="streaming" />
      </StreamingErrorBoundary>
    );
    
    expect(mockErrorTrackingService.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          component: 'StreamingErrorBoundary',
          errorType: 'streaming'
        })
      })
    );
  });

  it('shows notifications for critical errors', () => {
    render(
      <StreamingErrorBoundary>
        <ThrowError shouldThrow={true} errorType="network" />
      </StreamingErrorBoundary>
    );
    
    expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Connection Error'
      })
    );
  });

  it('implements auto-retry for streaming errors', async () => {
    jest.useFakeTimers();
    
    render(
      <StreamingErrorBoundary autoRetry={true} maxRetries={2}>
        <ThrowError shouldThrow={true} errorType="streaming" />
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText(/chat connection issue/i)).toBeInTheDocument();
    
    // Fast-forward time to trigger auto-retry
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/retrying/i)).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('handles custom fallback UI', () => {
    const CustomFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={retry}>Custom retry</button>
      </div>
    );
    
    render(
      <StreamingErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} errorType="streaming" />
      </StreamingErrorBoundary>
    );
    
    expect(screen.getByText(/custom error: streaming test error/i)).toBeInTheDocument();
    expect(screen.getByText('Custom retry')).toBeInTheDocument();
  });

  it('calls onError callback when provided', () => {
    const onErrorMock = jest.fn();
    
    render(
      <StreamingErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} errorType="streaming" />
      </StreamingErrorBoundary>
    );
    
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });
});

describe('useStreamingError hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Use spies instead of replacing add/removeEventListener to avoid breaking React internals
    jest.spyOn(window, 'addEventListener');
    jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches streaming errors correctly', async () => {
    const onStreamError = jest.fn();
    
    const { container } = render(
      <StreamingErrorBoundary onStreamError={onStreamError}>
        <div>Test content</div>
      </StreamingErrorBoundary>
    );
    
    // Ensure component is mounted
    expect(screen.getByText('Test content')).toBeInTheDocument();
    
    // Wait a bit for component to fully mount
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Manually dispatch the custom event to test the error boundary
    const error = new Error('Hook test error');
    error.name = 'StreamingError';
    const event = new CustomEvent('streaming-error', { detail: error });
    
    act(() => {
      window.dispatchEvent(event);
    });
    
    await waitFor(() => {
      expect(onStreamError).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    await waitFor(() => {
      expect(screen.getByText(/chat connection issue/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('withStreamingErrorBoundary HOC', () => {
  it('wraps component with streaming error boundary', () => {
    const TestComponent = () => <div>HOC Test</div>;
    const WrappedComponent = withStreamingErrorBoundary(TestComponent);
    
    render(<WrappedComponent />);
    
    expect(screen.getByText('HOC Test')).toBeInTheDocument();
  });
  
  it('passes props to wrapped component', () => {
    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const WrappedComponent = withStreamingErrorBoundary(TestComponent);
    
    render(<WrappedComponent message="HOC Props Test" />);
    
    expect(screen.getByText('HOC Props Test')).toBeInTheDocument();
  });
});

describe('StreamingErrorBoundary event listeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock window.addEventListener
    Object.defineProperty(window, 'addEventListener', {
      value: jest.fn(),
      writable: true
    });
    
    Object.defineProperty(window, 'removeEventListener', {
      value: jest.fn(),
      writable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets up streaming error event listeners', () => {
    const mockAddEventListener = jest.fn();
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = mockAddEventListener;
    
    const { getByTestId } = render(
      <StreamingErrorBoundary>
        <div data-testid="test-child">Test</div>
      </StreamingErrorBoundary>
    );
    
    // Verify component and child rendered
    expect(getByTestId('test-child')).toBeInTheDocument();
    
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'streaming-error',
      expect.any(Function)
    );
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    
    window.addEventListener = originalAddEventListener;
  });
  
  it('cleans up event listeners on unmount', () => {
    const mockRemoveEventListener = jest.fn();
    const originalRemoveEventListener = window.removeEventListener;
    window.removeEventListener = mockRemoveEventListener;
    
    const { unmount } = render(
      <StreamingErrorBoundary>
        <div data-testid="test-child">Test</div>
      </StreamingErrorBoundary>
    );
    
    unmount();
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      'streaming-error',
      expect.any(Function)
    );
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    
    window.removeEventListener = originalRemoveEventListener;
  });
});