// Mock import.meta.env before importing errorHandler
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        DEV: true,
        PROD: false,
        MODE: 'test'
      }
    }
  }
});

import {
  handleError,
  normalizeError,
  createAppError,
  ErrorType,
  type AppError,
  type ErrorHandlerOptions
} from '../../src/utils/errorHandler';
import { notificationService } from '../../src/services/notificationService';
import { errorTrackingService } from '../../src/services/errorTrackingService';

// Mock services
jest.mock('../../src/services/notificationService', () => ({
  notificationService: {
    showNotification: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    updateConfig: jest.fn(),
    getConfig: jest.fn().mockReturnValue({}),
    testNotification: jest.fn(),
    clearQueue: jest.fn(),
    getQueueStatus: jest.fn().mockReturnValue({ pending: 0, failed: 0 }),
    getMetrics: jest.fn().mockReturnValue({})
  }
}));

jest.mock('../../src/services/errorTrackingService', () => ({
  errorTrackingService: {
    setUserId: jest.fn(),
    reportError: jest.fn().mockResolvedValue({
      success: true,
      errorId: 'mock-error-id'
    }),
    addUserFeedback: jest.fn(),
    markErrorAsResolved: jest.fn(),
    getErrorMetrics: jest.fn().mockReturnValue({
      totalErrors: 0,
      criticalErrors: 0,
      highErrors: 0,
      mediumErrors: 0,
      lowErrors: 0,
      errorsByComponent: {},
      errorsByStatusCode: {},
      dailyErrorCounts: []
    }),
    getAllErrors: jest.fn().mockReturnValue([]),
    clearErrors: jest.fn(),
    exportErrors: jest.fn().mockReturnValue('[]'),
    destroy: jest.fn(),
    captureError: jest.fn()
  }
}));

const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;
const mockErrorTrackingService = errorTrackingService as jest.Mocked<typeof errorTrackingService>;

