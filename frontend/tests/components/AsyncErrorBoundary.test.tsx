import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AsyncErrorBoundary from '../../src/components/AsyncErrorBoundary';
import { errorTrackingService } from '../../src/services/errorTrackingService';

// Mock error tracking service
jest.mock('../../src/services/errorTrackingService', () => ({
  errorTrackingService: {
    captureError: jest.fn(),
    captureException: jest.fn(),
    reportError: jest.fn()
  }
}));

const mockErrorTrackingService = errorTrackingService as jest.Mocked<typeof errorTrackingService>;

// Component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that throws an async error
const ThrowAsyncError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      Promise.reject(new Error('Async test error'));
    }
  }, [shouldThrow]);
  
  return <div>Async component</div>;
};

describe('AsyncErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <AsyncErrorBoundary>
        <div data-testid="child-component">Child content</div>
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByTestId('child-component')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('catches and displays synchronous errors', () => {
    render(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
  });

  it('tracks errors with error tracking service', () => {
    render(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AsyncErrorBoundary>
    );
    
    expect(mockErrorTrackingService.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        details: expect.stringContaining('Error: Test error'),
        component: 'AsyncErrorBoundary',
        severity: 'high',
        stackTrace: expect.stringContaining('ThrowError')
      })
    );
  });

  it('handles async errors through unhandledrejection event', async () => {
    const originalAddEventListener = window.addEventListener;
    const mockAddEventListener = jest.fn();
    window.addEventListener = mockAddEventListener;
    
    render(
      <AsyncErrorBoundary>
        <ThrowAsyncError shouldThrow={false} />
      </AsyncErrorBoundary>
    );
    
    // Verify that the component sets up the unhandledrejection listener
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    
    window.addEventListener = originalAddEventListener;
  });

  it('provides retry functionality', () => {
    const { rerender } = render(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AsyncErrorBoundary>
    );
    
    // Error should be displayed
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
    
    // Click retry button
    retryButton.click();
    
    // Re-render with no error
    rerender(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('displays custom error message when provided', () => {
    const customMessage = 'Custom error occurred';
    
    render(
      <AsyncErrorBoundary fallback={() => <div>{customMessage}</div>}>
        <ThrowError shouldThrow={true} />
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('resets error state when children change', () => {
    const { rerender } = render(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AsyncErrorBoundary>
    );
    
    // Error should be displayed
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    
    // Re-render with different children
    rerender(
      <AsyncErrorBoundary>
        <div>New content</div>
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByText('New content')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('handles errors in nested components', () => {
    const NestedComponent = () => {
      return (
        <div>
          <span>Nested content</span>
          <ThrowError shouldThrow={true} />
        </div>
      );
    };
    
    render(
      <AsyncErrorBoundary>
        <NestedComponent />
      </AsyncErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('provides error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AsyncErrorBoundary>
    );
    
    // Should show error details in development
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('cleans up event listeners on unmount', () => {
    const originalRemoveEventListener = window.removeEventListener;
    const mockRemoveEventListener = jest.fn();
    window.removeEventListener = mockRemoveEventListener;
    
    const { unmount } = render(
      <AsyncErrorBoundary>
        <div>Content</div>
      </AsyncErrorBoundary>
    );
    
    unmount();
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    
    window.removeEventListener = originalRemoveEventListener;
  });
});