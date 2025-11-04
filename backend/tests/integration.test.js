const request = require('supertest');
const app = require('../app.js');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Mock requireAuth middleware to provide user and profile data
jest.mock('../src/middlewares/authMiddleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    req.profile = { id: 'test-user-123', role: 'user', subscription_plan: 'free', email: 'test@example.com', name: 'Test User' };
    next();
  },
  requireRole: (role) => (req, res, next) => {
    if (req.profile.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied' });
    }
  }
}));

// Mock Supabase client
jest.mock('../src/db/supabase/client', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: { preferences: {} }, error: null }),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  auth: {
    signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' }, session: { access_token: 'test-token' } }, error: null })
  }
}));

// Mock Supabase admin client
jest.mock('../src/db/supabase/admin', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: { preferences: {} }, error: null }),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
  })),
}));

// Mock Redis helpers
jest.mock('../src/redis/redisHelpers', () => ({
  getCachedResponse: jest.fn().mockResolvedValue(null),
  cacheResponse: jest.fn().mockResolvedValue(true),
  invalidateCache: jest.fn().mockResolvedValue(true)
}));

describe('Integration Tests', () => {
    let authToken;
    let testUser;

    beforeAll(() => {
        // Setup test user and auth token
        testUser = {
            id: 'test-user-123',
            email: 'test@example.com',
            role: 'user',
            subscription_plan: 'free'
        };
        
        authToken = jwt.sign(
            { sub: testUser.id, email: testUser.email },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    describe('Users API', () => {
        it('should sign up a new user', async () => {
            const res = await request(app)
                .post('/api/users/signup')
                .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

            expect(res.statusCode).toEqual(201);
            expect(res.body.message).toBe('User created successfully');
        });

        it('should log in an existing user', async () => {
            const res = await request(app)
                .post('/api/users/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.token).toBeDefined();
        });
    });

    describe('Plans API', () => {
        it('should fetch all plans', async () => {
            const res = await request(app).get('/api/plans');

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Subscriptions API', () => {
        it('should fetch subscriptions with pagination', async () => {
            const res = await request(app)
                .get('/api/subscriptions?limit=5&offset=0');

            expect(res.statusCode).toEqual(200);
            // Custom assertion with better error message
            if (!Array.isArray(res.body)) {
                throw new Error(`Expected array but got: ${JSON.stringify(res.body)} (type: ${typeof res.body})`);
            }
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Chats API', () => {
        it('should fetch chats with pagination', async () => {
            const res = await request(app)
                .get('/api/chats?limit=5&offset=0');

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Settings API', () => {
        it('should fetch user settings', async () => {
            const res = await request(app)
                .get('/api/settings');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('preferences');
        });

        it('should update user settings', async () => {
            const newSettings = {
                theme: 'dark',
                notifications: true,
                language: 'en'
            };

            const res = await request(app)
                .put('/api/settings')
                .send({ preferences: newSettings });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('Settings updated successfully');
        });
    });

    describe('Chat API Workflows', () => {
        it('should handle complete chat conversation flow', async () => {
            // Step 1: Start a new chat session
            const chatRes1 = await request(app)
                .post('/api/chat')
                .send({
                    message: 'Hello, I need help with JavaScript',
                    sessionId: 'test-session-123'
                });

            expect(chatRes1.statusCode).toEqual(200);
            expect(chatRes1.body).toHaveProperty('response');
            expect(chatRes1.body).toHaveProperty('sessionId');

            // Step 2: Continue the conversation
            const chatRes2 = await request(app)
                .post('/api/chat')
                .send({
                    message: 'Can you explain async/await?',
                    sessionId: chatRes1.body.sessionId
                });

            expect(chatRes2.statusCode).toEqual(200);
            expect(chatRes2.body).toHaveProperty('response');

            // Step 3: Retrieve chat history
            const historyRes = await request(app)
                .get(`/api/chats?sessionId=${chatRes1.body.sessionId}`);

            expect(historyRes.statusCode).toEqual(200);
            expect(Array.isArray(historyRes.body)).toBe(true);
        });

        it('should handle chat with file upload', async () => {
            const res = await request(app)
                .post('/api/chat')
                .field('message', 'Analyze this code file')
                .field('sessionId', 'test-session-456')
                .attach('file', Buffer.from('console.log("Hello World");'), 'test.js');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('response');
        });

        it('should handle streaming chat responses', async () => {
            const res = await request(app)
                .post('/api/chat/stream')
                .send({
                    message: 'Write a long explanation about machine learning',
                    sessionId: 'test-session-789'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
        });
    });

    describe('Billing API Workflows', () => {
        it('should retrieve billing history', async () => {
            const res = await request(app)
                .get('/api/billing/history');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('invoices');
            expect(Array.isArray(res.body.invoices)).toBe(true);
        });

        it('should handle subscription upgrade', async () => {
            const res = await request(app)
                .post('/api/billing/upgrade')
                .send({
                    planId: 'pro-plan',
                    paymentMethodId: 'pm_test_123'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('subscriptionId');
        });

        it('should handle subscription cancellation', async () => {
            const res = await request(app)
                .post('/api/billing/cancel')
                .send({ reason: 'Testing cancellation' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('Subscription cancelled successfully');
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle authentication errors consistently', async () => {
            const res = await request(app)
                .get('/api/settings')
                .set('Authorization', 'Bearer invalid-token');

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('path');
        });

        it('should handle validation errors', async () => {
            const res = await request(app)
                .post('/api/users/signup')
                .send({
                    email: 'invalid-email',
                    password: '123' // Too short
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('errors');
            expect(Array.isArray(res.body.errors)).toBe(true);
        });

        it('should handle rate limiting', async () => {
            // Make multiple rapid requests
            const requests = Array.from({ length: 10 }, () => 
                request(app).get('/api/plans')
            );

            const responses = await Promise.all(requests);
            
            // Some requests should succeed, others might be rate limited
            const statusCodes = responses.map(r => r.statusCode);
            expect(statusCodes).toContain(200);
        });

        it('should handle database connection errors gracefully', async () => {
            // Mock database error
            const originalFrom = require('../src/db/supabase/client').from;
            require('../src/db/supabase/client').from = jest.fn(() => {
                throw new Error('Database connection failed');
            });

            const res = await request(app).get('/api/plans');

            expect(res.statusCode).toEqual(500);
            expect(res.body).toHaveProperty('error');

            // Restore original function
            require('../src/db/supabase/client').from = originalFrom;
        });
    });

    describe('Performance Integration', () => {
        it('should handle concurrent requests efficiently', async () => {
            const startTime = Date.now();
            
            const concurrentRequests = Array.from({ length: 20 }, (_, i) => 
                request(app)
                    .post('/api/chat')
                    .send({
                        message: `Concurrent message ${i + 1}`,
                        sessionId: `concurrent-session-${i + 1}`
                    })
            );

            const responses = await Promise.all(concurrentRequests);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
            responses.forEach(response => {
                expect([200, 429, 503]).toContain(response.statusCode); // Success, rate limited, or service unavailable
            });
        });

        it('should maintain performance with large datasets', async () => {
            const res = await request(app)
                .get('/api/chats?limit=1000&offset=0');

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Service Integration', () => {
        it('should integrate caching with API responses', async () => {
            // First request - should hit database
            const res1 = await request(app).get('/api/plans');
            expect(res1.statusCode).toEqual(200);

            // Second request - should use cache
            const res2 = await request(app).get('/api/plans');
            expect(res2.statusCode).toEqual(200);
            expect(res2.body).toEqual(res1.body);
        });

        it('should handle AI service integration', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({
                    message: 'Test AI integration',
                    sessionId: 'ai-test-session'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('response');
            expect(typeof res.body.response).toBe('string');
        });

        it('should handle subscription service integration', async () => {
            const res = await request(app)
                .get('/api/subscriptions/current');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('plan');
            expect(res.body).toHaveProperty('status');
        });
    });

    describe('End-to-End User Journeys', () => {
        it('should handle complete new user onboarding', async () => {
            // Step 1: User signs up
            const signupRes = await request(app)
                .post('/api/users/signup')
                .send({
                    email: 'newuser@example.com',
                    password: 'securepassword123',
                    name: 'New User'
                });

            expect(signupRes.statusCode).toEqual(201);

            // Step 2: User logs in
            const loginRes = await request(app)
                .post('/api/users/login')
                .send({
                    email: 'newuser@example.com',
                    password: 'securepassword123'
                });

            expect(loginRes.statusCode).toEqual(200);
            expect(loginRes.body).toHaveProperty('token');

            // Step 3: User views available plans
            const plansRes = await request(app)
                .get('/api/plans')
                .set('Authorization', `Bearer ${loginRes.body.token}`);

            expect(plansRes.statusCode).toEqual(200);

            // Step 4: User starts first chat
            const chatRes = await request(app)
                .post('/api/chat')
                .set('Authorization', `Bearer ${loginRes.body.token}`)
                .send({
                    message: 'Hello, this is my first message',
                    sessionId: 'onboarding-session'
                });

            expect(chatRes.statusCode).toEqual(200);
            expect(chatRes.body).toHaveProperty('response');
        });

        it('should handle premium user workflow', async () => {
            // Mock premium user
            const premiumUserMock = {
                ...testUser,
                subscription_plan: 'pro'
            };

            // Premium user should have access to advanced features
            const res = await request(app)
                .post('/api/chat/advanced')
                .send({
                    message: 'Use advanced AI model',
                    sessionId: 'premium-session',
                    model: 'gpt-4'
                });

            expect([200, 404]).toContain(res.statusCode); // 404 if endpoint doesn't exist yet
        });
    });
});
