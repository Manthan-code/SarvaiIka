const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');

describe('Admin Routes Integration Tests', () => {
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;
  let testUserId;

  beforeAll(async () => {
    adminUser = await createTestUser({ role: 'admin' });
    adminToken = generateAuthToken(adminUser);
    
    regularUser = await createTestUser({ role: 'user' });
    regularToken = generateAuthToken(regularUser);
    
    testUserId = regularUser.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('CORS Preflight', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await request(app)
        .options('/api/admin/users')
        .set('Origin', 'http://localhost:8080')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should retrieve all users for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Check user structure
      if (response.body.data.length > 0) {
        const user = response.body.data[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('created_at');
      }
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('admin');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('PATCH /api/admin/users/:userId', () => {
    it('should update user for admin', async () => {
      const updateData = {
        subscription_plan: 'pro',
        role: 'user'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require admin authentication', async () => {
      const updateData = {
        subscription_plan: 'pro'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate user ID', async () => {
      const updateData = {
        subscription_plan: 'pro'
      };

      const response = await request(app)
        .patch('/api/admin/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate update data', async () => {
      const invalidData = {
        subscription_plan: 'invalid-plan'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent users', async () => {
      const updateData = {
        subscription_plan: 'pro'
      };

      const response = await request(app)
        .patch('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    let userToDelete;

    beforeEach(async () => {
      userToDelete = await createTestUser();
    });

    it('should delete user for admin', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate user ID', async () => {
      const response = await request(app)
        .delete('/api/admin/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent users', async () => {
      const response = await request(app)
        .delete('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/system/config', () => {
    it('should retrieve system configuration for admin', async () => {
      const response = await request(app)
        .get('/api/admin/system/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const config = response.body.data;
      expect(config).toHaveProperty('site_name');
      expect(config).toHaveProperty('site_description');
      expect(config).toHaveProperty('maintenance_mode');
      expect(config).toHaveProperty('registration_enabled');
      expect(config).toHaveProperty('max_users');
      expect(config).toHaveProperty('rate_limit_per_minute');
      expect(config).toHaveProperty('enable_subscriptions');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/system/config')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/admin/system/config', () => {
    it('should update system configuration for admin', async () => {
      const configUpdate = {
        maintenance_mode: false,
        registration_enabled: true,
        max_users: 1000
      };

      const response = await request(app)
        .patch('/api/admin/system/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(configUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require admin authentication', async () => {
      const configUpdate = {
        maintenance_mode: false
      };

      const response = await request(app)
        .patch('/api/admin/system/config')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(configUpdate)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate configuration values', async () => {
      const invalidConfig = {
        max_users: -1,
        rate_limit_per_minute: 'invalid'
      };

      const response = await request(app)
        .patch('/api/admin/system/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Background Images Management', () => {
    describe('GET /api/admin/background-images', () => {
      it('should retrieve all background images for admin', async () => {
        const response = await request(app)
          .get('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should require admin authentication', async () => {
        const response = await request(app)
          .get('/api/admin/background-images')
          .set('Authorization', `Bearer ${regularToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/admin/background-images', () => {
      it('should create background image for admin', async () => {
        const imageData = {
          name: 'Test Background',
          description: 'A test background image',
          url: 'https://example.com/image.jpg',
          thumbnail_url: 'https://example.com/thumb.jpg',
          category: 'nature',
          tier_required: 'free'
        };

        const response = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(imageData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id');
      });

      it('should require admin authentication', async () => {
        const imageData = {
          name: 'Test Background',
          url: 'https://example.com/image.jpg'
        };

        const response = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${regularToken}`)
          .send(imageData)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate URLs', async () => {
        const imageData = {
          name: 'Test Background',
          url: 'invalid-url',
          tier_required: 'free'
        };

        const response = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(imageData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate tier values', async () => {
        const imageData = {
          name: 'Test Background',
          url: 'https://example.com/image.jpg',
          tier_required: 'invalid-tier'
        };

        const response = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(imageData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PATCH /api/admin/background-images/:imageId', () => {
      let testImageId;

      beforeEach(async () => {
        // Create a test image first
        const imageData = {
          name: 'Test Background for Update',
          url: 'https://example.com/image.jpg',
          tier_required: 'free'
        };

        const createResponse = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(imageData);

        testImageId = createResponse.body.data.id;
      });

      it('should update background image for admin', async () => {
        const updateData = {
          name: 'Updated Background',
          description: 'Updated description',
          tier_required: 'pro'
        };

        const response = await request(app)
          .patch(`/api/admin/background-images/${testImageId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
      });

      it('should require admin authentication', async () => {
        const updateData = {
          name: 'Updated Background'
        };

        const response = await request(app)
          .patch(`/api/admin/background-images/${testImageId}`)
          .set('Authorization', `Bearer ${regularToken}`)
          .send(updateData)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate image ID', async () => {
        const updateData = {
          name: 'Updated Background'
        };

        const response = await request(app)
          .patch('/api/admin/background-images/invalid-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE /api/admin/background-images/:imageId', () => {
      let testImageId;

      beforeEach(async () => {
        // Create a test image first
        const imageData = {
          name: 'Test Background for Deletion',
          url: 'https://example.com/image.jpg',
          tier_required: 'free'
        };

        const createResponse = await request(app)
          .post('/api/admin/background-images')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(imageData);

        testImageId = createResponse.body.data.id;
      });

      it('should delete background image for admin', async () => {
        const response = await request(app)
          .delete(`/api/admin/background-images/${testImageId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message');
      });

      it('should require admin authentication', async () => {
        const response = await request(app)
          .delete(`/api/admin/background-images/${testImageId}`)
          .set('Authorization', `Bearer ${regularToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate image ID', async () => {
        const response = await request(app)
          .delete('/api/admin/background-images/invalid-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock Supabase to throw an error
      const mockSupabase = require('@supabase/supabase-js');
      const originalFrom = mockSupabase.createClient().from;
      
      mockSupabase.createClient().from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection failed')
          })
        })
      });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore original function
      mockSupabase.createClient().from = originalFrom;
    });

    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security', () => {
    it('should include security headers in admin responses', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should prevent privilege escalation', async () => {
      // Regular user trying to make themselves admin
      const updateData = {
        role: 'admin'
      };

      const response = await request(app)
        .patch(`/api/admin/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Test Background',
        description: '<img src=x onerror=alert("xss")>',
        url: 'https://example.com/image.jpg',
        tier_required: 'free'
      };

      const response = await request(app)
        .post('/api/admin/background-images')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.success).toBe(true);
      // The response should not contain script tags
      expect(response.body.data.name).not.toContain('<script>');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent admin requests', async () => {
      const concurrentRequests = Array(5).fill().map(() => 
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
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
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});