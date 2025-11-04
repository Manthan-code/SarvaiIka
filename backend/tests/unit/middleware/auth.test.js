/**
 * Auth Middleware Unit Tests
 * Comprehensive tests for authentication middleware
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/db/supabase/client', () => {
  const mockClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn()
  };
  return mockClient;
});
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/config', () => ({
  jwt: {
    secret: 'test-secret'
  }
}));

// Import the enhanced mock implementation
require('../../../tests/__mocks__/supabase-enhanced');

const jwt = require('jsonwebtoken');
const supabaseClient = require('../../../src/db/supabase/client');
const logger = require('../../../src/utils/logger');
const authMiddleware = require('../../../src/middleware/auth');

describe('Auth Middleware Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      headers: {},
      user: null
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    // No need to create mockSupabase as it's already mocked at the top
    
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
      supabaseClient.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-secret');
      expect(supabaseClient.from).toHaveBeenCalledWith('users');
      expect(supabaseClient.select).toHaveBeenCalledWith('*');
      expect(supabaseClient.eq).toHaveBeenCalledWith('id', 'user_123');
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing authorization header', async () => {
      mockReq.headers = {};

      await authMiddleware.authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', async () => {
      mockReq.headers.authorization = 'InvalidFormat token';

      await authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token format'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle invalid JWT token', async () => {
      const mockToken = 'invalid.jwt.token';
      mockReq.headers.authorization = `Bearer ${mockToken}`;
      
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Token verification failed:', expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired JWT token', async () => {
      const mockToken = 'expired.jwt.token';
      mockReq.headers.authorization = `Bearer ${mockToken}`;
      
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      await authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token has expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user not found in database', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecodedToken = {
        userId: 'user_nonexistent',
        email: 'test@example.com'
      };

      mockReq.headers.authorization = `Bearer ${mockToken}`;
      
      jwt.verify.mockReturnValue(mockDecodedToken);
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      await authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('User lookup failed:', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database connection errors', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecodedToken = {
        userId: 'user_123',
        email: 'test@example.com'
      };

      mockReq.headers.authorization = `Bearer ${mockToken}`;
      
      jwt.verify.mockReturnValue(mockDecodedToken);
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      await authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Database error during authentication:', expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication service unavailable'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive Bearer token', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com'
      };

      const mockToken = 'valid.jwt.token';
      const mockDecodedToken = {
        userId: 'user_123',
        email: 'test@example.com'
      };

      mockReq.headers.authorization = `bearer ${mockToken}`; // lowercase 'bearer'
      
      jwt.verify.mockReturnValue(mockDecodedToken);
      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      await authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_SECRET);
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow access for user with required role', async () => {
      mockReq.user = {
        id: 'user_123',
        role: 'admin'
      };

      const roleMiddleware = authMiddleware.requireRole('admin');
      await roleMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access for user with higher role', async () => {
      mockReq.user = {
        id: 'user_123',
        role: 'admin'
      };

      const roleMiddleware = authMiddleware.requireRole('user');
      await roleMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user with insufficient role', async () => {
      mockReq.user = {
        id: 'user_123',
        role: 'user'
      };

      const roleMiddleware = authMiddleware.requireRole('admin');
      await roleMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing user object', async () => {
      mockReq.user = null;

      const roleMiddleware = authMiddleware.requireRole('user');
      await roleMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user without role property', async () => {
      mockReq.user = {
        id: 'user_123'
        // Missing role property
      };

      const roleMiddleware = authMiddleware.requireRole('user');
      await roleMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User role not defined'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate user when valid token is provided', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com'
      };

      const mockToken = 'valid.jwt.token';
      const mockDecodedToken = {
        userId: 'user_123',
        email: 'test@example.com'
      };

      mockReq.headers.authorization = `Bearer ${mockToken}`;
      
      jwt.verify.mockReturnValue(mockDecodedToken);
      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      await authMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without authentication when no token is provided', async () => {
      mockReq.headers = {};

      await authMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without authentication when invalid token is provided', async () => {
      const mockToken = 'invalid.jwt.token';
      mockReq.headers.authorization = `Bearer ${mockToken}`;
      
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    it('should validate API key successfully', async () => {
      const mockApiKey = 'ak_test_123456789';
      const mockApiKeyData = {
        id: 'key_123',
        userId: 'user_123',
        isActive: true,
        lastUsed: new Date()
      };

      mockReq.headers['x-api-key'] = mockApiKey;
      
      mockSupabase.single.mockResolvedValue({
        data: mockApiKeyData,
        error: null
      });

      await authMiddleware.validateApiKey(mockReq, mockRes, mockNext);

      expect(mockSupabase.from).toHaveBeenCalledWith('api_keys');
      expect(mockSupabase.eq).toHaveBeenCalledWith('key', mockApiKey);
      expect(mockSupabase.eq).toHaveBeenCalledWith('isActive', true);
      expect(mockReq.apiKey).toEqual(mockApiKeyData);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing API key', async () => {
      mockReq.headers = {};

      await authMiddleware.validateApiKey(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'API key is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle invalid API key', async () => {
      const mockApiKey = 'invalid_api_key';
      mockReq.headers['x-api-key'] = mockApiKey;
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'API key not found' }
      });

      await authMiddleware.validateApiKey(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid API key'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitByUser', () => {
    it('should allow request within rate limit', async () => {
      mockReq.user = {
        id: 'user_123'
      };

      // Mock Redis or rate limiting logic here
      const rateLimitMiddleware = authMiddleware.rateLimitByUser(100, 3600); // 100 requests per hour
      
      await rateLimitMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block request when rate limit exceeded', async () => {
      mockReq.user = {
        id: 'user_123'
      };

      // Mock rate limit exceeded scenario
      const rateLimitMiddleware = authMiddleware.rateLimitByUser(1, 3600); // 1 request per hour
      
      // Simulate multiple calls
      await rateLimitMiddleware(mockReq, mockRes, mockNext);
      await rateLimitMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded'
      });
    });
  });

  describe('checkSubscriptionAccess', () => {
    it('should allow access for active subscription', async () => {
      mockReq.user = {
        id: 'user_123',
        subscriptionStatus: 'active'
      };

      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for inactive subscription', async () => {
      mockReq.user = {
        id: 'user_123',
        subscriptionStatus: 'canceled'
      };

      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Active subscription required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for missing subscription', async () => {
      mockReq.user = {
        id: 'user_123'
        // Missing subscriptionStatus
      };

      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});