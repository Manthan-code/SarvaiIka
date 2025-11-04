/**
 * Coverage Boost Test Suite
 * This file contains tests specifically designed to increase test coverage
 * across multiple modules in the codebase.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/db/supabase/client');
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config', () => ({
  jwt: { secret: 'test-secret' },
  app: { env: 'test' },
  supabase: { url: 'https://test.supabase.co', key: 'test-key' }
}));

// Import modules to test
const authMiddleware = require('../../src/middleware/auth');
const validationMiddleware = require('../../src/middleware/validationMiddleware');
const errorHandler = require('../../src/middleware/errorHandler');
const logger = require('../../src/utils/logger');
const jwt = require('jsonwebtoken');
const supabaseClient = require('../../src/db/supabase/client');

describe('Coverage Boost Tests', () => {
  // Common test setup
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      headers: {},
      body: {},
      params: {},
      query: {},
      user: null
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.debug = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Auth Middleware Tests
  describe('Auth Middleware', () => {
    describe('authenticate', () => {
      it('should authenticate valid JWT token successfully', async () => {
        const mockUser = {
          id: 'user_123',
          email: 'test@example.com',
          role: 'user'
        };

        const mockToken = 'valid.jwt.token';
        const mockDecodedToken = {
          userId: 'user_123',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        };

        mockReq.headers.authorization = `Bearer ${mockToken}`;
        
        jwt.verify.mockReturnValue(mockDecodedToken);
        supabaseClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        await authMiddleware.authenticate(mockReq, mockRes, mockNext);

        expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-secret');
        expect(supabaseClient.from).toHaveBeenCalledWith('users');
        expect(mockReq.user).toEqual(mockUser);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle missing authorization header', async () => {
        await authMiddleware.authenticate(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle invalid token format', async () => {
        mockReq.headers.authorization = 'InvalidFormat';
        
        await authMiddleware.authenticate(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle JWT verification errors', async () => {
        mockReq.headers.authorization = 'Bearer invalid.token';
        
        jwt.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });
        
        await authMiddleware.authenticate(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle token expiration', async () => {
        mockReq.headers.authorization = 'Bearer expired.token';
        
        jwt.verify.mockImplementation(() => {
          const error = new Error('Token expired');
          error.name = 'TokenExpiredError';
          throw error;
        });
        
        await authMiddleware.authenticate(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
        const mockToken = 'valid.jwt.token';
        const mockDecodedToken = {
          userId: 'user_123',
          email: 'test@example.com'
        };

        mockReq.headers.authorization = `Bearer ${mockToken}`;
        
        jwt.verify.mockReturnValue(mockDecodedToken);
        supabaseClient.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          })
        });
        
        await authMiddleware.authenticate(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('requireAdmin', () => {
      it('should allow admin users', () => {
        mockReq.user = { role: 'admin' };
        
        authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject non-admin users', () => {
        mockReq.user = { role: 'user' };
        
        authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject unauthenticated requests', () => {
        mockReq.user = null;
        
        authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('requirePremium', () => {
      it('should allow premium users', () => {
        mockReq.user = { subscription: 'premium' };
        
        authMiddleware.requirePremium(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject non-premium users', () => {
        mockReq.user = { subscription: 'free' };
        
        authMiddleware.requirePremium(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Premium subscription required' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject users without subscription', () => {
        mockReq.user = { subscription: null };
        
        authMiddleware.requirePremium(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Premium subscription required' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject unauthenticated requests', () => {
        mockReq.user = null;
        
        authMiddleware.requirePremium(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Premium subscription required' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('checkSubscriptionAccess', () => {
      it('should allow users with active subscription', async () => {
        mockReq.user = { subscriptionStatus: 'active' };
        
        await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject users with inactive subscription', async () => {
        mockReq.user = { subscriptionStatus: 'inactive' };
        
        await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ 
          success: false,
          error: 'Active subscription required' 
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject users without subscription status', async () => {
        mockReq.user = { subscriptionStatus: null };
        
        await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ 
          success: false,
          error: 'Subscription required' 
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject unauthenticated requests', async () => {
        mockReq.user = null;
        
        await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('checkApiAccess', () => {
      it('should allow users with API access', async () => {
        mockReq.user = { api_access: true };
        
        await authMiddleware.checkApiAccess(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject users without API access', async () => {
        mockReq.user = { api_access: false };
        
        await authMiddleware.checkApiAccess(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'API access required' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject unauthenticated requests', async () => {
        mockReq.user = null;
        
        await authMiddleware.checkApiAccess(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('checkPermissions', () => {
      it('should allow users with all required permissions', () => {
        mockReq.user = { permissions: ['read', 'write', 'delete'] };
        const middleware = authMiddleware.checkPermissions(['read', 'write']);
        
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject users missing some required permissions', () => {
        mockReq.user = { permissions: ['read'] };
        const middleware = authMiddleware.checkPermissions(['read', 'write']);
        
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle users with no permissions array', () => {
        mockReq.user = {};
        const middleware = authMiddleware.checkPermissions(['read']);
        
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject unauthenticated requests', () => {
        mockReq.user = null;
        const middleware = authMiddleware.checkPermissions(['read']);
        
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('rateLimitByUser', () => {
      it('should allow requests within rate limit', () => {
        mockReq.user = { id: 'user_123' };
        const middleware = authMiddleware.rateLimitByUser(5, 60);
        
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject requests exceeding rate limit', () => {
        mockReq.user = { id: 'user_456' };
        const middleware = authMiddleware.rateLimitByUser(2, 60);
        
        // First request - allowed
        middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        
        // Second request - allowed
        middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(2);
        
        // Reset mockNext to check it's not called again
        mockNext.mockClear();
        
        // Third request - should be rate limited
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Rate limit exceeded'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject unauthenticated requests', () => {
        mockReq.user = null;
        const middleware = authMiddleware.rateLimitByUser(5, 60);
        
        middleware(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Authentication required'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reset rate limit after window expires', () => {
        jest.useFakeTimers();
        
        mockReq.user = { id: 'user_789' };
        const middleware = authMiddleware.rateLimitByUser(1, 1); // 1 request per 1 second
        
        // First request - allowed
        middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        
        // Reset mockNext to check it's not called again
        mockNext.mockClear();
        
        // Second request - should be rate limited
        middleware(mockReq, mockRes, mockNext);
        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(429);
        
        // Reset status and json mocks
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        
        // Advance time by 1 second
        jest.advanceTimersByTime(1000);
        
        // Third request after window - should be allowed again
        middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        
        jest.useRealTimers();
      });
    });
  });

  // Error Handler Tests
  describe('Error Handler', () => {
    it('should handle validation errors', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      validationError.errors = [{ field: 'email', message: 'Invalid email' }];
      
      errorHandler(validationError, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: validationError.errors
      });
    });

    it('should handle authentication errors', () => {
      const authError = new Error('Authentication failed');
      authError.name = 'AuthenticationError';
      
      errorHandler(authError, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed'
      });
    });

    it('should handle authorization errors', () => {
      const authzError = new Error('Access denied');
      authzError.name = 'AuthorizationError';
      
      errorHandler(authzError, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied'
      });
    });

    it('should handle not found errors', () => {
      const notFoundError = new Error('Resource not found');
      notFoundError.name = 'NotFoundError';
      
      errorHandler(notFoundError, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Resource not found'
      });
    });

    it('should handle database errors', () => {
      const dbError = new Error('Database error');
      dbError.name = 'DatabaseError';
      
      errorHandler(dbError, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      
      errorHandler(genericError, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Validation Middleware Tests
  describe('Validation Middleware', () => {
    it('should validate request body successfully', () => {
      const schema = {
        body: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      };
      
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const middleware = validationMiddleware.validateRequest(schema);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid request body', () => {
      const schema = {
        body: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      };
      
      mockReq.body = {
        email: 'invalid-email',
        password: 'short'
      };
      
      const middleware = validationMiddleware.validateRequest(schema);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array)
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate request params successfully', () => {
      const schema = {
        params: {
          id: { type: 'string', pattern: '^[0-9a-f]{24}$' }
        }
      };
      
      mockReq.params = {
        id: '507f1f77bcf86cd799439011'
      };
      
      const middleware = validationMiddleware.validateRequest(schema);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid request params', () => {
      const schema = {
        params: {
          id: { type: 'string', pattern: '^[0-9a-f]{24}$' }
        }
      };
      
      mockReq.params = {
        id: 'invalid-id'
      };
      
      const middleware = validationMiddleware.validateRequest(schema);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array)
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate request query successfully', () => {
      const schema = {
        query: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          page: { type: 'integer', minimum: 1 }
        }
      };
      
      mockReq.query = {
        limit: '50',
        page: '2'
      };
      
      const middleware = validationMiddleware.validateRequest(schema);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid request query', () => {
      const schema = {
        query: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          page: { type: 'integer', minimum: 1 }
        }
      };
      
      mockReq.query = {
        limit: '500',
        page: '0'
      };
      
      const middleware = validationMiddleware.validateRequest(schema);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array)
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});