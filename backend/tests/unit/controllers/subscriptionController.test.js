/**
 * Subscription Controller Unit Tests
 * Comprehensive tests for all subscription controller methods
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock dependencies
jest.mock('../../../src/services/subscriptionService');
jest.mock('../../../src/services/stripeService');
jest.mock('../../../src/utils/logger');

const subscriptionController = require('../../../src/controllers/subscriptionController');
const subscriptionService = require('../../../src/services/subscriptionService');
const stripeService = require('../../../src/services/stripeService');
const logger = require('../../../src/utils/logger');

describe('Subscription Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: {
        id: 'user_123',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123'
      },
      headers: {
        'content-type': 'application/json'
      }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customerId: 'cus_123',
        priceId: 'price_123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date()
      };

      mockReq.body = {
        priceId: 'price_123',
        paymentMethodId: 'pm_123'
      };

      subscriptionService.createSubscription.mockResolvedValue(mockSubscription);

      await subscriptionController.createSubscription(mockReq, mockRes, mockNext);

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith({
        customerId: 'cus_123',
        priceId: 'price_123',
        paymentMethodId: 'pm_123',
        userId: 'user_123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubscription
      });
    });

    it('should handle missing price ID', async () => {
      mockReq.body = {
        paymentMethodId: 'pm_123'
      };

      await subscriptionController.createSubscription(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Price ID is required'
      });
    });

    it('should handle subscription creation errors', async () => {
      mockReq.body = {
        priceId: 'price_123',
        paymentMethodId: 'pm_123'
      };

      const error = new Error('Payment method declined');
      subscriptionService.createSubscription.mockRejectedValue(error);

      await subscriptionController.createSubscription(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Create subscription error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create subscription'
      });
    });

    it('should handle Stripe payment errors', async () => {
      mockReq.body = {
        priceId: 'price_123',
        paymentMethodId: 'pm_123'
      };

      const stripeError = new Error('Your card was declined');
      stripeError.type = 'card_error';
      stripeError.code = 'card_declined';
      subscriptionService.createSubscription.mockRejectedValue(stripeError);

      await subscriptionController.createSubscription(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Your card was declined'
      });
    });
  });

  describe('getSubscription', () => {
    it('should get subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active',
        plan: {
          id: 'plan_123',
          name: 'Pro Plan',
          amount: 2999
        }
      };

      mockReq.params = {
        subscriptionId: 'sub_123'
      };

      subscriptionService.getSubscription.mockResolvedValue(mockSubscription);

      await subscriptionController.getSubscription(mockReq, mockRes, mockNext);

      expect(subscriptionService.getSubscription).toHaveBeenCalledWith('sub_123', 'user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubscription
      });
    });

    it('should handle subscription not found', async () => {
      mockReq.params = {
        subscriptionId: 'sub_nonexistent'
      };

      subscriptionService.getSubscription.mockResolvedValue(null);

      await subscriptionController.getSubscription(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription not found'
      });
    });

    it('should handle unauthorized access', async () => {
      mockReq.user = null;
      mockReq.params = {
        subscriptionId: 'sub_123'
      };

      await subscriptionController.getSubscription(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized access'
      });
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const updatedSubscription = {
        id: 'sub_123',
        priceId: 'price_456',
        status: 'active'
      };

      mockReq.params = {
        subscriptionId: 'sub_123'
      };
      mockReq.body = {
        priceId: 'price_456'
      };

      subscriptionService.updateSubscription.mockResolvedValue(updatedSubscription);

      await subscriptionController.updateSubscription(mockReq, mockRes, mockNext);

      expect(subscriptionService.updateSubscription).toHaveBeenCalledWith('sub_123', {
        priceId: 'price_456'
      }, 'user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedSubscription
      });
    });

    it('should handle invalid update data', async () => {
      mockReq.params = {
        subscriptionId: 'sub_123'
      };
      mockReq.body = {};

      await subscriptionController.updateSubscription(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No valid update data provided'
      });
    });

    it('should handle update errors', async () => {
      mockReq.params = {
        subscriptionId: 'sub_123'
      };
      mockReq.body = {
        priceId: 'price_456'
      };

      const error = new Error('Subscription update failed');
      subscriptionService.updateSubscription.mockRejectedValue(error);

      await subscriptionController.updateSubscription(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Update subscription error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update subscription'
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const cancelledSubscription = {
        id: 'sub_123',
        status: 'canceled',
        canceledAt: new Date()
      };

      mockReq.params = {
        subscriptionId: 'sub_123'
      };

      subscriptionService.cancelSubscription.mockResolvedValue(cancelledSubscription);

      await subscriptionController.cancelSubscription(mockReq, mockRes, mockNext);

      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith('sub_123', 'user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: cancelledSubscription,
        message: 'Subscription cancelled successfully'
      });
    });

    it('should handle cancellation errors', async () => {
      mockReq.params = {
        subscriptionId: 'sub_123'
      };

      const error = new Error('Cannot cancel subscription');
      subscriptionService.cancelSubscription.mockRejectedValue(error);

      await subscriptionController.cancelSubscription(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Cancel subscription error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to cancel subscription'
      });
    });
  });

  describe('getUserSubscriptions', () => {
    it('should get user subscriptions successfully', async () => {
      const mockSubscriptions = [
        {
          id: 'sub_123',
          status: 'active',
          plan: { name: 'Pro Plan' }
        },
        {
          id: 'sub_456',
          status: 'canceled',
          plan: { name: 'Basic Plan' }
        }
      ];

      subscriptionService.getUserSubscriptions.mockResolvedValue(mockSubscriptions);

      await subscriptionController.getUserSubscriptions(mockReq, mockRes, mockNext);

      expect(subscriptionService.getUserSubscriptions).toHaveBeenCalledWith('user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubscriptions
      });
    });

    it('should handle empty subscriptions list', async () => {
      subscriptionService.getUserSubscriptions.mockResolvedValue([]);

      await subscriptionController.getUserSubscriptions(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      const mockSession = {
        id: 'cs_123',
        url: 'https://checkout.stripe.com/pay/cs_123'
      };

      mockReq.body = {
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      };

      stripeService.createCheckoutSession.mockResolvedValue(mockSession);

      await subscriptionController.createCheckoutSession(mockReq, mockRes, mockNext);

      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith({
        customerId: 'cus_123',
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession
      });
    });

    it('should handle missing required fields', async () => {
      mockReq.body = {
        priceId: 'price_123'
        // Missing successUrl and cancelUrl
      };

      await subscriptionController.createCheckoutSession(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Price ID, success URL, and cancel URL are required'
      });
    });
  });

  describe('handleWebhook', () => {
    it('should handle subscription webhook successfully', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active'
          }
        }
      };

      mockReq.body = mockEvent;
      mockReq.headers['stripe-signature'] = 'whsec_test_signature';

      stripeService.constructEvent.mockReturnValue(mockEvent);
      subscriptionService.handleWebhookEvent.mockResolvedValue({ processed: true });

      await subscriptionController.handleWebhook(mockReq, mockRes, mockNext);

      expect(stripeService.constructEvent).toHaveBeenCalledWith(
        mockEvent,
        'whsec_test_signature'
      );
      expect(subscriptionService.handleWebhookEvent).toHaveBeenCalledWith(mockEvent);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });

    it('should handle invalid webhook signature', async () => {
      mockReq.body = { type: 'test.event' };
      mockReq.headers['stripe-signature'] = 'invalid_signature';

      const error = new Error('Invalid signature');
      stripeService.constructEvent.mockImplementation(() => {
        throw error;
      });

      await subscriptionController.handleWebhook(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Webhook signature verification failed:', error);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid webhook signature'
      });
    });
  });

  describe('getSubscriptionUsage', () => {
    it('should get subscription usage successfully', async () => {
      const mockUsage = {
        subscriptionId: 'sub_123',
        currentUsage: 150,
        limit: 1000,
        resetDate: new Date(),
        usagePercentage: 15
      };

      mockReq.params = {
        subscriptionId: 'sub_123'
      };

      subscriptionService.getSubscriptionUsage.mockResolvedValue(mockUsage);

      await subscriptionController.getSubscriptionUsage(mockReq, mockRes, mockNext);

      expect(subscriptionService.getSubscriptionUsage).toHaveBeenCalledWith('sub_123', 'user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUsage
      });
    });

    it('should handle usage tracking errors', async () => {
      mockReq.params = {
        subscriptionId: 'sub_123'
      };

      const error = new Error('Usage tracking error');
      subscriptionService.getSubscriptionUsage.mockRejectedValue(error);

      await subscriptionController.getSubscriptionUsage(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Get usage error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve usage information'
      });
    });
  });

  describe('validateSubscriptionAccess', () => {
    it('should validate subscription access successfully', async () => {
      const mockValidation = {
        hasAccess: true,
        subscription: {
          id: 'sub_123',
          status: 'active',
          plan: { name: 'Pro Plan' }
        }
      };

      mockReq.body = {
        feature: 'advanced_chat'
      };

      subscriptionService.validateSubscriptionAccess.mockResolvedValue(mockValidation);

      await subscriptionController.validateSubscriptionAccess(mockReq, mockRes, mockNext);

      expect(subscriptionService.validateSubscriptionAccess).toHaveBeenCalledWith(
        'user_123',
        'advanced_chat'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockValidation
      });
    });

    it('should handle access denied', async () => {
      const mockValidation = {
        hasAccess: false,
        reason: 'Subscription expired'
      };

      mockReq.body = {
        feature: 'advanced_chat'
      };

      subscriptionService.validateSubscriptionAccess.mockResolvedValue(mockValidation);

      await subscriptionController.validateSubscriptionAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: mockValidation
      });
    });
  });
});