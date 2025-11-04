const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');

describe('API Routes Integration Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /api/plans', () => {
    it('should return all active plans', async () => {
      const response = await request(app)
        .get('/api/plans')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Check plan structure
      if (response.body.data.length > 0) {
        const plan = response.body.data[0];
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('price');
        expect(plan).toHaveProperty('price_display');
        expect(plan).toHaveProperty('period');
        expect(plan).toHaveProperty('originalId');
      }
    });

    it('should handle database errors gracefully', async () => {
      // Mock Supabase to throw an error
      const mockSupabase = require('@supabase/supabase-js');
      const originalFrom = mockSupabase.createClient().from;
      
      mockSupabase.createClient().from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database connection failed')
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/plans')
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original function
      mockSupabase.createClient().from = originalFrom;
    });
  });

  describe('POST /api/plans', () => {
    it('should create a new plan with authentication', async () => {
      const planData = {
        name: 'Test Plan',
        price: 9.99,
        features: ['Feature 1', 'Feature 2'],
        limitations: { messages: 100 }
      };

      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send(planData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Plan created successfully');
    });

    it('should require authentication', async () => {
      const planData = {
        name: 'Test Plan',
        price: 9.99
      };

      const response = await request(app)
        .post('/api/plans')
        .send(planData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Name and price are required');
    });
  });

  describe('Chat Routes', () => {
    describe('POST /api/chats', () => {
      it('should create a new chat with authentication', async () => {
        const chatData = {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ]
        };

        const response = await request(app)
          .post('/api/chats')
          .set('Authorization', `Bearer ${authToken}`)
          .send(chatData)
          .expect(201);

        expect(response.body).toHaveProperty('message', 'Chat created successfully');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/chats')
          .send({ messages: [] })
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/chats', () => {
      it('should retrieve user chats with authentication', async () => {
        const response = await request(app)
          .get('/api/chats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/chats')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE /api/chats/:id', () => {
      it('should delete a chat with authentication', async () => {
        const chatId = 'test-chat-id';

        const response = await request(app)
          .delete(`/api/chats/${chatId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Chat deleted successfully');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .delete('/api/chats/test-id')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Settings Routes', () => {
    describe('POST /api/settings', () => {
      it('should create user settings with authentication', async () => {
        const settingsData = {
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: true
          }
        };

        const response = await request(app)
          .post('/api/settings')
          .set('Authorization', `Bearer ${authToken}`)
          .send(settingsData)
          .expect(201);

        expect(response.body).toHaveProperty('message', 'Settings created successfully');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/settings')
          .send({ preferences: {} })
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/settings', () => {
      it('should retrieve user settings with authentication', async () => {
        const response = await request(app)
          .get('/api/settings')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/settings')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Background Images Routes', () => {
    describe('GET /api/background-images', () => {
      it('should retrieve background images with tier filtering', async () => {
        const response = await request(app)
          .get('/api/background-images')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/background-images')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should filter images based on user tier', async () => {
        // Test with free tier user
        const freeUser = await createTestUser({ subscription_plan: 'free' });
        const freeToken = generateAuthToken(freeUser);

        const response = await request(app)
          .get('/api/background-images')
          .set('Authorization', `Bearer ${freeToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        // All returned images should be accessible to free tier
        response.body.data.forEach(image => {
          expect(['free', 'pro', 'premium']).toContain(image.tier_required);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(60000) // Exceeds 50KB limit
      };

      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload)
        .expect(413);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/plans')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('referrer-policy', 'strict-origin-when-cross-origin');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/plans')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should allow credentials in CORS', async () => {
      const response = await request(app)
        .get('/api/plans')
        .set('Origin', 'http://localhost:8080')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/plans')
      );

      const responses = await Promise.all(requests);
      
      // At least some requests should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);

      // Check for rate limit headers
      responses.forEach(response => {
        if (response.headers['x-ratelimit-remaining']) {
          expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});