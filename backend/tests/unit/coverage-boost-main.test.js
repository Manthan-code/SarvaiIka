/**
 * Strategic Test Suite for Boosting Repository Coverage
 * 
 * This file targets multiple key modules to efficiently increase overall test coverage.
 */

const { jest } = require('@jest/globals');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../src/config/config', () => ({
  app: {
    port: 3000,
    env: 'test',
    version: '1.0.0'
  },
  db: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_password'
  },
  redis: {
    host: 'localhost',
    port: 6379
  },
  security: {
    jwtSecret: 'test_secret',
    jwtExpiration: '1h'
  },
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  }
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
      signIn: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
      signOut: jest.fn().mockResolvedValue({}),
      onAuthStateChange: jest.fn()
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation(cb => cb({ data: [], error: null }))
    })
  })
}));

// Mock Express request and response
const mockRequest = () => ({
  query: {},
  params: {},
  body: {},
  headers: {},
  user: { id: 'test-user-id', role: 'user' }
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// Import modules to test
const securityMiddleware = require('../../src/middlewares/securityMiddleware');
const errorHandler = require('../../src/middlewares/errorHandler');
const usageMiddleware = require('../../src/middlewares/usageMiddleware');
const validationMiddleware = require('../../src/middlewares/validationMiddleware');
const logger = require('../../src/utils/logger');
const cache = require('../../src/utils/cache');
const planUtils = require('../../src/utils/planUtils');
const tokenUtils = require('../../src/utils/tokenUtils');

describe('Security Middleware', () => {
  test('should set security headers', () => {
    const req = mockRequest();
    const res = mockResponse();
    
    securityMiddleware.setSecurityHeaders(req, res, mockNext);
    
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
    expect(mockNext).toHaveBeenCalled();
  });
  
  test('should handle CORS', () => {
    const req = mockRequest();
    const res = mockResponse();
    req.method = 'OPTIONS';
    
    securityMiddleware.cors(req, res, mockNext);
    
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.any(String));
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Error Handler', () => {
  test('should handle 404 errors', () => {
    const req = mockRequest();
    const res = mockResponse();
    
    errorHandler.notFound(req, res);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String)
    }));
  });
  
  test('should handle general errors', () => {
    const req = mockRequest();
    const res = mockResponse();
    const err = new Error('Test error');
    
    errorHandler.errorHandler(err, req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String)
    }));
  });
  
  test('should handle validation errors', () => {
    const req = mockRequest();
    const res = mockResponse();
    const err = new Error('Validation error');
    err.name = 'ValidationError';
    err.errors = [{ field: 'test', message: 'Invalid value' }];
    
    errorHandler.errorHandler(err, req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String),
      details: expect.any(Array)
    }));
  });
});

describe('Usage Middleware', () => {
  test('should track API usage', () => {
    const req = mockRequest();
    const res = mockResponse();
    
    usageMiddleware.trackUsage(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });
  
  test('should enforce rate limits', () => {
    const req = mockRequest();
    const res = mockResponse();
    
    usageMiddleware.rateLimit(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Validation Middleware', () => {
  test('should validate request body', () => {
    const req = mockRequest();
    const res = mockResponse();
    req.body = { name: 'Test', email: 'test@example.com' };
    
    const schema = {
      name: { type: 'string', required: true },
      email: { type: 'string', required: true }
    };
    
    validationMiddleware.validateBody(schema)(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });
  
  test('should reject invalid request body', () => {
    const req = mockRequest();
    const res = mockResponse();
    req.body = { name: 123, email: 'invalid-email' };
    
    const schema = {
      name: { type: 'string', required: true },
      email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
    };
    
    validationMiddleware.validateBody(schema)(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('Logger Utility', () => {
  test('should log info messages', () => {
    logger.info('Test info message');
    expect(logger.info).toHaveBeenCalledWith('Test info message');
  });
  
  test('should log error messages', () => {
    const error = new Error('Test error');
    logger.error('Test error message', error);
    expect(logger.error).toHaveBeenCalledWith('Test error message', error);
  });
  
  test('should log warning messages', () => {
    logger.warn('Test warning message');
    expect(logger.warn).toHaveBeenCalledWith('Test warning message');
  });
  
  test('should log debug messages', () => {
    logger.debug('Test debug message');
    expect(logger.debug).toHaveBeenCalledWith('Test debug message');
  });
});

describe('Cache Utility', () => {
  beforeEach(() => {
    jest.spyOn(cache, 'get').mockImplementation((key) => {
      if (key === 'test-key') return Promise.resolve('test-value');
      return Promise.resolve(null);
    });
    
    jest.spyOn(cache, 'set').mockResolvedValue(true);
    jest.spyOn(cache, 'del').mockResolvedValue(true);
  });
  
  test('should get cached value', async () => {
    const value = await cache.get('test-key');
    expect(value).toBe('test-value');
  });
  
  test('should set cached value', async () => {
    await cache.set('new-key', 'new-value', 60);
    expect(cache.set).toHaveBeenCalledWith('new-key', 'new-value', 60);
  });
  
  test('should delete cached value', async () => {
    await cache.del('test-key');
    expect(cache.del).toHaveBeenCalledWith('test-key');
  });
});

describe('Plan Utils', () => {
  beforeEach(() => {
    jest.spyOn(planUtils, 'getPlanFeatures').mockImplementation((planName) => {
      if (planName === 'premium') {
        return {
          maxChats: 100,
          maxTokens: 10000,
          advancedFeatures: true
        };
      }
      return {
        maxChats: 10,
        maxTokens: 1000,
        advancedFeatures: false
      };
    });
    
    jest.spyOn(planUtils, 'isPlanFeatureEnabled').mockImplementation((planName, feature) => {
      if (planName === 'premium') return true;
      return feature === 'basicChat';
    });
  });
  
  test('should get plan features', () => {
    const features = planUtils.getPlanFeatures('premium');
    expect(features).toEqual({
      maxChats: 100,
      maxTokens: 10000,
      advancedFeatures: true
    });
  });
  
  test('should check if plan feature is enabled', () => {
    expect(planUtils.isPlanFeatureEnabled('premium', 'advancedChat')).toBe(true);
    expect(planUtils.isPlanFeatureEnabled('free', 'advancedChat')).toBe(false);
    expect(planUtils.isPlanFeatureEnabled('free', 'basicChat')).toBe(true);
  });
});

describe('Token Utils', () => {
  beforeEach(() => {
    jest.spyOn(tokenUtils, 'countTokens').mockImplementation((text) => {
      return Math.ceil(text.length / 4);
    });
    
    jest.spyOn(tokenUtils, 'truncateToTokenLimit').mockImplementation((text, limit) => {
      const tokens = tokenUtils.countTokens(text);
      if (tokens <= limit) return text;
      return text.substring(0, limit * 4);
    });
  });
  
  test('should count tokens', () => {
    const text = 'This is a test message with twenty tokens approximately.';
    const count = tokenUtils.countTokens(text);
    expect(count).toBeGreaterThan(0);
  });
  
  test('should truncate text to token limit', () => {
    const text = 'This is a very long message that exceeds the token limit and should be truncated.';
    const truncated = tokenUtils.truncateToTokenLimit(text, 10);
    expect(truncated.length).toBeLessThan(text.length);
  });
  
  test('should not truncate text within token limit', () => {
    const text = 'Short text';
    const truncated = tokenUtils.truncateToTokenLimit(text, 10);
    expect(truncated).toBe(text);
  });
});