/**
 * Auth Middleware Coverage Tests
 * Focused tests to achieve 80% coverage on auth.js
 */

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../src/middleware/auth');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/db/supabase/client', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: { id: 'user-123', role: 'user' },
    error: null
  })
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
jest.mock('../../src/config/config', () => ({
  jwt: { secret: 'test-secret' }
}));

describe('Auth Middleware Coverage Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      headers: {},
      user: null
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    test('should authenticate valid JWT token', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user-123' });
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });
    
    test('should reject missing token', async () => {
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    });
    
    test('should reject invalid token format', async () => {
      mockReq.headers.authorization = 'InvalidFormat';
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
    
    test('should handle JWT verification errors', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => { throw new Error('Invalid token'); });
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
    
    test('should handle token expiration', async () => {
      mockReq.headers.authorization = 'Bearer expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => { throw error; });
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });
  });

  describe('requireAdmin', () => {
    test('should allow admin users', () => {
      mockReq.user = { role: 'admin' };
      
      authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('should reject non-admin users', () => {
      mockReq.user = { role: 'user' };
      
      authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
    
    test('should reject unauthenticated requests', () => {
      authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requirePremium', () => {
    test('should allow premium users', () => {
      mockReq.user = { subscription: 'premium' };
      
      authMiddleware.requirePremium(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('should reject non-premium users', () => {
      mockReq.user = { subscription: 'free' };
      
      authMiddleware.requirePremium(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkSubscriptionAccess', () => {
    test('should allow users with active subscription', async () => {
      mockReq.user = { subscriptionStatus: 'active' };
      
      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('should reject users with inactive subscription', async () => {
      mockReq.user = { subscriptionStatus: 'inactive' };
      
      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
    
    test('should reject users without subscription', async () => {
      mockReq.user = {};
      
      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
    
    test('should reject unauthenticated requests', async () => {
      await authMiddleware.checkSubscriptionAccess(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('checkApiAccess', () => {
    test('should allow users with API access', async () => {
      mockReq.user = { api_access: true };
      
      await authMiddleware.checkApiAccess(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('should reject users without API access', async () => {
      mockReq.user = { api_access: false };
      
      await authMiddleware.checkApiAccess(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkPermissions', () => {
    test('should allow users with all required permissions', () => {
      mockReq.user = { permissions: ['read', 'write', 'delete'] };
      const middleware = authMiddleware.checkPermissions(['read', 'write']);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('should reject users missing some required permissions', () => {
      mockReq.user = { permissions: ['read'] };
      const middleware = authMiddleware.checkPermissions(['read', 'write']);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
    
    test('should handle users with no permissions array', () => {
      mockReq.user = {};
      const middleware = authMiddleware.checkPermissions(['read']);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('rateLimitByUser', () => {
    test('should allow requests within rate limit', () => {
      mockReq.user = { id: 'user-123' };
      const middleware = authMiddleware.rateLimitByUser(5, 60);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('should reject requests exceeding rate limit', () => {
      mockReq.user = { id: 'user-456' };
      const middleware = authMiddleware.rateLimitByUser(1, 60);
      
      // First request - allowed
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Reset mockNext to check it's not called again
      mockNext.mockClear();
      
      // Second request - should be rate limited
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should reject unauthenticated requests', () => {
      const middleware = authMiddleware.rateLimitByUser(5, 60);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});