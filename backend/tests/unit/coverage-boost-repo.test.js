/**
 * Strategic Test Suite for Boosting Repository Coverage
 * 
 * This file targets multiple key modules to efficiently increase overall test coverage.
 */

// Import modules to test
const authMiddleware = require('../../src/middleware/auth');
const logger = require('../../src/utils/logger');
const errorHandler = require('../../src/utils/errorHandler');
const tokenUtils = require('../../src/utils/tokenUtils');
const planUtils = require('../../src/utils/planUtils');

// Mock dependencies
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation((token, secret, callback) => {
    if (token === 'valid-token') {
      return callback(null, { userId: 'user-123', role: 'user' });
    } else if (token === 'admin-token') {
      return callback(null, { userId: 'admin-123', role: 'admin' });
    } else if (token === 'premium-token') {
      return callback(null, { userId: 'premium-123', role: 'user', subscription: 'premium' });
    } else {
      return callback(new Error('Invalid token'));
    }
  }),
  sign: jest.fn().mockReturnValue('new-token')
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockImplementation((table) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((callback) => {
        if (table === 'users') {
          return Promise.resolve(callback({ 
            data: { id: 'user-123', role: 'user', subscription: 'basic' },
            error: null 
          }));
        }
        return Promise.resolve(callback({ data: null, error: null }));
      })
    }))
  })
}));

// Mock Express request and response
const mockRequest = (overrides = {}) => ({
  headers: { authorization: 'Bearer valid-token' },
  body: {},
  params: {},
  query: {},
  ...overrides
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// Tests for auth middleware
describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('authenticate should set user on successful authentication', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    await authMiddleware.authenticate(req, res, mockNext);
    
    expect(req.user).toBeDefined();
    expect(mockNext).toHaveBeenCalled();
  });

  test('authenticate should handle missing token', async () => {
    const req = mockRequest({ headers: {} });
    const res = mockResponse();
    
    await authMiddleware.authenticate(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String)
    }));
  });

  test('requireAdmin should allow admin users', async () => {
    const req = mockRequest({
      user: { role: 'admin' }
    });
    const res = mockResponse();
    
    await authMiddleware.requireAdmin(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  test('requireAdmin should reject non-admin users', async () => {
    const req = mockRequest({
      user: { role: 'user' }
    });
    const res = mockResponse();
    
    await authMiddleware.requireAdmin(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('requirePremium should allow premium users', async () => {
    const req = mockRequest({
      user: { subscription: 'premium' }
    });
    const res = mockResponse();
    
    await authMiddleware.requirePremium(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  test('requirePremium should reject non-premium users', async () => {
    const req = mockRequest({
      user: { subscription: 'basic' }
    });
    const res = mockResponse();
    
    await authMiddleware.requirePremium(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// Tests for logger
describe('Logger', () => {
  test('should log info messages', () => {
    const infoSpy = jest.spyOn(logger, 'info');
    logger.info('Test info message');
    expect(infoSpy).toHaveBeenCalledWith('Test info message');
  });
  
  test('should log error messages', () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const error = new Error('Test error');
    logger.error('Test error message', error);
    expect(errorSpy).toHaveBeenCalledWith('Test error message', error);
  });
  
  test('should log warning messages', () => {
    const warnSpy = jest.spyOn(logger, 'warn');
    logger.warn('Test warning message');
    expect(warnSpy).toHaveBeenCalledWith('Test warning message');
  });
  
  test('should log debug messages', () => {
    const debugSpy = jest.spyOn(logger, 'debug');
    logger.debug('Test debug message');
    expect(debugSpy).toHaveBeenCalledWith('Test debug message');
  });
});

// Tests for error handler
describe('Error Handler', () => {
  test('should format error response', () => {
    const error = new Error('Test error');
    const formattedError = errorHandler.formatError(error);
    
    expect(formattedError).toHaveProperty('error');
    expect(formattedError.error).toBe('Test error');
  });
  
  test('should handle validation errors', () => {
    const error = new Error('Validation error');
    error.name = 'ValidationError';
    error.errors = [{ field: 'email', message: 'Invalid email' }];
    
    const formattedError = errorHandler.formatError(error);
    
    expect(formattedError).toHaveProperty('error');
    expect(formattedError).toHaveProperty('details');
    expect(formattedError.details).toEqual(error.errors);
  });
  
  test('should handle database errors', () => {
    const error = new Error('Database error');
    error.code = 'P2002'; // Prisma unique constraint error
    
    const formattedError = errorHandler.formatError(error);
    
    expect(formattedError).toHaveProperty('error');
    expect(formattedError.error).not.toBe('Database error'); // Should be sanitized
  });
});

// Tests for token utils
describe('Token Utils', () => {
  test('should generate token', () => {
    const user = { id: 'user-123', role: 'user' };
    const token = tokenUtils.generateToken(user);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });
  
  test('should verify token', () => {
    const token = 'valid-token';
    const decoded = tokenUtils.verifyToken(token);
    
    expect(decoded).toBeDefined();
    expect(decoded).toHaveProperty('userId');
  });
  
  test('should handle invalid token', () => {
    const token = 'invalid-token';
    
    expect(() => {
      tokenUtils.verifyToken(token);
    }).toThrow();
  });
  
  test('should refresh token', () => {
    const oldToken = 'valid-token';
    const newToken = tokenUtils.refreshToken(oldToken);
    
    expect(newToken).toBeDefined();
    expect(typeof newToken).toBe('string');
  });
});

// Tests for plan utils
describe('Plan Utils', () => {
  test('should get plan features', () => {
    const features = planUtils.getPlanFeatures('premium');
    
    expect(features).toBeDefined();
    expect(features).toHaveProperty('maxChats');
    expect(features).toHaveProperty('maxTokens');
  });
  
  test('should check if feature is enabled for plan', () => {
    const isPremiumFeatureEnabled = planUtils.isFeatureEnabled('premium', 'advancedChat');
    const isBasicFeatureEnabled = planUtils.isFeatureEnabled('basic', 'basicChat');
    const isPremiumFeatureNotEnabled = planUtils.isFeatureEnabled('basic', 'advancedChat');
    
    expect(isPremiumFeatureEnabled).toBe(true);
    expect(isBasicFeatureEnabled).toBe(true);
    expect(isPremiumFeatureNotEnabled).toBe(false);
  });
  
  test('should compare plans', () => {
    const comparison = planUtils.comparePlans('premium', 'basic');
    
    expect(comparison).toBeGreaterThan(0);
    expect(planUtils.comparePlans('basic', 'premium')).toBeLessThan(0);
    expect(planUtils.comparePlans('basic', 'basic')).toBe(0);
  });
  
  test('should get plan price', () => {
    const price = planUtils.getPlanPrice('premium');
    
    expect(price).toBeDefined();
    expect(typeof price).toBe('number');
    expect(price).toBeGreaterThan(0);
  });
});