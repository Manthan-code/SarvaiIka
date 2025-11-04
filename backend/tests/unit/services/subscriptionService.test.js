/**
 * Subscription Service Unit Tests
 * Comprehensive tests for all subscription service methods
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../../src/services/stripeService');

const subscriptionService = require('../../../src/services/subscriptionService');
const { createClient } = require('@supabase/supabase-js');
const stripeService = require('../../../src/services/stripeService');

describe('Subscription Service Unit Tests', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis()
    };
    
    createClient.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      const subscriptionData = {
        userId: 'user123',
        planId: 'plan_basic',
        stripeCustomerId: 'cus_test123',
        stripePriceId: 'price_test123'
      };

      const mockStripeSubscription = {
        id: 'sub_test123',
        status: 'active',
        current_period_start: 1640995200,
        current_period_end: 1643673600
      };

      const mockDbSubscription = {
        id: 'db_sub_123',
        user_id: 'user123',
        plan_id: 'plan_basic',
        stripe_subscription_id: 'sub_test123',
        status: 'active'
      };

      stripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      mockSupabase.insert.mockResolvedValue({ data: mockDbSubscription, error: null });

      const result = await subscriptionService.createSubscription(subscriptionData);

      expect(stripeService.createSubscription).toHaveBeenCalledWith({
        customer: subscriptionData.stripeCustomerId,
        items: [{ price: subscriptionData.stripePriceId }],
        metadata: { userId: subscriptionData.userId }
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(result).toEqual(mockDbSubscription);
    });

    it('should handle Stripe subscription creation failure', async () => {
      const subscriptionData = {
        userId: 'user123',
        planId: 'plan_basic',
        stripeCustomerId: 'cus_test123',
        stripePriceId: 'price_test123'
      };

      stripeService.createSubscription.mockRejectedValue(new Error('Stripe error'));

      await expect(subscriptionService.createSubscription(subscriptionData))
        .rejects.toThrow('Stripe error');
    });

    it('should handle database insertion failure', async () => {
      const subscriptionData = {
        userId: 'user123',
        planId: 'plan_basic',
        stripeCustomerId: 'cus_test123',
        stripePriceId: 'price_test123'
      };

      const mockStripeSubscription = {
        id: 'sub_test123',
        status: 'active'
      };

      stripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      mockSupabase.insert.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(subscriptionService.createSubscription(subscriptionData))
        .rejects.toThrow('Database error');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription by user ID', async () => {
      const userId = 'user123';
      const mockSubscription = {
        id: 'sub_123',
        user_id: userId,
        plan_id: 'plan_basic',
        status: 'active',
        stripe_subscription_id: 'sub_stripe123'
      };

      mockSupabase.select.mockResolvedValue({ data: [mockSubscription], error: null });

      const result = await subscriptionService.getSubscription(userId);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
      expect(result).toEqual(mockSubscription);
    });

    it('should return null when subscription not found', async () => {
      const userId = 'user123';

      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await subscriptionService.getSubscription(userId);

      expect(result).toBeNull();
    });

    it('should handle database query errors', async () => {
      const userId = 'user123';

      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(subscriptionService.getSubscription(userId))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const subscriptionId = 'sub_123';
      const updateData = {
        status: 'canceled',
        canceled_at: new Date().toISOString()
      };

      const mockUpdatedSubscription = {
        id: subscriptionId,
        ...updateData
      };

      mockSupabase.update.mockResolvedValue({ 
        data: [mockUpdatedSubscription], 
        error: null 
      });

      const result = await subscriptionService.updateSubscription(subscriptionId, updateData);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.update).toHaveBeenCalledWith(updateData);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', subscriptionId);
      expect(result).toEqual(mockUpdatedSubscription);
    });

    it('should handle update errors', async () => {
      const subscriptionId = 'sub_123';
      const updateData = { status: 'canceled' };

      mockSupabase.update.mockResolvedValue({ 
        data: null, 
        error: { message: 'Update failed' } 
      });

      await expect(subscriptionService.updateSubscription(subscriptionId, updateData))
        .rejects.toThrow('Update failed');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription in both Stripe and database', async () => {
      const userId = 'user123';
      const stripeSubscriptionId = 'sub_stripe123';

      const mockSubscription = {
        id: 'sub_123',
        user_id: userId,
        stripe_subscription_id: stripeSubscriptionId,
        status: 'active'
      };

      const mockCanceledStripeSubscription = {
        id: stripeSubscriptionId,
        status: 'canceled'
      };

      const mockUpdatedSubscription = {
        ...mockSubscription,
        status: 'canceled'
      };

      mockSupabase.select.mockResolvedValue({ data: [mockSubscription], error: null });
      stripeService.cancelSubscription.mockResolvedValue(mockCanceledStripeSubscription);
      mockSupabase.update.mockResolvedValue({ 
        data: [mockUpdatedSubscription], 
        error: null 
      });

      const result = await subscriptionService.cancelSubscription(userId);

      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(stripeSubscriptionId);
      expect(mockSupabase.update).toHaveBeenCalledWith({ 
        status: 'canceled',
        canceled_at: expect.any(String)
      });
      expect(result).toEqual(mockUpdatedSubscription);
    });

    it('should handle subscription not found', async () => {
      const userId = 'user123';

      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      await expect(subscriptionService.cancelSubscription(userId))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should retrieve all active subscriptions', async () => {
      const mockActiveSubscriptions = [
        { id: 'sub_1', status: 'active', user_id: 'user1' },
        { id: 'sub_2', status: 'active', user_id: 'user2' }
      ];

      mockSupabase.select.mockResolvedValue({ 
        data: mockActiveSubscriptions, 
        error: null 
      });

      const result = await subscriptionService.getActiveSubscriptions();

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toEqual(mockActiveSubscriptions);
    });
  });

  describe('getExpiringSubscriptions', () => {
    it('should retrieve subscriptions expiring within specified days', async () => {
      const days = 7;
      const mockExpiringSubscriptions = [
        { 
          id: 'sub_1', 
          status: 'active', 
          current_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.select.mockResolvedValue({ 
        data: mockExpiringSubscriptions, 
        error: null 
      });

      const result = await subscriptionService.getExpiringSubscriptions(days);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockSupabase.lte).toHaveBeenCalled();
      expect(result).toEqual(mockExpiringSubscriptions);
    });
  });

  describe('syncWithStripe', () => {
    it('should sync subscription status with Stripe', async () => {
      const subscriptionId = 'sub_123';
      const stripeSubscriptionId = 'sub_stripe123';

      const mockDbSubscription = {
        id: subscriptionId,
        stripe_subscription_id: stripeSubscriptionId,
        status: 'active'
      };

      const mockStripeSubscription = {
        id: stripeSubscriptionId,
        status: 'past_due',
        current_period_start: 1640995200,
        current_period_end: 1643673600
      };

      const mockUpdatedSubscription = {
        ...mockDbSubscription,
        status: 'past_due'
      };

      mockSupabase.select.mockResolvedValue({ data: [mockDbSubscription], error: null });
      stripeService.getSubscription.mockResolvedValue(mockStripeSubscription);
      mockSupabase.update.mockResolvedValue({ 
        data: [mockUpdatedSubscription], 
        error: null 
      });

      const result = await subscriptionService.syncWithStripe(subscriptionId);

      expect(stripeService.getSubscription).toHaveBeenCalledWith(stripeSubscriptionId);
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'past_due',
        current_period_start: expect.any(String),
        current_period_end: expect.any(String)
      });
      expect(result).toEqual(mockUpdatedSubscription);
    });
  });

  describe('getSubscriptionUsage', () => {
    it('should retrieve subscription usage statistics', async () => {
      const userId = 'user123';
      const mockUsage = {
        api_calls_used: 150,
        api_calls_limit: 1000,
        storage_used: 500,
        storage_limit: 10000
      };

      mockSupabase.select.mockResolvedValue({ data: [mockUsage], error: null });

      const result = await subscriptionService.getSubscriptionUsage(userId);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_usage');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
      expect(result).toEqual(mockUsage);
    });
  });

  describe('updateUsage', () => {
    it('should update subscription usage', async () => {
      const userId = 'user123';
      const usageData = {
        api_calls_used: 200,
        storage_used: 600
      };

      const mockUpdatedUsage = {
        user_id: userId,
        ...usageData,
        updated_at: new Date().toISOString()
      };

      mockSupabase.update.mockResolvedValue({ 
        data: [mockUpdatedUsage], 
        error: null 
      });

      const result = await subscriptionService.updateUsage(userId, usageData);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_usage');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        ...usageData,
        updated_at: expect.any(String)
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
      expect(result).toEqual(mockUpdatedUsage);
    });
  });

  describe('validateSubscriptionAccess', () => {
    it('should validate active subscription access', async () => {
      const userId = 'user123';
      const feature = 'premium_api';

      const mockSubscription = {
        id: 'sub_123',
        user_id: userId,
        status: 'active',
        plan_id: 'plan_premium',
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockSupabase.select.mockResolvedValue({ data: [mockSubscription], error: null });

      const result = await subscriptionService.validateSubscriptionAccess(userId, feature);

      expect(result).toBe(true);
    });

    it('should deny access for expired subscription', async () => {
      const userId = 'user123';
      const feature = 'premium_api';

      const mockSubscription = {
        id: 'sub_123',
        user_id: userId,
        status: 'active',
        plan_id: 'plan_premium',
        current_period_end: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };

      mockSupabase.select.mockResolvedValue({ data: [mockSubscription], error: null });

      const result = await subscriptionService.validateSubscriptionAccess(userId, feature);

      expect(result).toBe(false);
    });

    it('should deny access for canceled subscription', async () => {
      const userId = 'user123';
      const feature = 'premium_api';

      const mockSubscription = {
        id: 'sub_123',
        user_id: userId,
        status: 'canceled',
        plan_id: 'plan_premium'
      };

      mockSupabase.select.mockResolvedValue({ data: [mockSubscription], error: null });

      const result = await subscriptionService.validateSubscriptionAccess(userId, feature);

      expect(result).toBe(false);
    });
  });
});