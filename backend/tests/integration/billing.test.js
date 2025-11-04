const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');

describe('Billing Routes Integration Tests', () => {
  let testUser;
  let authToken;
  let premiumUser;
  let premiumToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
    
    premiumUser = await createTestUser({ subscription_plan: 'pro' });
    premiumToken = generateAuthToken(premiumUser);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('CORS Preflight', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await request(app)
        .options('/api/billing/history')
        .set('Origin', 'http://localhost:8080')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
  });

  describe('GET /api/billing/history', () => {
    it('should retrieve billing history for authenticated user', async () => {
      const response = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Check pagination metadata
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/billing/history')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('authentication');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/billing/history?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/billing/history?page=0&limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/billing/history?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should validate date range parameters', async () => {
      const response = await request(app)
        .get('/api/billing/history?startDate=invalid-date&endDate=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('date');
    });

    it('should support status filtering', async () => {
      const response = await request(app)
        .get('/api/billing/history?status=paid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should validate status parameter', async () => {
      const response = await request(app)
        .get('/api/billing/history?status=invalid-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('status');
    });

    it('should return proper billing history structure', async () => {
      // First create some billing history for premium user
      const response = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      if (response.body.data.length > 0) {
        const billingItem = response.body.data[0];
        expect(billingItem).toHaveProperty('id');
        expect(billingItem).toHaveProperty('amount');
        expect(billingItem).toHaveProperty('currency');
        expect(billingItem).toHaveProperty('status');
        expect(billingItem).toHaveProperty('description');
        expect(billingItem).toHaveProperty('created_at');
        expect(billingItem).toHaveProperty('invoice_url');
      }
    });

    it('should handle empty billing history gracefully', async () => {
      const response = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/billing/invoices/:invoiceId', () => {
    it('should retrieve specific invoice for authenticated user', async () => {
      // This test assumes there's at least one invoice
      const historyResponse = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      if (historyResponse.body.data.length > 0) {
        const invoiceId = historyResponse.body.data[0].id;
        
        const response = await request(app)
          .get(`/api/billing/invoices/${invoiceId}`)
          .set('Authorization', `Bearer ${premiumToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id', invoiceId);
        expect(response.body.data).toHaveProperty('amount');
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('line_items');
        expect(Array.isArray(response.body.data.line_items)).toBe(true);
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/billing/invoices/inv_test123')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate invoice ID format', async () => {
      const response = await request(app)
        .get('/api/billing/invoices/invalid-invoice-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invoice');
    });

    it('should handle non-existent invoices', async () => {
      const response = await request(app)
        .get('/api/billing/invoices/inv_nonexistent123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should prevent access to other users invoices', async () => {
      // Create invoice for premium user, try to access with regular user
      const historyResponse = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      if (historyResponse.body.data.length > 0) {
        const invoiceId = historyResponse.body.data[0].id;
        
        const response = await request(app)
          .get(`/api/billing/invoices/${invoiceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('access');
      }
    });
  });

  describe('GET /api/billing/usage', () => {
    it('should retrieve usage statistics for authenticated user', async () => {
      const response = await request(app)
        .get('/api/billing/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const usage = response.body.data;
      expect(usage).toHaveProperty('current_period');
      expect(usage).toHaveProperty('messages_sent');
      expect(usage).toHaveProperty('messages_limit');
      expect(usage).toHaveProperty('storage_used');
      expect(usage).toHaveProperty('storage_limit');
      expect(usage).toHaveProperty('api_calls');
      expect(usage).toHaveProperty('api_limit');
      
      // Validate data types
      expect(typeof usage.messages_sent).toBe('number');
      expect(typeof usage.messages_limit).toBe('number');
      expect(typeof usage.storage_used).toBe('number');
      expect(typeof usage.storage_limit).toBe('number');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/billing/usage')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should support date range for usage statistics', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/billing/usage?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('period_start');
      expect(response.body.data).toHaveProperty('period_end');
    });

    it('should show different usage for different subscription tiers', async () => {
      const freeUserResponse = await request(app)
        .get('/api/billing/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const premiumUserResponse = await request(app)
        .get('/api/billing/usage')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      expect(freeUserResponse.body.success).toBe(true);
      expect(premiumUserResponse.body.success).toBe(true);
      
      // Premium user should have higher limits
      expect(premiumUserResponse.body.data.messages_limit)
        .toBeGreaterThanOrEqual(freeUserResponse.body.data.messages_limit);
    });
  });

  describe('POST /api/billing/download-invoice/:invoiceId', () => {
    it('should generate download link for invoice', async () => {
      const historyResponse = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      if (historyResponse.body.data.length > 0) {
        const invoiceId = historyResponse.body.data[0].id;
        
        const response = await request(app)
          .post(`/api/billing/download-invoice/${invoiceId}`)
          .set('Authorization', `Bearer ${premiumToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('download_url');
        expect(response.body.data.download_url).toMatch(/^https?:\/\//);
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/billing/download-invoice/inv_test123')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate invoice ID', async () => {
      const response = await request(app)
        .post('/api/billing/download-invoice/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent access to other users invoices', async () => {
      const historyResponse = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      if (historyResponse.body.data.length > 0) {
        const invoiceId = historyResponse.body.data[0].id;
        
        const response = await request(app)
          .post(`/api/billing/download-invoice/${invoiceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      // Mock Stripe to throw an error
      const mockStripe = require('stripe');
      const originalInvoices = mockStripe.invoices;
      
      mockStripe.invoices = {
        list: jest.fn().mockRejectedValue(new Error('Stripe API error'))
      };

      const response = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('billing');

      // Restore original
      mockStripe.invoices = originalInvoices;
    });

    it('should handle database errors gracefully', async () => {
      // Mock Supabase to throw an error
      const mockSupabase = require('@supabase/supabase-js');
      const originalFrom = mockSupabase.createClient().from;
      
      mockSupabase.createClient().from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database connection failed')
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/billing/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original
      mockSupabase.createClient().from = originalFrom;
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/billing/download-invoice/inv_test123')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(1000000) // 1MB of data
      };

      const response = await request(app)
        .post('/api/billing/download-invoice/inv_test123')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload)
        .expect(413);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security', () => {
    it('should include security headers in billing responses', async () => {
      const response = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });

    it('should sanitize input parameters', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .get(`/api/billing/history?status=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toContain('<script>');
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjection = "'; DROP TABLE invoices; --";
      
      const response = await request(app)
        .get(`/api/billing/history?status=${encodeURIComponent(sqlInjection)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should enforce rate limiting', async () => {
      const requests = Array(20).fill().map(() => 
        request(app)
          .get('/api/billing/history')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent billing requests', async () => {
      const concurrentRequests = Array(5).fill().map(() => 
        request(app)
          .get('/api/billing/history')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should cache billing data appropriately', async () => {
      // First request
      const startTime1 = Date.now();
      const response1 = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const time1 = Date.now() - startTime1;

      // Second request (should be faster due to caching)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get('/api/billing/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const time2 = Date.now() - startTime2;

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(time2).toBeLessThanOrEqual(time1); // Second request should be faster or equal
    });
  });
});