describe('errorHandler utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('normalizeError', () => {
    it('normalizes Error objects correctly', () => {
      const error = new Error('Test error message');
      const normalized = normalizeError(error);

      expect(normalized).toEqual({
        message: 'Test error message',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
        timestamp: expect.any(String)
      });
    });

    it('normalizes network errors correctly', () => {
      const error = new Error('Failed to fetch');
      error.name = 'NetworkError';
      const normalized = normalizeError(error);

      expect(normalized).toEqual({
        message: 'Failed to fetch',
        code: 'NETWORK_ERROR',
        statusCode: 0,
        timestamp: expect.any(String)
      });
    });

    it('normalizes HTTP response errors correctly', () => {
      const error = {
        response: {
          status: 404,
          data: {
            message: 'Resource not found',
            code: 'NOT_FOUND'
          }
        }
      };
      const normalized = normalizeError(error);

      expect(normalized).toEqual({
        message: 'Resource not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        details: { message: 'Resource not found', code: 'NOT_FOUND' },
        timestamp: expect.any(String)
      });
    });

    it('normalizes validation errors correctly', () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Validation failed',
            errors: [
              { field: 'email', message: 'Invalid email format' },
              { field: 'password', message: 'Password too short' }
            ]
          }
        }
      };
      const normalized = normalizeError(error);

      expect(normalized.code).toBe('VALIDATION_ERROR');
      expect(normalized.statusCode).toBe(400);
      expect(normalized.details).toEqual({
        message: 'Validation failed',
        errors: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' }
        ]
      });
    });

    it('normalizes authentication errors correctly', () => {
      const error = {
        response: {
          status: 401,
          data: {
            message: 'Invalid credentials'
          }
        }
      };
      const normalized = normalizeError(error);

      expect(normalized.code).toBe('AUTH_ERROR');
      expect(normalized.statusCode).toBe(401);
    });

    it('normalizes authorization errors correctly', () => {
      const error = {
        response: {
          status: 403,
          data: {
            message: 'Access denied'
          }
        }
      };
      const normalized = normalizeError(error);

      expect(normalized.code).toBe('AUTHORIZATION_ERROR');
      expect(normalized.statusCode).toBe(403);
    });

    it('handles string errors', () => {
      const normalized = normalizeError('String error message');

      expect(normalized).toEqual({
        message: 'String error message',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
        timestamp: expect.any(String)
      });
    });

    it('handles null/undefined errors', () => {
      const normalizedNull = normalizeError(null);
      const normalizedUndefined = normalizeError(undefined);

      expect(normalizedNull.message).toBe('An unknown error occurred');
      expect(normalizedUndefined.message).toBe('An unknown error occurred');
    });

    it('handles errors with custom context', () => {
      const error = new Error('Test error');
      const normalized = normalizeError(error, 'user-profile');

      expect(normalized.context).toBe('user-profile');
    });
  });

  describe('createAppError', () => {
    it('creates AppError with all properties', () => {
      const appError = createAppError(
        'Custom error message',
        'CUSTOM_ERROR',
        422,
        { field: 'email' },
        'form-validation'
      );

      expect(appError).toEqual({
        message: 'Custom error message',
        code: 'CUSTOM_ERROR',
        statusCode: 422,
        details: { field: 'email' },
        context: 'form-validation',
        timestamp: expect.any(String)
      });
    });

    it('creates AppError with minimal properties', () => {
      const appError = createAppError('Simple error');

      expect(appError).toEqual({
        message: 'Simple error',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
        timestamp: expect.any(String)
      });
    });
  });

  describe('handleError', () => {
    it('handles error with default options', async () => {
      const error = new Error('Test error');
      const result = await handleError(error);

      expect(result).toEqual({
        message: 'Test error',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
        timestamp: expect.any(String)
      });

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error',
        message: 'Test error',
        duration: 5000
      });

      expect(mockErrorTrackingService.reportError).toHaveBeenCalled();
    });

    it('handles error with custom options', async () => {
      const error = new Error('Custom error');
      const options: ErrorHandlerOptions = {
        showNotification: false,
        logToConsole: false,
        reportToService: false,
        fallbackMessage: 'Something went wrong',
        context: 'custom-context'
      };

      const result = await handleError(error, options);

      expect(result.context).toBe('custom-context');
      expect(mockNotificationService.showNotification).not.toHaveBeenCalled();
      expect(mockErrorTrackingService.reportError).not.toHaveBeenCalled();
    });

    it('uses fallback message for network errors', async () => {
      const error = new Error('Failed to fetch');
      error.name = 'NetworkError';
      const options: ErrorHandlerOptions = {
        fallbackMessage: 'Connection problem'
      };

      await handleError(error, options);

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Connection problem'
        })
      );
    });

    it('logs to console when enabled', async () => {
      const error = new Error('Console test error');
      const options: ErrorHandlerOptions = {
        logToConsole: true
      };

      await handleError(error, options);

      expect(console.error).toHaveBeenCalledWith(
        'Error handled:',
        expect.objectContaining({
          message: 'Console test error'
        })
      );
    });

    it('handles validation errors with detailed messages', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Validation failed',
            errors: [
              { field: 'email', message: 'Invalid email' },
              { field: 'password', message: 'Too short' }
            ]
          }
        }
      };

      await handleError(error);

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failed: Invalid email, Too short'
        })
      );
    });

    it('handles authentication errors with redirect suggestion', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            message: 'Token expired'
          }
        }
      };

      await handleError(error);

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Authentication Error',
          message: 'Token expired. Please log in again.'
        })
      );
    });

    it('handles server errors with generic message', async () => {
      const error = {
        response: {
          status: 500,
          data: {
            message: 'Internal server error'
          }
        }
      };

      await handleError(error);

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Server Error',
          message: 'Something went wrong on our end. Please try again later.'
        })
      );
    });
  });

  describe('ErrorType enum', () => {
    it('contains all expected error types', () => {
      expect(ErrorType.NETWORK).toBe('NETWORK_ERROR');
      expect(ErrorType.AUTHENTICATION).toBe('AUTH_ERROR');
      expect(ErrorType.AUTHORIZATION).toBe('AUTHORIZATION_ERROR');
      expect(ErrorType.VALIDATION).toBe('VALIDATION_ERROR');
      expect(ErrorType.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorType.SERVER).toBe('SERVER_ERROR');
      expect(ErrorType.CLIENT).toBe('CLIENT_ERROR');
      expect(ErrorType.UNKNOWN).toBe('UNKNOWN_ERROR');
    });
  });

  describe('error severity classification', () => {
    it('classifies network errors as high severity', async () => {
      const error = new Error('Network timeout');
      error.name = 'NetworkError';

      await handleError(error);

      expect(mockErrorTrackingService.reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'high'
        })
      );
    });

    it('classifies validation errors as low severity', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Invalid input'
          }
        }
      };

      await handleError(error);

      expect(mockErrorTrackingService.reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'low'
        })
      );
    });

    it('classifies server errors as critical severity', async () => {
      const error = {
        response: {
          status: 500,
          data: {
            message: 'Database connection failed'
          }
        }
      };

      await handleError(error);

      expect(mockErrorTrackingService.reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical'
        })
      );
    });
  });

  describe('error context handling', () => {
    it('preserves error context through normalization', async () => {
      const error = new Error('Context test');
      const options: ErrorHandlerOptions = {
        context: 'user-authentication'
      };

      const result = await handleError(error, options);

      expect(result.context).toBe('user-authentication');
      expect(mockErrorTrackingService.reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'user-authentication'
        })
      );
    });

    it('handles multiple error contexts', async () => {
      const errors = [
        { error: new Error('Form error'), context: 'form-validation' },
        { error: new Error('API error'), context: 'api-call' },
        { error: new Error('Auth error'), context: 'authentication' }
      ];

      for (const { error, context } of errors) {
        await handleError(error, { context });
      }

      expect(mockErrorTrackingService.reportError).toHaveBeenCalledTimes(3);
      expect(mockErrorTrackingService.reportError).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ component: 'form-validation' })
      );
      expect(mockErrorTrackingService.reportError).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ component: 'api-call' })
      );
      expect(mockErrorTrackingService.reportError).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ component: 'authentication' })
      );
    });
  });
});