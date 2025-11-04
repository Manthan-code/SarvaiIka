const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');

describe('Error Routes Integration Tests', () => {
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

  describe('CORS Preflight', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await request(app)
        .options('/api/errors/report')
        .set('Origin', 'http://localhost:8080')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
  });

  describe('POST /api/errors/report', () => {
    it('should accept error reports from authenticated users', async () => {
      const errorData = {
        message: 'Test error message',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('errorId');
      expect(typeof response.body.errorId).toBe('string');
    });

    it('should accept error reports from unauthenticated users', async () => {
      const errorData = {
        message: 'Anonymous error message',
        stack: 'Error: Anonymous error\n    at anonymous.js:1:1',
        url: 'http://localhost:8080/login',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'warning',
        category: 'network'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(errorData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('errorId');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        message: 'Test error'
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should validate error severity levels', async () => {
      const errorData = {
        message: 'Test error message',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'invalid-severity',
        category: 'javascript'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('severity');
    });

    it('should validate error categories', async () => {
      const errorData = {
        message: 'Test error message',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'invalid-category'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('category');
    });

    it('should handle different error severities', async () => {
      const severities = ['info', 'warning', 'error', 'critical'];
      
      for (const severity of severities) {
        const errorData = {
          message: `Test ${severity} message`,
          stack: `Error: Test ${severity}\n    at test.js:1:1`,
          url: 'http://localhost:8080/dashboard',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date().toISOString(),
          severity: severity,
          category: 'javascript'
        };

        const response = await request(app)
          .post('/api/errors/report')
          .set('Authorization', `Bearer ${authToken}`)
          .send(errorData)
          .expect(201);

        expect(response.body.success).toBe(true);
      }
    });

    it('should handle different error categories', async () => {
      const categories = ['javascript', 'network', 'authentication', 'validation', 'server'];
      
      for (const category of categories) {
        const errorData = {
          message: `Test ${category} error`,
          stack: `Error: Test ${category}\n    at test.js:1:1`,
          url: 'http://localhost:8080/dashboard',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date().toISOString(),
          severity: 'error',
          category: category
        };

        const response = await request(app)
          .post('/api/errors/report')
          .set('Authorization', `Bearer ${authToken}`)
          .send(errorData)
          .expect(201);

        expect(response.body.success).toBe(true);
      }
    });

    it('should sanitize error messages', async () => {
      const errorData = {
        message: '<script>alert("xss")</script>Test error message',
        stack: '<img src=x onerror=alert("xss")>Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(201);

      expect(response.body.success).toBe(true);
      // The response should not contain script tags
      expect(response.body.message).not.toContain('<script>');
    });

    it('should handle very long error messages', async () => {
      const longMessage = 'a'.repeat(10000);
      const errorData = {
        message: longMessage,
        stack: 'Error: Long error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should include additional context when provided', async () => {
      const errorData = {
        message: 'Test error with context',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript',
        additionalContext: {
          userId: testUser.id,
          sessionId: 'test-session-123',
          feature: 'chat',
          action: 'send-message'
        }
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/errors', () => {
    beforeEach(async () => {
      // Create some test errors
      const errorData = {
        message: 'Test error for retrieval',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData);
    });

    it('should retrieve errors for admin users', async () => {
      const response = await request(app)
        .get('/api/errors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/errors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('admin');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/errors')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/errors?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should support filtering by severity', async () => {
      const response = await request(app)
        .get('/api/errors?severity=error')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support filtering by category', async () => {
      const response = await request(app)
        .get('/api/errors?category=javascript')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/errors?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/errors?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return proper error structure', async () => {
      const response = await request(app)
        .get('/api/errors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.data.length > 0) {
        const error = response.body.data[0];
        expect(error).toHaveProperty('id');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('severity');
        expect(error).toHaveProperty('category');
        expect(error).toHaveProperty('created_at');
        expect(error).toHaveProperty('url');
        expect(error).toHaveProperty('user_agent');
      }
    });
  });

  describe('GET /api/errors/:errorId', () => {
    let testErrorId;

    beforeEach(async () => {
      // Create a test error
      const errorData = {
        message: 'Test error for detailed retrieval',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const createResponse = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData);

      testErrorId = createResponse.body.errorId;
    });

    it('should retrieve specific error for admin', async () => {
      const response = await request(app)
        .get(`/api/errors/${testErrorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', testErrorId);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('stack');
      expect(response.body.data).toHaveProperty('severity');
      expect(response.body.data).toHaveProperty('category');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get(`/api/errors/${testErrorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate error ID format', async () => {
      const response = await request(app)
        .get('/api/errors/invalid-error-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent errors', async () => {
      const response = await request(app)
        .get('/api/errors/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/errors/:errorId/resolve', () => {
    let testErrorId;

    beforeEach(async () => {
      // Create a test error
      const errorData = {
        message: 'Test error for resolution',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const createResponse = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData);

      testErrorId = createResponse.body.errorId;
    });

    it('should mark error as resolved for admin', async () => {
      const response = await request(app)
        .patch(`/api/errors/${testErrorId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'Fixed in version 1.2.3' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .patch(`/api/errors/${testErrorId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ resolution: 'Fixed' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate resolution message', async () => {
      const response = await request(app)
        .patch(`/api/errors/${testErrorId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent errors', async () => {
      const response = await request(app)
        .patch('/api/errors/00000000-0000-0000-0000-000000000000/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'Fixed' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/errors/:errorId', () => {
    let testErrorId;

    beforeEach(async () => {
      // Create a test error
      const errorData = {
        message: 'Test error for deletion',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const createResponse = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData);

      testErrorId = createResponse.body.errorId;
    });

    it('should delete error for admin', async () => {
      const response = await request(app)
        .delete(`/api/errors/${testErrorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .delete(`/api/errors/${testErrorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent errors', async () => {
      const response = await request(app)
        .delete('/api/errors/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/errors/stats', () => {
    beforeEach(async () => {
      // Create some test errors with different severities
      const errorTypes = [
        { severity: 'error', category: 'javascript' },
        { severity: 'warning', category: 'network' },
        { severity: 'critical', category: 'server' }
      ];

      for (const errorType of errorTypes) {
        const errorData = {
          message: `Test ${errorType.severity} message`,
          stack: 'Error: Test error\n    at test.js:1:1',
          url: 'http://localhost:8080/dashboard',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date().toISOString(),
          severity: errorType.severity,
          category: errorType.category
        };

        await request(app)
          .post('/api/errors/report')
          .set('Authorization', `Bearer ${authToken}`)
          .send(errorData);
      }
    });

    it('should retrieve error statistics for admin', async () => {
      const response = await request(app)
        .get('/api/errors/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const stats = response.body.data;
      expect(stats).toHaveProperty('total_errors');
      expect(stats).toHaveProperty('by_severity');
      expect(stats).toHaveProperty('by_category');
      expect(stats).toHaveProperty('recent_errors');
      expect(stats).toHaveProperty('error_rate');
      
      expect(typeof stats.total_errors).toBe('number');
      expect(typeof stats.by_severity).toBe('object');
      expect(typeof stats.by_category).toBe('object');
      expect(Array.isArray(stats.recent_errors)).toBe(true);
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/errors/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should support date range for statistics', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/errors/stats?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('period_start');
      expect(response.body.data).toHaveProperty('period_end');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock Supabase to throw an error
      const mockSupabase = require('@supabase/supabase-js');
      const originalFrom = mockSupabase.createClient().from;
      
      mockSupabase.createClient().from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database connection failed')
        })
      });

      const errorData = {
        message: 'Test error message',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original
      mockSupabase.createClient().from = originalFrom;
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security', () => {
    it('should include security headers in error responses', async () => {
      const response = await request(app)
        .get('/api/errors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should enforce rate limiting on error reporting', async () => {
      const errorData = {
        message: 'Rate limit test error',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const requests = Array(50).fill().map(() => 
        request(app)
          .post('/api/errors/report')
          .set('Authorization', `Bearer ${authToken}`)
          .send(errorData)
      );

      const responses = await Promise.all(requests);
      
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent error reports', async () => {
      const errorData = {
        message: 'Concurrent test error',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const concurrentRequests = Array(5).fill().map(() => 
        request(app)
          .post('/api/errors/report')
          .set('Authorization', `Bearer ${authToken}`)
          .send(errorData)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect([201, 429]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.success).toBe(true);
        }
      });
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const errorData = {
        message: 'Performance test error',
        stack: 'Error: Test error\n    at test.js:1:1',
        url: 'http://localhost:8080/dashboard',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'javascript'
      };

      const response = await request(app)
        .post('/api/errors/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(errorData)
        .expect(201);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(3000); // 3 seconds max
    });
  });
});