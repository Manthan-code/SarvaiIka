/**
 * Usage Middleware Unit Tests
 * Comprehensive tests for usage tracking and subscription management middleware
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { getUserActiveSubscription, trackUsage, updateUsage } = require('../src/middlewares/usageMiddleware');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../src/config/logger');
const SubscriptionExpirationService = require('../src/services/subscriptionExpirationService');

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../src/config/logger');
jest.mock('../src/services/subscriptionExpirationService');

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Usage Middleware Unit Tests', () => {
  let mockSupabase;
  let mockReq;
  let mockRes;
  let mockNext;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      update: jest.fn().mockReturnThis()
    };
    
    createClient.mockReturnValue(mockSupabase);
    
    // Setup mock request object
    mockReq = {
      user: { id: 'test-user-123' },
      userPlan: null,
      allowed: null
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
    
    // Setup mock SubscriptionExpirationService
    SubscriptionExpirationService.checkUserSubscriptionExpiry = jest.fn();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('getUserActiveSubscription', () => {
    it('should return active subscription for user', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'test-user-123',
        status: 'active',
        messages_used: 50,
        messages_limit: 1000
      };
      
      mockSupabase.single.mockResolvedValue({
        data: mockSubscription,
        error: null
      });
      
      const result = await getUserActiveSubscription('test-user-123');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toEqual(mockSubscription);
    });

    it('should return null when no active subscription found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows found' }
      });
      
      const result = await getUserActiveSubscription('test-user-123');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('No active subscription found for user:', 'test-user-123');
      expect(result).toBeNull();
    });

    it('should return null when database error occurs', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));
      
      const result = await getUserActiveSubscription('test-user-123');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching user subscription:', new Error('Database connection failed'));
      expect(result).toBeNull();
    });

    it('should handle empty userId', async () => {
      const result = await getUserActiveSubscription('');
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', '');
      expect(result).toBeNull();
    });

    it('should handle null userId', async () => {
      const result = await getUserActiveSubscription(null);
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', null);
      expect(result).toBeNull();
    });

    it('should handle undefined userId', async () => {
      const result = await getUserActiveSubscription(undefined);
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', undefined);
      expect(result).toBeNull();
    });
  });

  describe('trackUsage', () => {
    beforeEach(() => {
      SubscriptionExpirationService.checkUserSubscriptionExpiry.mockResolvedValue(false);
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = null;
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not authenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user id is missing', async () => {
      mockReq.user = {};
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not authenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow free user with profile and no subscription', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'free' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No subscription found' }
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.userPlan).toBe('free');
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow free user without profile', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No subscription found' }
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.userPlan).toBe('free');
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow free user with subscription under limit', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'free' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 50,
          messages_limit: 100
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.userPlan).toBe('free');
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny free user with subscription over limit', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'free' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 100,
          messages_limit: 100
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Message limit exceeded for free plan',
        code: 'LIMIT_EXCEEDED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow paid user with subscription under limit', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'pro' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 500,
          messages_limit: 1000
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.userPlan).toBe('pro');
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny paid user with subscription over limit', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'pro' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 1000,
          messages_limit: 1000
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Message limit exceeded',
        code: 'LIMIT_EXCEEDED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny paid user without active subscription', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'pro' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No subscription found' }
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No active subscription found',
        code: 'NO_SUBSCRIPTION'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle subscription expiry and downgrade to free', async () => {
      SubscriptionExpirationService.checkUserSubscriptionExpiry.mockResolvedValue(true);
      
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'pro' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No subscription found' }
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.userPlan).toBe('free');
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 500 when profile fetch fails with database error', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { code: 'DATABASE_ERROR', message: 'Connection failed' }
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch user profile' });
      expect(logger.error).toHaveBeenCalledWith('Error fetching user profile:', { code: 'DATABASE_ERROR', message: 'Connection failed' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when middleware throws exception', async () => {
      mockSupabase.maybeSingle.mockRejectedValue(new Error('Unexpected error'));
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(logger.error).toHaveBeenCalledWith('Error in trackUsage middleware:', new Error('Unexpected error'));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle subscription expiry service error', async () => {
      SubscriptionExpirationService.checkUserSubscriptionExpiry.mockRejectedValue(new Error('Expiry service error'));
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(logger.error).toHaveBeenCalledWith('Error in trackUsage middleware:', new Error('Expiry service error'));
    });

    it('should handle edge case with zero message limit', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'free' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 0,
          messages_limit: 0
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Message limit exceeded for free plan',
        code: 'LIMIT_EXCEEDED'
      });
    });

    it('should handle negative message usage', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'pro' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: -10,
          messages_limit: 1000
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('updateUsage', () => {
    it('should update usage successfully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: 50 },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: [{ messages_used: 51 }],
        error: null
      });
      
      const result = await updateUsage('test-user-123');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.update).toHaveBeenCalledWith({ messages_used: 51 });
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active');
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Usage updated successfully:', [{ messages_used: 51 }]);
      expect(result).toBe(true);
    });

    it('should return true for user without subscription record', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No subscription found' }
      });
      
      const result = await updateUsage('test-user-123');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('🔍 No subscription record found for user, skipping usage update');
      expect(result).toBe(true);
    });

    it('should handle null messages_used in current subscription', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: null },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: [{ messages_used: 1 }],
        error: null
      });
      
      const result = await updateUsage('test-user-123');
      
      expect(mockSupabase.update).toHaveBeenCalledWith({ messages_used: 1 });
      expect(result).toBe(true);
    });

    it('should handle undefined messages_used in current subscription', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: undefined },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: [{ messages_used: 1 }],
        error: null
      });
      
      const result = await updateUsage('test-user-123');
      
      expect(mockSupabase.update).toHaveBeenCalledWith({ messages_used: 1 });
      expect(result).toBe(true);
    });

    it('should return false when update fails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: 50 },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });
      
      const result = await updateUsage('test-user-123');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error updating usage:', { message: 'Update failed' });
      expect(logger.error).toHaveBeenCalledWith('Error updating usage:', { message: 'Update failed' });
      expect(result).toBe(false);
    });

    it('should return false when exception occurs', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database error'));
      
      const result = await updateUsage('test-user-123');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error in updateUsage:', new Error('Database error'));
      expect(logger.error).toHaveBeenCalledWith('Error in updateUsage:', new Error('Database error'));
      expect(result).toBe(false);
    });

    it('should handle empty userId', async () => {
      const result = await updateUsage('');
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', '');
      expect(result).toBe(true); // Will likely return true due to no subscription found
    });

    it('should handle null userId', async () => {
      const result = await updateUsage(null);
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', null);
      expect(result).toBe(true);
    });

    it('should handle undefined userId', async () => {
      const result = await updateUsage(undefined);
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', undefined);
      expect(result).toBe(true);
    });

    it('should handle large message usage numbers', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: 999999 },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: [{ messages_used: 1000000 }],
        error: null
      });
      
      const result = await updateUsage('test-user-123');
      
      expect(mockSupabase.update).toHaveBeenCalledWith({ messages_used: 1000000 });
      expect(result).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete flow for free user', async () => {
      // Setup for trackUsage
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'free' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 10,
          messages_limit: 100
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockReq.userPlan).toBe('free');
      expect(mockReq.allowed).toBe(true);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset mocks for updateUsage
      jest.clearAllMocks();
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: 10 },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: [{ messages_used: 11 }],
        error: null
      });
      
      const updateResult = await updateUsage('test-user-123');
      
      expect(updateResult).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith({ messages_used: 11 });
    });

    it('should handle complete flow for paid user at limit', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'pro' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: {
          messages_used: 1000,
          messages_limit: 1000
        },
        error: null
      });
      
      await trackUsage(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Message limit exceeded',
        code: 'LIMIT_EXCEEDED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should handle trackUsage within reasonable time', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { subscription_plan: 'free' },
        error: null
      });
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No subscription' }
      });
      
      const startTime = Date.now();
      await trackUsage(mockReq, mockRes, mockNext);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle updateUsage within reasonable time', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { messages_used: 50 },
        error: null
      });
      
      mockSupabase.select.mockResolvedValue({
        data: [{ messages_used: 51 }],
        error: null
      });
      
      const startTime = Date.now();
      const result = await updateUsage('test-user-123');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result).toBe(true);
    });
  });
});