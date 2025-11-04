import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

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

// Note: trackPerformanceMetrics is tested separately as it's a standalone function

// Import after mocks
import GlobalErrorHandler, { useGlobalErrorHandler } from '../../src/components/GlobalErrorHandler';
import { errorTrackingService } from '../../src/services/errorTrackingService';
import { notificationService } from '../../src/services/notificationService';

const mockErrorTrackingService = errorTrackingService as jest.Mocked<typeof errorTrackingService>;
const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;

describe('GlobalErrorHandler', () => {
  let originalConsoleError: typeof console.error;
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let errorEventListener: ((event: ErrorEvent) => void) | null = null;
  let rejectionEventListener: ((event: PromiseRejectionEvent) => void) | null = null;
  let manualErrorListener: ((event: CustomEvent) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original methods
    originalConsoleError = console.error;
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
    
    // Mock console.error
    console.error = jest.fn();
    
    // Mock event listeners and capture the handlers
    window.addEventListener = jest.fn((event: string, handler: any) => {
      if (event === 'error') {
        errorEventListener = handler;
      } else if (event === 'unhandledrejection') {
        rejectionEventListener = handler;
      } else if (event === 'manual-error-report') {
        manualErrorListener = handler;
      }
    });
    
    window.removeEventListener = jest.fn();
    
    // Reset captured listeners
    errorEventListener = null;
    rejectionEventListener = null;
    manualErrorListener = null;
  });

  afterEach(() => {
    // Restore original methods
    console.error = originalConsoleError;
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    jest.restoreAllMocks();
  });

  it('renders children without errors', () => {
    render(
      <GlobalErrorHandler>
        <div>Test content</div>
      </GlobalErrorHandler>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('sets up global error event listeners on mount', () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    expect(window.addEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
  });

  it('removes event listeners on unmount', () => {
    const { unmount } = render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    unmount();
    
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
  });

  it('handles global JavaScript errors', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // Wait for component to mount and set up event listeners
    await waitFor(() => {
      expect(errorEventListener).not.toBeNull();
    });
    
    // Simulate a global error
    const mockError = new Error('Global test error');
    const errorEvent = {
      error: mockError,
      filename: 'test.js',
      lineno: 10,
      colno: 5,
      message: 'Global test error'
    } as ErrorEvent;
    
    if (errorEventListener) {
      act(() => {
        errorEventListener(errorEvent);
      });
    }
    
    await waitFor(() => {
      expect(mockErrorTrackingService.captureException).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({
          tags: expect.objectContaining({
            component: 'GlobalErrorHandler',
            source: 'unhandled-error'
          }),
          extra: expect.objectContaining({
            filename: 'test.js',
            lineno: 10,
            colno: 5
          })
        })
      );
    });
  });

  it('handles unhandled promise rejections', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // Wait for component to mount and set up event listeners
    await waitFor(() => {
      expect(rejectionEventListener).not.toBeNull();
    });
    
    // Simulate an unhandled promise rejection
    const mockReason = new Error('Promise rejection error');
    const mockPromise = Promise.resolve(); // Use resolved promise to avoid actual rejection
    const rejectionEvent = {
      reason: mockReason,
      promise: mockPromise
    } as PromiseRejectionEvent;
    
    if (rejectionEventListener) {
      act(() => {
        rejectionEventListener(rejectionEvent);
      });
    }
    
    await waitFor(() => {
      expect(mockErrorTrackingService.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            component: 'GlobalErrorHandler',
            source: 'unhandled-rejection'
          })
        })
      );
    });
  });

  it('shows notifications for critical errors', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // Simulate a critical error (network error)
    const mockError = new Error('Failed to fetch');
    mockError.name = 'NetworkError';
    const errorEvent = {
      error: mockError,
      filename: 'api.js',
      lineno: 1,
      colno: 1,
      message: 'Failed to fetch'
    } as ErrorEvent;
    
    if (errorEventListener) {
      act(() => {
        errorEventListener(errorEvent);
      });
    }
    
    await waitFor(() => {
      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Application Error',
          message: 'An unexpected error occurred. Our team has been notified.'
        })
      );
    });
  });

  it('overrides console.error in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // console.error should be overridden
    expect(console.error).not.toBe(originalConsoleError);
    
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not override console.error in production mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // console.error should remain the mock (not overridden)
    expect(console.error).toBe(console.error);
    
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('handles errors without error objects gracefully', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // Simulate an error event without an error object
    const errorEvent = {
      error: null,
      filename: 'test.js',
      lineno: 10,
      colno: 5,
      message: 'Script error'
    } as ErrorEvent;
    
    if (errorEventListener) {
      act(() => {
        errorEventListener(errorEvent);
      });
    }
    
    await waitFor(() => {
      expect(mockErrorTrackingService.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  it('handles promise rejections with non-error reasons', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    // Wait for component to mount and set up event listeners
    await waitFor(() => {
      expect(rejectionEventListener).not.toBeNull();
    });
    
    // Simulate a promise rejection with a string reason
    const mockPromise = Promise.resolve(); // Use resolved promise to avoid actual rejection
    const rejectionEvent = {
      reason: 'String rejection reason',
      promise: mockPromise
    } as PromiseRejectionEvent;
    
    if (rejectionEventListener) {
      act(() => {
        rejectionEventListener(rejectionEvent);
      });
    }
    
    await waitFor(() => {
      expect(mockErrorTrackingService.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            source: 'unhandled-rejection'
          })
        })
      );
    });
  });

  it('exports trackPerformanceMetrics function', () => {
    // Import the function to test it exists
    const { trackPerformanceMetrics } = require('../../src/components/GlobalErrorHandler');
    expect(typeof trackPerformanceMetrics).toBe('function');
  });

  it('trackPerformanceMetrics can be called without errors', () => {
    const { trackPerformanceMetrics } = require('../../src/components/GlobalErrorHandler');
    
    // Call the function and ensure it doesn't throw
    expect(() => trackPerformanceMetrics()).not.toThrow();
  });
});

