const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');

describe('Chat Routes Integration Tests', () => {
  let testUser;
  let authToken;
  let sessionId;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
    sessionId = `test-session-${Date.now()}`;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /api/chat', () => {
    it('should send a text message and receive AI response', async () => {
      const messageData = {
        message: 'Hello, how are you?',
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data).toHaveProperty('role', 'assistant');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('should handle coding-related queries', async () => {
      const messageData = {
        message: 'Write a Python function to calculate fibonacci numbers',
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBeDefined();
      expect(response.body.data.role).toBe('assistant');
    });

    it('should handle image generation requests', async () => {
      const messageData = {
        message: 'Generate an image of a sunset over mountains',
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should handle diagram generation requests', async () => {
      const messageData = {
        message: 'Create a flowchart showing the software development lifecycle',
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should require authentication', async () => {
      const messageData = {
        message: 'Hello',
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .send(messageData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate message content', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId: sessionId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Message is required');
    });

    it('should handle subscription plan restrictions', async () => {
      // Create a free tier user
      const freeUser = await createTestUser({ subscription_plan: 'free' });
      const freeToken = generateAuthToken(freeUser);

      const messageData = {
        message: 'This is a complex query that might require premium features',
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${freeToken}`)
        .send(messageData);

      // Should either succeed or return 403 for plan restrictions
      expect([200, 403]).toContain(response.status);

      if (response.status === 403) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('subscription plan');
      }
    });

    it('should handle long messages within limits', async () => {
      const longMessage = 'This is a test message. '.repeat(100); // ~2400 characters
      
      const messageData = {
        message: longMessage,
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject extremely long messages', async () => {
      const veryLongMessage = 'x'.repeat(50000); // 50KB
      
      const messageData = {
        message: veryLongMessage,
        sessionId: sessionId
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(413);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/chat/history/:sessionId', () => {
    beforeEach(async () => {
      // Send a message to create history
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test message for history',
          sessionId: sessionId
        });
    });

    it('should retrieve chat history for a session', async () => {
      const response = await request(app)
        .get(`/api/chat/history/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/chat/history/${sessionId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent sessions', async () => {
      const response = await request(app)
        .get('/api/chat/history/non-existent-session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('DELETE /api/chat/history/:sessionId', () => {
    beforeEach(async () => {
      // Send a message to create history
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test message for deletion',
          sessionId: sessionId
        });
    });

    it('should delete chat history for a session', async () => {
      const response = await request(app)
        .delete(`/api/chat/history/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Chat history deleted successfully');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/chat/history/${sessionId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/chat/sessions', () => {
    it('should retrieve user chat sessions', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/chat/sessions')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/chat/sessions?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service errors gracefully', async () => {
      // Mock AI service to throw an error
      const mockRouterAgent = require('../../src/services/routerAgent');
      const originalAnalyzeQuery = mockRouterAgent.analyzeQuery;
      
      mockRouterAgent.analyzeQuery = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test message',
          sessionId: sessionId
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original function
      mockRouterAgent.analyzeQuery = originalAnalyzeQuery;
    });

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

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test message',
          sessionId: sessionId
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original function
      mockSupabase.createClient().from = originalFrom;
    });

    it('should handle cache service errors gracefully', async () => {
      // Mock cache service to throw an error
      const mockCacheService = require('../../src/services/cacheService');
      const originalGet = mockCacheService.get;
      
      mockCacheService.get = jest.fn().mockRejectedValue(new Error('Cache service unavailable'));

      const response = await request(app)
        .get(`/api/chat/history/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // Should still work without cache

      expect(response.body.success).toBe(true);

      // Restore original function
      mockCacheService.get = originalGet;
    });
  });

  describe('Performance', () => {
    it('should handle concurrent chat requests', async () => {
      const concurrentRequests = Array(5).fill().map((_, index) => 
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: `Concurrent message ${index}`,
            sessionId: `${sessionId}-concurrent-${index}`
          })
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
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Quick test message',
          sessionId: sessionId
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(30000); // 30 seconds max
    });
  });

  describe('Security', () => {
    it('should sanitize user input', async () => {
      const maliciousMessage = '<script>alert("xss")</script>Hello';
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: maliciousMessage,
          sessionId: sessionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // The response should not contain the script tag
      expect(response.body.data.content).not.toContain('<script>');
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionMessage = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: sqlInjectionMessage,
          sessionId: sessionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should handle the message safely
    });

    it('should enforce rate limiting for chat endpoints', async () => {
      const rapidRequests = Array(20).fill().map(() => 
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Rate limit test',
            sessionId: sessionId
          })
      );

      const responses = await Promise.all(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });
  });
});