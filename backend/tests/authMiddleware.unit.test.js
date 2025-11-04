/**
 * Auth Middleware Unit Tests
 * Comprehensive tests for authentication and authorization middleware
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { requireAuth, requireRole } = require('../src/middlewares/authMiddleware');
const supabase = require('../src/db/supabase/client');
const logger = require('../src/config/logger');

// Mock dependencies
jest.mock('../src/db/supabase/client');
jest.mock('../src/config/logger');

describe('Auth Middleware Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request object
    mockReq = {
      headers: {},
      user: null,
      profile: null
    };
    
    // Setup mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    // Setup mock next function
    mockNext = jest.fn();
    
    // Setup mock logger
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requireAuth', () => {
    const mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      aud: 'authenticated'
    };

    const mockProfile = {
      id: 'test-user-123',
      role: 'user',
      subscription_plan: 'pro',
      email: 'test@example.com',
      name: 'Test User'
    };

    it('should authenticate user successfully with valid token and profile', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.profile).toEqual(mockProfile);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should authenticate user with default profile when profile not found', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Not found error
            })
          })
        })
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.profile).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: 'user',
        subscription_plan: 'free'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', async () => {
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid Authorization header' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is malformed', async () => {
      mockReq.headers.authorization = 'InvalidHeader';
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid Authorization header' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Bearer token is missing', async () => {
      mockReq.headers.authorization = 'Bearer ';
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid Authorization header' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Invalid or expired token' 
      });
      expect(logger.error).toHaveBeenCalledWith('Auth error:', { message: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is null', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Invalid or expired token' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when database error occurs fetching profile', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'DATABASE_ERROR', message: 'Connection failed' }
            })
          })
        })
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
      expect(logger.error).toHaveBeenCalledWith(
        'Database error fetching profile:', 
        { code: 'DATABASE_ERROR', message: 'Connection failed' }
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when database query throws exception', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
      expect(logger.error).toHaveBeenCalledWith(
        'Database error fetching profile:', 
        new Error('Network error')
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when auth.getUser throws exception', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockRejectedValue(new Error('Auth service error'));
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(logger.error).toHaveBeenCalledWith(
        'Error in requireAuth middleware:', 
        new Error('Auth service error')
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty authorization header', async () => {
      mockReq.headers.authorization = '';
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid Authorization header' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle authorization header with only Bearer', async () => {
      mockReq.headers.authorization = 'Bearer';
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid Authorization header' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle case-sensitive Bearer token', async () => {
      mockReq.headers.authorization = 'bearer valid-token';
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid Authorization header' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple spaces in authorization header', async () => {
      mockReq.headers.authorization = 'Bearer  valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(supabase.auth.getUser).toHaveBeenCalledWith(' valid-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle user without email', async () => {
      const userWithoutEmail = { id: 'test-user-123', aud: 'authenticated' };
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: userWithoutEmail },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      });
      
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockReq.profile).toEqual({
        id: userWithoutEmail.id,
        email: undefined,
        role: 'user',
        subscription_plan: 'free'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockReq.profile = {
        id: 'test-user-123',
        role: 'user',
        subscription_plan: 'pro'
      };
    });

    it('should allow access when user has required role', () => {
      const middleware = requireRole('user');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when user does not have required role', () => {
      const middleware = requireRole('admin');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle admin role requirement', () => {
      mockReq.profile.role = 'admin';
      const middleware = requireRole('admin');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle moderator role requirement', () => {
      mockReq.profile.role = 'moderator';
      const middleware = requireRole('moderator');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle missing profile', () => {
      mockReq.profile = null;
      const middleware = requireRole('user');
      
      expect(() => middleware(mockReq, mockRes, mockNext)).toThrow();
    });

    it('should handle missing role in profile', () => {
      mockReq.profile = { id: 'test-user-123' };
      const middleware = requireRole('user');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle case-sensitive role comparison', () => {
      mockReq.profile.role = 'User'; // Capital U
      const middleware = requireRole('user');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty role requirement', () => {
      const middleware = requireRole('');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle null role requirement', () => {
      const middleware = requireRole(null);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle undefined role requirement', () => {
      const middleware = requireRole(undefined);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should work with requireAuth followed by requireRole', async () => {
      const mockUser = {
        id: 'test-user-123',
        email: 'admin@example.com'
      };
      
      const mockProfile = {
        id: 'test-user-123',
        role: 'admin',
        subscription_plan: 'pro',
        email: 'admin@example.com',
        name: 'Admin User'
      };
      
      mockReq.headers.authorization = 'Bearer valid-admin-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      });
      
      // First middleware: requireAuth
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.profile).toEqual(mockProfile);
      
      // Reset next mock
      mockNext.mockClear();
      
      // Second middleware: requireRole
      const roleMiddleware = requireRole('admin');
      roleMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail role check after successful auth with wrong role', async () => {
      const mockUser = {
        id: 'test-user-123',
        email: 'user@example.com'
      };
      
      const mockProfile = {
        id: 'test-user-123',
        role: 'user',
        subscription_plan: 'free',
        email: 'user@example.com',
        name: 'Regular User'
      };
      
      mockReq.headers.authorization = 'Bearer valid-user-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      });
      
      // First middleware: requireAuth
      await requireAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockReq.profile.role).toBe('user');
      
      // Reset mocks
      mockNext.mockClear();
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      
      // Second middleware: requireRole (admin)
      const roleMiddleware = requireRole('admin');
      roleMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should handle auth requests within reasonable time', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
        error: null
      });
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'test-user', role: 'user' },
              error: null
            })
          })
        })
      });
      
      const startTime = Date.now();
      await requireAuth(mockReq, mockRes, mockNext);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle role checks within reasonable time', () => {
      mockReq.profile = { role: 'user' };
      const middleware = requireRole('user');
      
      const startTime = Date.now();
      middleware(mockReq, mockRes, mockNext);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(mockNext).toHaveBeenCalled();
    });
  });
});