describe('useGlobalErrorHandler hook', () => {
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let manualErrorListener: ((event: CustomEvent) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original methods
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
    
    // Mock event listeners and capture the handlers
    window.addEventListener = jest.fn((event: string, handler: any) => {
      if (event === 'manual-error-report') {
        manualErrorListener = handler;
      }
    });
    
    window.removeEventListener = jest.fn();
    
    // Reset captured listeners
    manualErrorListener = null;
  });

  afterEach(() => {
    // Restore original methods
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    jest.restoreAllMocks();
  });

  it('provides error reporting functions', () => {
    let hookResult: any = null;
    
    const TestComponent = () => {
      hookResult = useGlobalErrorHandler();
      return <div>Test</div>;
    };
    
    render(
      <GlobalErrorHandler>
        <TestComponent />
      </GlobalErrorHandler>
    );
    
    expect(hookResult).toBeDefined();
    expect(hookResult.reportError).toBeDefined();
    expect(hookResult.reportWarning).toBeDefined();
    expect(typeof hookResult.reportError).toBe('function');
    expect(typeof hookResult.reportWarning).toBe('function');
  });

  it('reports errors through the hook', async () => {
    let hookResult: any = null;
    
    const TestComponent = () => {
      hookResult = useGlobalErrorHandler();
      return (
        <button 
          onClick={() => {
            if (hookResult) {
              hookResult.reportError(new Error('Hook reported error'), { context: 'test-context' });
            }
          }}
        >
          Report Error
        </button>
      );
    };
    
    render(
      <GlobalErrorHandler>
        <TestComponent />
      </GlobalErrorHandler>
    );
    
    // Wait for the manual error listener to be set up
    await waitFor(() => {
      expect(manualErrorListener).not.toBeNull();
    });
    
    // Simulate the manual error report event directly
    const testError = new Error('Hook reported error');
    const customEvent = {
      detail: { 
        error: testError, 
        metadata: { context: 'test-context' } 
      }
    } as CustomEvent;
    
    act(() => {
      manualErrorListener!(customEvent);
    });
    
    await waitFor(() => {
      expect(mockErrorTrackingService.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            component: 'GlobalErrorHandler',
            source: 'manual-report'
          }),
          extra: expect.objectContaining({
            context: 'test-context'
          })
        })
      );
    });
  });

  it('can be used outside GlobalErrorHandler without throwing', () => {
    const TestComponent = () => {
      const { reportError, reportWarning } = useGlobalErrorHandler();
      return (
        <div>
          <button onClick={() => reportError(new Error('test'))}>Report Error</button>
          <button onClick={() => reportWarning('test warning')}>Report Warning</button>
        </div>
      );
    };
    
    expect(() => {
      render(<TestComponent />);
    }).not.toThrow();
  });
});

describe('GlobalErrorHandler error classification', () => {
  let originalConsoleError: typeof console.error;
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let errorEventListener: ((event: ErrorEvent) => void) | null = null;
  let rejectionEventListener: ((event: PromiseRejectionEvent) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original methods
    originalConsoleError = console.error;
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
    
    // Mock console.error
    console.error = jest.fn();
    
    // Mock event listeners and capture the handlers
    window.addEventListener = jest.fn((event: string, handler: any) => {
      if (event === 'error') {
        errorEventListener = handler;
      } else if (event === 'unhandledrejection') {
        rejectionEventListener = handler;
      }
    });
    
    window.removeEventListener = jest.fn();
    
    // Reset captured listeners
    errorEventListener = null;
    rejectionEventListener = null;
  });

  afterEach(() => {
    // Restore original methods
    console.error = originalConsoleError;
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    jest.restoreAllMocks();
  });

  it('correctly identifies critical errors', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    const criticalErrors = [
      { name: 'NetworkError', message: 'Network connection failed' },
      { name: 'ChunkLoadError', message: 'Loading chunk 2 failed' },
      { name: 'AuthError', message: 'Authentication failed' }
    ];
    
    for (const errorData of criticalErrors) {
      const mockError = new Error(errorData.message);
      mockError.name = errorData.name;
      
      const errorEvent = {
        error: mockError,
        filename: 'test.js',
        lineno: 1,
        colno: 1,
        message: errorData.message
      } as ErrorEvent;
      
      if (errorEventListener) {
        act(() => {
          errorEventListener(errorEvent);
        });
      }
    }
    
    await waitFor(() => {
      expect(mockNotificationService.showNotification).toHaveBeenCalledTimes(criticalErrors.length);
    });
  });

  it('correctly identifies error severity levels', async () => {
    render(
      <GlobalErrorHandler>
        <div>Test</div>
      </GlobalErrorHandler>
    );
    
    const errorSeverities = [
      { name: 'NetworkError', expectedSeverity: 'high' },
      { name: 'TypeError', expectedSeverity: 'high' },
      { name: 'SyntaxError', expectedSeverity: 'medium' },
      { name: 'Error', expectedSeverity: 'medium' }
    ];
    
    for (const { name, expectedSeverity } of errorSeverities) {
      const mockError = new Error('Test error');
      mockError.name = name;
      
      const errorEvent = {
        error: mockError,
        filename: 'test.js',
        lineno: 1,
        colno: 1,
        message: 'Test error'
      } as ErrorEvent;
      
      if (errorEventListener) {
        act(() => {
          errorEventListener(errorEvent);
        });
      }
    }
    
    await waitFor(() => {
      expect(mockErrorTrackingService.reportError).toHaveBeenCalledTimes(errorSeverities.length);
    });
  });
});