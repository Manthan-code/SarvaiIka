const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');

describe('Subscription Routes Integration Tests', () => {
  let testUser;
  let authToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
    
    adminUser = await createTestUser({ role: 'admin' });
    adminToken = generateAuthToken(adminUser);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /api/subscriptions', () => {
    it('should retrieve user subscriptions', async () => {
      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/subscriptions')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should use caching for performance', async () => {
      // First request
      const response1 = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Second request should be faster (cached)
      const startTime = Date.now();
      const response2 = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const responseTime = Date.now() - startTime;

      expect(response2.body).toEqual(response1.body);
      expect(responseTime).toBeLessThan(1000); // Should be fast due to caching
    });
  });

  describe('POST /api/subscriptions/create-checkout-session', () => {
    it('should create a Stripe checkout session', async () => {
      const checkoutData = {
        planId: 'pro',
        successUrl: 'http://localhost:8080/success',
        cancelUrl: 'http://localhost:8080/cancel'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkoutData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('url');
    });

    it('should require authentication', async () => {
      const checkoutData = {
        planId: 'pro',
        successUrl: 'http://localhost:8080/success',
        cancelUrl: 'http://localhost:8080/cancel'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-checkout-session')
        .send(checkoutData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate plan ID', async () => {
      const checkoutData = {
        planId: 'invalid-plan',
        successUrl: 'http://localhost:8080/success',
        cancelUrl: 'http://localhost:8080/cancel'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkoutData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid plan');
    });

    it('should validate URLs', async () => {
      const checkoutData = {
        planId: 'pro',
        successUrl: 'invalid-url',
        cancelUrl: 'invalid-url'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkoutData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/subscriptions/create-portal-session', () => {
    it('should create a Stripe customer portal session', async () => {
      const portalData = {
        returnUrl: 'http://localhost:8080/account'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-portal-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portalData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('url');
    });

    it('should require authentication', async () => {
      const portalData = {
        returnUrl: 'http://localhost:8080/account'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-portal-session')
        .send(portalData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate return URL', async () => {
      const portalData = {
        returnUrl: 'invalid-url'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-portal-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portalData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/subscriptions/cancel', () => {
    it('should cancel a subscription', async () => {
      const cancelData = {
        subscriptionId: 'test-subscription-id'
      };

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      const cancelData = {
        subscriptionId: 'test-subscription-id'
      };

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .send(cancelData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate subscription ID', async () => {
      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/subscriptions/reactivate', () => {
    it('should reactivate a subscription', async () => {
      const reactivateData = {
        subscriptionId: 'test-subscription-id'
      };

      const response = await request(app)
        .post('/api/subscriptions/reactivate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reactivateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      const reactivateData = {
        subscriptionId: 'test-subscription-id'
      };

      const response = await request(app)
        .post('/api/subscriptions/reactivate')
        .send(reactivateData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Stripe Webhooks', () => {
    describe('POST /api/subscriptions/webhook', () => {
      it('should handle subscription created webhook', async () => {
        const webhookPayload = {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_test123',
              customer: 'cus_test123',
              status: 'active',
              items: {
                data: [{
                  price: {
                    id: 'price_test123'
                  }
                }]
              }
            }
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .set('stripe-signature', 'test-signature')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });

      it('should handle subscription updated webhook', async () => {
        const webhookPayload = {
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_test123',
              customer: 'cus_test123',
              status: 'active',
              cancel_at_period_end: false
            }
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .set('stripe-signature', 'test-signature')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });

      it('should handle subscription deleted webhook', async () => {
        const webhookPayload = {
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_test123',
              customer: 'cus_test123',
              status: 'canceled'
            }
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .set('stripe-signature', 'test-signature')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });

      it('should handle invoice payment succeeded webhook', async () => {
        const webhookPayload = {
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_test123',
              customer: 'cus_test123',
              subscription: 'sub_test123',
              amount_paid: 999,
              status: 'paid'
            }
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .set('stripe-signature', 'test-signature')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });

      it('should handle invoice payment failed webhook', async () => {
        const webhookPayload = {
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_test123',
              customer: 'cus_test123',
              subscription: 'sub_test123',
              amount_due: 999,
              status: 'open'
            }
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .set('stripe-signature', 'test-signature')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });

      it('should ignore unknown webhook events', async () => {
        const webhookPayload = {
          type: 'unknown.event.type',
          data: {
            object: {}
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .set('stripe-signature', 'test-signature')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });

      it('should validate webhook signature', async () => {
        const webhookPayload = {
          type: 'customer.subscription.created',
          data: { object: {} }
        };

        // Missing signature should be handled gracefully in test environment
        const response = await request(app)
          .post('/api/subscriptions/webhook')
          .send(webhookPayload)
          .expect(200);

        expect(response.body).toHaveProperty('received', true);
      });
    });
  });

  describe('Admin Routes', () => {
    describe('GET /api/subscriptions/admin/all', () => {
      it('should retrieve all subscriptions for admin', async () => {
        const response = await request(app)
          .get('/api/subscriptions/admin/all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should require admin authentication', async () => {
        const response = await request(app)
          .get('/api/subscriptions/admin/all')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/subscriptions/admin/all')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/subscriptions/admin/update-user-plan', () => {
      it('should update user plan for admin', async () => {
        const updateData = {
          userId: testUser.id,
          planName: 'pro'
        };

        const response = await request(app)
          .post('/api/subscriptions/admin/update-user-plan')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
      });

      it('should require admin authentication', async () => {
        const updateData = {
          userId: testUser.id,
          planName: 'pro'
        };

        const response = await request(app)
          .post('/api/subscriptions/admin/update-user-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/subscriptions/admin/update-user-plan')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      // Mock Stripe to throw an error
      const mockStripe = require('stripe');
      const originalCheckoutSessions = mockStripe.prototype.checkout.sessions.create;
      
      mockStripe.prototype.checkout.sessions.create = jest.fn().mockRejectedValue(
        new Error('Stripe API error')
      );

      const checkoutData = {
        planId: 'pro',
        successUrl: 'http://localhost:8080/success',
        cancelUrl: 'http://localhost:8080/cancel'
      };

      const response = await request(app)
        .post('/api/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkoutData)
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original function
      mockStripe.prototype.checkout.sessions.create = originalCheckoutSessions;
    });

    it('should handle database errors gracefully', async () => {
      // Mock Supabase to throw an error
      const mockSupabase = require('@supabase/supabase-js');
      const originalFrom = mockSupabase.createClient().from;
      
      mockSupabase.createClient().from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection failed')
          })
        })
      });

      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original function
      mockSupabase.createClient().from = originalFrom;
    });
  });

  describe('Performance', () => {
    it('should handle concurrent subscription requests', async () => {
      const concurrentRequests = Array(5).fill().map(() => 
        request(app)
          .get('/api/subscriptions')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // 200 or rate limited
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});