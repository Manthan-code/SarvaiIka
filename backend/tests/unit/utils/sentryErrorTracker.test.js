/**
 * Sentry Error Tracker Unit Tests
 * Tests Sentry integration for error tracking, context setting, and breadcrumbs
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock Sentry before importing sentryErrorTracker
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  setLevel: jest.fn(),
  withScope: jest.fn((callback) => {
    const scope = {
      setUser: jest.fn(),
      setTag: jest.fn(),
      setContext: jest.fn(),
      setLevel: jest.fn(),
      addBreadcrumb: jest.fn()
    };
    callback(scope);
    return scope;
  }),
  Severity: {
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
    Debug: 'debug'
  }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const Sentry = require('@sentry/node');
const logger = require('../../../src/utils/logger');

describe('SentryErrorTracker', () => {
  let sentryErrorTracker;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    
    // Clear require cache to get fresh instance
    delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize Sentry in production with DSN', () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: 'https://test@sentry.io/123',
        environment: 'production',
        tracesSampleRate: 0.1,
        integrations: expect.any(Array)
      });
    });

    it('should not initialize Sentry in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should not initialize Sentry without DSN', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SENTRY_DSN;
      
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should not initialize Sentry in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should use staging environment configuration', () => {
      process.env.NODE_ENV = 'staging';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: 'https://test@sentry.io/123',
        environment: 'staging',
        tracesSampleRate: 0.1,
        integrations: expect.any(Array)
      });
    });
  });

  describe('Error Tracking', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');
    });

    describe('captureError', () => {
      it('should capture error with basic information', () => {
        const error = new Error('Test error');
        
        sentryErrorTracker.captureError(error);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
      });

      it('should capture error with context', () => {
        const error = new Error('Test error');
        const context = { userId: '123', action: 'test' };
        
        sentryErrorTracker.captureError(error, context);

        expect(Sentry.withScope).toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
      });

      it('should capture error with user context', () => {
        const error = new Error('Test error');
        const context = { 
          user: { id: '123', email: 'test@example.com' },
          extra: { action: 'test' }
        };
        
        sentryErrorTracker.captureError(error, context);

        expect(Sentry.withScope).toHaveBeenCalled();
        const scopeCallback = Sentry.withScope.mock.calls[0][0];
        const mockScope = { setUser: jest.fn(), setContext: jest.fn() };
        scopeCallback(mockScope);

        expect(mockScope.setUser).toHaveBeenCalledWith({ id: '123', email: 'test@example.com' });
        expect(mockScope.setContext).toHaveBeenCalledWith('extra', { action: 'test' });
      });

      it('should capture error with tags', () => {
        const error = new Error('Test error');
        const context = { 
          tags: { component: 'auth', version: '1.0.0' }
        };
        
        sentryErrorTracker.captureError(error, context);

        expect(Sentry.withScope).toHaveBeenCalled();
        const scopeCallback = Sentry.withScope.mock.calls[0][0];
        const mockScope = { setTag: jest.fn() };
        scopeCallback(mockScope);

        expect(mockScope.setTag).toHaveBeenCalledWith('component', 'auth');
        expect(mockScope.setTag).toHaveBeenCalledWith('version', '1.0.0');
      });

      it('should capture error with level', () => {
        const error = new Error('Test error');
        const context = { level: 'warning' };
        
        sentryErrorTracker.captureError(error, context);

        expect(Sentry.withScope).toHaveBeenCalled();
        const scopeCallback = Sentry.withScope.mock.calls[0][0];
        const mockScope = { setLevel: jest.fn() };
        scopeCallback(mockScope);

        expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
      });

      it('should handle string errors', () => {
        sentryErrorTracker.captureError('String error');

        expect(Sentry.captureException).toHaveBeenCalledWith(new Error('String error'));
      });

      it('should handle null/undefined errors', () => {
        sentryErrorTracker.captureError(null);
        expect(Sentry.captureException).toHaveBeenCalledWith(new Error('Unknown error'));

        sentryErrorTracker.captureError(undefined);
        expect(Sentry.captureException).toHaveBeenCalledWith(new Error('Unknown error'));
      });

      it('should not capture errors in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        const error = new Error('Test error');
        sentryErrorTracker.captureError(error);

        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith('Error (Sentry disabled):', error);
      });
    });

    describe('captureMessage', () => {
      it('should capture message with default level', () => {
        sentryErrorTracker.captureMessage('Test message');

        expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
      });

      it('should capture message with custom level', () => {
        sentryErrorTracker.captureMessage('Warning message', 'warning');

        expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
      });

      it('should capture message with context', () => {
        const context = { userId: '123', action: 'test' };
        
        sentryErrorTracker.captureMessage('Test message', 'info', context);

        expect(Sentry.withScope).toHaveBeenCalled();
        expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
      });

      it('should not capture messages in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        sentryErrorTracker.captureMessage('Test message');

        expect(Sentry.captureMessage).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Message (Sentry disabled):', 'Test message');
      });
    });
  });

  describe('Context Management', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');
    });

    describe('setUser', () => {
      it('should set user context', () => {
        const user = { id: '123', email: 'test@example.com', username: 'testuser' };
        
        sentryErrorTracker.setUser(user);

        expect(Sentry.setUser).toHaveBeenCalledWith(user);
      });

      it('should handle partial user data', () => {
        const user = { id: '123' };
        
        sentryErrorTracker.setUser(user);

        expect(Sentry.setUser).toHaveBeenCalledWith(user);
      });

      it('should clear user context with null', () => {
        sentryErrorTracker.setUser(null);

        expect(Sentry.setUser).toHaveBeenCalledWith(null);
      });

      it('should not set user in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        const user = { id: '123' };
        sentryErrorTracker.setUser(user);

        expect(Sentry.setUser).not.toHaveBeenCalled();
      });
    });

    describe('setTag', () => {
      it('should set single tag', () => {
        sentryErrorTracker.setTag('component', 'auth');

        expect(Sentry.setTag).toHaveBeenCalledWith('component', 'auth');
      });

      it('should set multiple tags', () => {
        const tags = { component: 'auth', version: '1.0.0', feature: 'login' };
        
        sentryErrorTracker.setTag(tags);

        expect(Sentry.setTag).toHaveBeenCalledWith('component', 'auth');
        expect(Sentry.setTag).toHaveBeenCalledWith('version', '1.0.0');
        expect(Sentry.setTag).toHaveBeenCalledWith('feature', 'login');
      });

      it('should handle string values', () => {
        sentryErrorTracker.setTag('status', 'active');

        expect(Sentry.setTag).toHaveBeenCalledWith('status', 'active');
      });

      it('should handle number values', () => {
        sentryErrorTracker.setTag('count', 42);

        expect(Sentry.setTag).toHaveBeenCalledWith('count', '42');
      });

      it('should handle boolean values', () => {
        sentryErrorTracker.setTag('enabled', true);

        expect(Sentry.setTag).toHaveBeenCalledWith('enabled', 'true');
      });

      it('should not set tags in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        sentryErrorTracker.setTag('component', 'auth');

        expect(Sentry.setTag).not.toHaveBeenCalled();
      });
    });

    describe('setContext', () => {
      it('should set context with key and data', () => {
        const contextData = { action: 'login', timestamp: Date.now() };
        
        sentryErrorTracker.setContext('user_action', contextData);

        expect(Sentry.setContext).toHaveBeenCalledWith('user_action', contextData);
      });

      it('should handle complex context data', () => {
        const contextData = {
          request: {
            method: 'POST',
            url: '/api/auth/login',
            headers: { 'user-agent': 'test' }
          },
          response: {
            status: 200,
            duration: 150
          }
        };
        
        sentryErrorTracker.setContext('http_request', contextData);

        expect(Sentry.setContext).toHaveBeenCalledWith('http_request', contextData);
      });

      it('should not set context in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        const contextData = { action: 'test' };
        sentryErrorTracker.setContext('test', contextData);

        expect(Sentry.setContext).not.toHaveBeenCalled();
      });
    });
  });

  describe('Breadcrumbs', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');
    });

    describe('addBreadcrumb', () => {
      it('should add breadcrumb with message and category', () => {
        sentryErrorTracker.addBreadcrumb('User logged in', 'auth');

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'User logged in',
          category: 'auth',
          level: 'info'
        });
      });

      it('should add breadcrumb with custom level', () => {
        sentryErrorTracker.addBreadcrumb('Database error', 'database', 'error');

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'Database error',
          category: 'database',
          level: 'error'
        });
      });

      it('should add breadcrumb with data', () => {
        const data = { userId: '123', action: 'login' };
        
        sentryErrorTracker.addBreadcrumb('User action', 'user', 'info', data);

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'User action',
          category: 'user',
          level: 'info',
          data
        });
      });

      it('should use default category if not provided', () => {
        sentryErrorTracker.addBreadcrumb('General message');

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'General message',
          category: 'default',
          level: 'info'
        });
      });

      it('should not add breadcrumbs in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        sentryErrorTracker.addBreadcrumb('Test message', 'test');

        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });
    });

    describe('addHttpBreadcrumb', () => {
      it('should add HTTP request breadcrumb', () => {
        const req = {
          method: 'POST',
          url: '/api/auth/login',
          ip: '127.0.0.1'
        };
        
        sentryErrorTracker.addHttpBreadcrumb(req);

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'HTTP Request',
          category: 'http',
          level: 'info',
          data: {
            method: 'POST',
            url: '/api/auth/login',
            ip: '127.0.0.1'
          }
        });
      });

      it('should add HTTP response breadcrumb', () => {
        const req = { method: 'GET', url: '/api/users' };
        const res = { statusCode: 200 };
        const responseTime = 150;
        
        sentryErrorTracker.addHttpBreadcrumb(req, res, responseTime);

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'HTTP Response',
          category: 'http',
          level: 'info',
          data: {
            method: 'GET',
            url: '/api/users',
            statusCode: 200,
            responseTime: 150
          }
        });
      });

      it('should handle missing request properties', () => {
        const req = { method: 'GET' };
        
        sentryErrorTracker.addHttpBreadcrumb(req);

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'HTTP Request',
          category: 'http',
          level: 'info',
          data: {
            method: 'GET',
            url: undefined,
            ip: undefined
          }
        });
      });
    });

    describe('addDatabaseBreadcrumb', () => {
      it('should add database operation breadcrumb', () => {
        const operation = {
          query: 'SELECT * FROM users WHERE id = $1',
          duration: 45,
          rows: 1
        };
        
        sentryErrorTracker.addDatabaseBreadcrumb('Database query', operation);

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'Database query',
          category: 'database',
          level: 'info',
          data: operation
        });
      });

      it('should add database error breadcrumb', () => {
        const operation = {
          query: 'INSERT INTO users (email) VALUES ($1)',
          error: 'duplicate key value violates unique constraint'
        };
        
        sentryErrorTracker.addDatabaseBreadcrumb('Database error', operation, 'error');

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'Database error',
          category: 'database',
          level: 'error',
          data: operation
        });
      });
    });

    describe('addExternalApiBreadcrumb', () => {
      it('should add external API call breadcrumb', () => {
        const apiCall = {
          service: 'openai',
          endpoint: '/chat/completions',
          method: 'POST',
          statusCode: 200,
          duration: 1200
        };
        
        sentryErrorTracker.addExternalApiBreadcrumb('OpenAI API call', apiCall);

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'OpenAI API call',
          category: 'external_api',
          level: 'info',
          data: apiCall
        });
      });

      it('should add external API error breadcrumb', () => {
        const apiCall = {
          service: 'stripe',
          endpoint: '/charges',
          method: 'POST',
          statusCode: 400,
          error: 'Invalid card number'
        };
        
        sentryErrorTracker.addExternalApiBreadcrumb('Stripe API error', apiCall, 'error');

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'Stripe API error',
          category: 'external_api',
          level: 'error',
          data: apiCall
        });
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');
    });

    describe('isEnabled', () => {
      it('should return true in production with DSN', () => {
        expect(sentryErrorTracker.isEnabled()).toBe(true);
      });

      it('should return false in development', () => {
        process.env.NODE_ENV = 'development';
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        expect(sentryErrorTracker.isEnabled()).toBe(false);
      });

      it('should return false without DSN', () => {
        delete process.env.SENTRY_DSN;
        delete require.cache[require.resolve('../../../src/utils/sentryErrorTracker')];
        sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');

        expect(sentryErrorTracker.isEnabled()).toBe(false);
      });
    });

    describe('withErrorTracking', () => {
      it('should execute function and return result', async () => {
        const testFunction = jest.fn().mockResolvedValue('success');
        
        const result = await sentryErrorTracker.withErrorTracking(testFunction, 'Test operation');

        expect(testFunction).toHaveBeenCalled();
        expect(result).toBe('success');
      });

      it('should capture errors and re-throw', async () => {
        const error = new Error('Test error');
        const testFunction = jest.fn().mockRejectedValue(error);
        
        await expect(
          sentryErrorTracker.withErrorTracking(testFunction, 'Test operation')
        ).rejects.toThrow('Test error');

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
      });

      it('should add breadcrumb for operation', async () => {
        const testFunction = jest.fn().mockResolvedValue('success');
        
        await sentryErrorTracker.withErrorTracking(testFunction, 'Test operation');

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
          message: 'Test operation started',
          category: 'operation',
          level: 'info'
        });
      });

      it('should work with sync functions', () => {
        const testFunction = jest.fn().mockReturnValue('sync result');
        
        const result = sentryErrorTracker.withErrorTracking(testFunction, 'Sync operation');

        expect(result).toBe('sync result');
      });

      it('should handle sync function errors', () => {
        const error = new Error('Sync error');
        const testFunction = jest.fn().mockImplementation(() => {
          throw error;
        });
        
        expect(() => {
          sentryErrorTracker.withErrorTracking(testFunction, 'Sync operation');
        }).toThrow('Sync error');

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      sentryErrorTracker = require('../../../src/utils/sentryErrorTracker');
    });

    it('should handle circular references in context', () => {
      const context = { user: { id: '123' } };
      context.self = context; // Circular reference

      expect(() => {
        sentryErrorTracker.captureError(new Error('Test'), context);
      }).not.toThrow();
    });

    it('should handle very large context objects', () => {
      const largeContext = {
        data: new Array(10000).fill('large data string')
      };

      expect(() => {
        sentryErrorTracker.captureError(new Error('Test'), largeContext);
      }).not.toThrow();
    });

    it('should handle invalid tag values', () => {
      expect(() => {
        sentryErrorTracker.setTag('test', undefined);
      }).not.toThrow();

      expect(() => {
        sentryErrorTracker.setTag('test', null);
      }).not.toThrow();
    });

    it('should handle empty breadcrumb messages', () => {
      expect(() => {
        sentryErrorTracker.addBreadcrumb('');
      }).not.toThrow();

      expect(() => {
        sentryErrorTracker.addBreadcrumb(null);
      }).not.toThrow();
    });
  });
});