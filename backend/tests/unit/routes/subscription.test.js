/**
 * Subscription Routes Unit Tests
 * Comprehensive tests for subscription route handlers
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockSubscriptionController = {
  createSubscription: jest.fn(),
  getSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getUserSubscriptions: jest.fn(),
  createCheckoutSession: jest.fn(),
  handleWebhook: jest.fn(),
  getSubscriptionUsage: jest.fn(),
  validateSubscriptionAccess: jest.fn()
};

const mockAuth = {
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user_123', email: 'test@example.com' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
  rateLimitByUser: jest.fn((req, res, next) => next()),
  optionalAuth: jest.fn((req, res, next) => next())
};

const mockValidation = {
  validateSubscriptionData: jest.fn((req, res, next) => next()),
  validatePriceId: jest.fn((req, res, next) => next()),
  validateWebhookSignature: jest.fn((req, res, next) => next()),
  validatePagination: jest.fn((req, res, next) => next())
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/controllers/subscriptionController', () => mockSubscriptionController);
jest.mock('../../../src/middleware/auth', () => mockAuth);
jest.mock('../../../src/middleware/validation', () => mockValidation);
jest.mock('../../../src/utils/logger', () => mockLogger);

// Create Express app with routes
const app = express();
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For webhooks

// Import and use routes after mocking
const subscriptionRoutes = require('../../../src/routes/subscription');
app.use('/api/subscriptions', subscriptionRoutes);

describe('Subscription Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/subscriptions', () => {
    it('should create subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        stripe_subscription_id: 'sub_stripe_123',
        status: 'active',
        plan: 'pro'
      };

      mockSubscriptionController.createSubscription.mockImplementation((req, res) => {
        res.status(201).json(mockSubscription);
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .send({
          priceId: 'price_123',
          paymentMethodId: 'pm_123'
        })
        .expect(201);

      expect(response.body).toEqual(mockSubscription);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockAuth.rateLimitByUser).toHaveBeenCalled();
      expect(mockValidation.validateSubscriptionData).toHaveBeenCalled();
      expect(mockSubscriptionController.createSubscription).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(401);
    });

    it('should enforce rate limiting', async () => {
      mockAuth.rateLimitByUser.mockImplementation((req, res, next) => {
        res.status(429).json({ error: 'Too many requests' });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(429);
    });

    it('should validate subscription data', async () => {
      mockValidation.validateSubscriptionData.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid subscription data' });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: '' })
        .expect(400);
    });

    it('should handle missing price ID', async () => {
      mockSubscriptionController.createSubscription.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Price ID is required' });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({})
        .expect(400);
    });

    it('should handle Stripe payment errors', async () => {
      mockSubscriptionController.createSubscription.mockImplementation((req, res) => {
        res.status(402).json({ 
          error: 'Payment failed',
          code: 'card_declined'
        });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123', paymentMethodId: 'pm_invalid' })
        .expect(402);
    });

    it('should handle subscription creation errors', async () => {
      mockSubscriptionController.createSubscription.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to create subscription' });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(500);
    });
  });

  describe('GET /api/subscriptions/:subscriptionId', () => {
    it('should get subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        status: 'active',
        plan: 'pro',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01'
      };

      mockSubscriptionController.getSubscription.mockImplementation((req, res) => {
        res.status(200).json(mockSubscription);
      });

      const response = await request(app)
        .get('/api/subscriptions/sub_123')
        .expect(200);

      expect(response.body).toEqual(mockSubscription);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockSubscriptionController.getSubscription).toHaveBeenCalled();
    });

    it('should handle subscription not found', async () => {
      mockSubscriptionController.getSubscription.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Subscription not found' });
      });

      await request(app)
        .get('/api/subscriptions/nonexistent')
        .expect(404);
    });

    it('should handle unauthorized access', async () => {
      mockSubscriptionController.getSubscription.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Unauthorized access to subscription' });
      });

      await request(app)
        .get('/api/subscriptions/sub_123')
        .expect(403);
    });

    it('should handle invalid subscription ID format', async () => {
      await request(app)
        .get('/api/subscriptions/invalid@id')
        .expect(400);
    });
  });

  describe('PUT /api/subscriptions/:subscriptionId', () => {
    it('should update subscription successfully', async () => {
      const updatedSubscription = {
        id: 'sub_123',
        status: 'active',
        plan: 'enterprise',
        updated_at: '2024-01-01T12:00:00Z'
      };

      mockSubscriptionController.updateSubscription.mockImplementation((req, res) => {
        res.status(200).json(updatedSubscription);
      });

      const response = await request(app)
        .put('/api/subscriptions/sub_123')
        .send({ plan: 'enterprise' })
        .expect(200);

      expect(response.body).toEqual(updatedSubscription);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateSubscriptionData).toHaveBeenCalled();
      expect(mockSubscriptionController.updateSubscription).toHaveBeenCalled();
    });

    it('should handle invalid update data', async () => {
      mockValidation.validateSubscriptionData.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid update data' });
      });

      await request(app)
        .put('/api/subscriptions/sub_123')
        .send({ plan: '' })
        .expect(400);
    });

    it('should handle subscription not found for update', async () => {
      mockSubscriptionController.updateSubscription.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Subscription not found' });
      });

      await request(app)
        .put('/api/subscriptions/nonexistent')
        .send({ plan: 'pro' })
        .expect(404);
    });

    it('should handle update errors', async () => {
      mockSubscriptionController.updateSubscription.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to update subscription' });
      });

      await request(app)
        .put('/api/subscriptions/sub_123')
        .send({ plan: 'pro' })
        .expect(500);
    });
  });

  describe('DELETE /api/subscriptions/:subscriptionId', () => {
    it('should cancel subscription successfully', async () => {
      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Subscription cancelled successfully',
          cancellation_date: '2024-02-01'
        });
      });

      const response = await request(app)
        .delete('/api/subscriptions/sub_123')
        .expect(200);

      expect(response.body.message).toBe('Subscription cancelled successfully');
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockSubscriptionController.cancelSubscription).toHaveBeenCalled();
    });

    it('should handle immediate cancellation', async () => {
      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Subscription cancelled immediately',
          status: 'cancelled'
        });
      });

      await request(app)
        .delete('/api/subscriptions/sub_123?immediate=true')
        .expect(200);
    });

    it('should handle subscription not found for cancellation', async () => {
      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Subscription not found' });
      });

      await request(app)
        .delete('/api/subscriptions/nonexistent')
        .expect(404);
    });

    it('should handle cancellation errors', async () => {
      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to cancel subscription' });
      });

      await request(app)
        .delete('/api/subscriptions/sub_123')
        .expect(500);
    });

    it('should handle already cancelled subscription', async () => {
      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Subscription already cancelled' });
      });

      await request(app)
        .delete('/api/subscriptions/sub_123')
        .expect(400);
    });
  });

  describe('GET /api/subscriptions', () => {
    it('should get user subscriptions successfully', async () => {
      const mockSubscriptions = {
        subscriptions: [
          { id: 'sub_1', plan: 'pro', status: 'active' },
          { id: 'sub_2', plan: 'basic', status: 'cancelled' }
        ],
        total: 2,
        page: 1,
        limit: 10
      };

      mockSubscriptionController.getUserSubscriptions.mockImplementation((req, res) => {
        res.status(200).json(mockSubscriptions);
      });

      const response = await request(app)
        .get('/api/subscriptions')
        .expect(200);

      expect(response.body).toEqual(mockSubscriptions);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validatePagination).toHaveBeenCalled();
      expect(mockSubscriptionController.getUserSubscriptions).toHaveBeenCalled();
    });

    it('should handle empty subscriptions list', async () => {
      mockSubscriptionController.getUserSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({
          subscriptions: [],
          total: 0,
          page: 1,
          limit: 10
        });
      });

      const response = await request(app)
        .get('/api/subscriptions')
        .expect(200);

      expect(response.body.subscriptions).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should handle pagination parameters', async () => {
      mockSubscriptionController.getUserSubscriptions.mockImplementation((req, res) => {
        expect(req.query.page).toBe('2');
        expect(req.query.limit).toBe('5');
        res.status(200).json({
          subscriptions: [],
          total: 15,
          page: 2,
          limit: 5
        });
      });

      await request(app)
        .get('/api/subscriptions?page=2&limit=5')
        .expect(200);
    });

    it('should filter by status', async () => {
      mockSubscriptionController.getUserSubscriptions.mockImplementation((req, res) => {
        expect(req.query.status).toBe('active');
        res.status(200).json({
          subscriptions: [{ id: 'sub_1', status: 'active' }],
          total: 1,
          page: 1,
          limit: 10
        });
      });

      await request(app)
        .get('/api/subscriptions?status=active')
        .expect(200);
    });
  });

  describe('POST /api/subscriptions/checkout', () => {
    it('should create checkout session successfully', async () => {
      const mockSession = {
        id: 'cs_123',
        url: 'https://checkout.stripe.com/pay/cs_123',
        expires_at: 1640995200
      };

      mockSubscriptionController.createCheckoutSession.mockImplementation((req, res) => {
        res.status(200).json(mockSession);
      });

      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .send({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        })
        .expect(200);

      expect(response.body).toEqual(mockSession);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validatePriceId).toHaveBeenCalled();
      expect(mockSubscriptionController.createCheckoutSession).toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      mockSubscriptionController.createCheckoutSession.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Missing required fields' });
      });

      await request(app)
        .post('/api/subscriptions/checkout')
        .send({ priceId: 'price_123' })
        .expect(400);
    });

    it('should validate price ID', async () => {
      mockValidation.validatePriceId.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid price ID' });
      });

      await request(app)
        .post('/api/subscriptions/checkout')
        .send({ priceId: 'invalid' })
        .expect(400);
    });

    it('should handle checkout session creation errors', async () => {
      mockSubscriptionController.createCheckoutSession.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to create checkout session' });
      });

      await request(app)
        .post('/api/subscriptions/checkout')
        .send({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        })
        .expect(500);
    });
  });

  describe('POST /api/subscriptions/webhook', () => {
    it('should handle webhook successfully', async () => {
      mockSubscriptionController.handleWebhook.mockImplementation((req, res) => {
        res.status(200).json({ received: true });
      });

      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'valid_signature')
        .send({ type: 'invoice.payment_succeeded' })
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockValidation.validateWebhookSignature).toHaveBeenCalled();
      expect(mockSubscriptionController.handleWebhook).toHaveBeenCalled();
    });

    it('should validate webhook signature', async () => {
      mockValidation.validateWebhookSignature.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid webhook signature' });
      });

      await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send({ type: 'invoice.payment_succeeded' })
        .expect(400);
    });

    it('should handle missing signature', async () => {
      await request(app)
        .post('/api/subscriptions/webhook')
        .send({ type: 'invoice.payment_succeeded' })
        .expect(400);
    });

    it('should handle webhook processing errors', async () => {
      mockSubscriptionController.handleWebhook.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Webhook processing failed' });
      });

      await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'valid_signature')
        .send({ type: 'invoice.payment_succeeded' })
        .expect(500);
    });

    it('should handle unknown webhook events', async () => {
      mockSubscriptionController.handleWebhook.mockImplementation((req, res) => {
        res.status(200).json({ 
          received: true,
          message: 'Unknown event type'
        });
      });

      await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'valid_signature')
        .send({ type: 'unknown.event' })
        .expect(200);
    });
  });

  describe('GET /api/subscriptions/:subscriptionId/usage', () => {
    it('should get subscription usage successfully', async () => {
      const mockUsage = {
        subscription_id: 'sub_123',
        current_usage: 1500,
        limit: 5000,
        period_start: '2024-01-01',
        period_end: '2024-02-01',
        usage_percentage: 30
      };

      mockSubscriptionController.getSubscriptionUsage.mockImplementation((req, res) => {
        res.status(200).json(mockUsage);
      });

      const response = await request(app)
        .get('/api/subscriptions/sub_123/usage')
        .expect(200);

      expect(response.body).toEqual(mockUsage);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockSubscriptionController.getSubscriptionUsage).toHaveBeenCalled();
    });

    it('should handle usage tracking errors', async () => {
      mockSubscriptionController.getSubscriptionUsage.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to retrieve usage data' });
      });

      await request(app)
        .get('/api/subscriptions/sub_123/usage')
        .expect(500);
    });

    it('should handle subscription not found for usage', async () => {
      mockSubscriptionController.getSubscriptionUsage.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Subscription not found' });
      });

      await request(app)
        .get('/api/subscriptions/nonexistent/usage')
        .expect(404);
    });
  });

  describe('POST /api/subscriptions/:subscriptionId/validate', () => {
    it('should validate subscription access successfully', async () => {
      mockSubscriptionController.validateSubscriptionAccess.mockImplementation((req, res) => {
        res.status(200).json({ 
          valid: true,
          subscription: { id: 'sub_123', status: 'active' }
        });
      });

      const response = await request(app)
        .post('/api/subscriptions/sub_123/validate')
        .send({ feature: 'chat' })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockSubscriptionController.validateSubscriptionAccess).toHaveBeenCalled();
    });

    it('should handle access denied', async () => {
      mockSubscriptionController.validateSubscriptionAccess.mockImplementation((req, res) => {
        res.status(403).json({ 
          valid: false,
          reason: 'Subscription expired'
        });
      });

      await request(app)
        .post('/api/subscriptions/sub_123/validate')
        .send({ feature: 'chat' })
        .expect(403);
    });

    it('should handle missing feature parameter', async () => {
      await request(app)
        .post('/api/subscriptions/sub_123/validate')
        .send({})
        .expect(400);
    });
  });

  describe('Route Security', () => {
    it('should require authentication for protected routes', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      // Test all protected routes
      await request(app).post('/api/subscriptions').expect(401);
      await request(app).get('/api/subscriptions/sub_123').expect(401);
      await request(app).put('/api/subscriptions/sub_123').expect(401);
      await request(app).delete('/api/subscriptions/sub_123').expect(401);
      await request(app).get('/api/subscriptions').expect(401);
      await request(app).post('/api/subscriptions/checkout').expect(401);
      await request(app).get('/api/subscriptions/sub_123/usage').expect(401);
      await request(app).post('/api/subscriptions/sub_123/validate').expect(401);
    });

    it('should not require authentication for webhooks', async () => {
      mockSubscriptionController.handleWebhook.mockImplementation((req, res) => {
        res.status(200).json({ received: true });
      });

      await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'valid_signature')
        .send({ type: 'invoice.payment_succeeded' })
        .expect(200);

      expect(mockAuth.authenticateToken).not.toHaveBeenCalled();
    });

    it('should apply rate limiting to subscription creation', async () => {
      mockAuth.rateLimitByUser.mockImplementation((req, res, next) => {
        res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: 300
        });
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(429);
    });
  });

  describe('Input Validation', () => {
    it('should validate subscription data format', async () => {
      mockValidation.validateSubscriptionData.mockImplementation((req, res, next) => {
        if (!req.body.priceId || typeof req.body.priceId !== 'string') {
          return res.status(400).json({ error: 'Invalid price ID format' });
        }
        next();
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 123 })
        .expect(400);
    });

    it('should validate price ID format', async () => {
      mockValidation.validatePriceId.mockImplementation((req, res, next) => {
        const { priceId } = req.body;
        if (!/^price_[a-zA-Z0-9]+$/.test(priceId)) {
          return res.status(400).json({ error: 'Invalid price ID format' });
        }
        next();
      });

      await request(app)
        .post('/api/subscriptions/checkout')
        .send({ priceId: 'invalid_format' })
        .expect(400);
    });

    it('should validate webhook signature format', async () => {
      mockValidation.validateWebhookSignature.mockImplementation((req, res, next) => {
        const signature = req.headers['stripe-signature'];
        if (!signature || !signature.includes('t=') || !signature.includes('v1=')) {
          return res.status(400).json({ error: 'Invalid webhook signature format' });
        }
        next();
      });

      await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'invalid_format')
        .send({ type: 'invoice.payment_succeeded' })
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller exceptions', async () => {
      mockSubscriptionController.createSubscription.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(500);
    });

    it('should handle async controller errors', async () => {
      mockSubscriptionController.getSubscription.mockImplementation(async (req, res) => {
        throw new Error('Async controller error');
      });

      await request(app)
        .get('/api/subscriptions/sub_123')
        .expect(500);
    });

    it('should handle middleware errors', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        next(new Error('Auth middleware error'));
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(500);
    });

    it('should handle validation errors', async () => {
      mockValidation.validateSubscriptionData.mockImplementation((req, res, next) => {
        next(new Error('Validation error'));
      });

      await request(app)
        .post('/api/subscriptions')
        .send({ priceId: 'price_123' })
        .expect(500);
    });
  });

  describe('HTTP Methods', () => {
    it('should reject unsupported HTTP methods', async () => {
      await request(app)
        .patch('/api/subscriptions')
        .expect(404);

      await request(app)
        .options('/api/subscriptions/sub_123')
        .expect(404);
    });

    it('should handle HEAD requests', async () => {
      await request(app)
        .head('/api/subscriptions')
        .expect(200);
    });
  });

  describe('Content-Type Handling', () => {
    it('should handle JSON content type', async () => {
      mockSubscriptionController.createSubscription.mockImplementation((req, res) => {
        res.status(201).json({ id: 'sub_123' });
      });

      await request(app)
        .post('/api/subscriptions')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ priceId: 'price_123' }))
        .expect(201);
    });

    it('should handle raw content type for webhooks', async () => {
      mockSubscriptionController.handleWebhook.mockImplementation((req, res) => {
        res.status(200).json({ received: true });
      });

      await request(app)
        .post('/api/subscriptions/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'valid_signature')
        .send(Buffer.from(JSON.stringify({ type: 'invoice.payment_succeeded' })))
        .expect(200);
    });

    it('should reject non-JSON content types for regular endpoints', async () => {
      await request(app)
        .post('/api/subscriptions')
        .set('Content-Type', 'text/plain')
        .send('priceId=price_123')
        .expect(400);
    });
  });
});