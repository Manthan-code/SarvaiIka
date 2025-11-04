const request = require('supertest');
const app = require('../app.js');

// Mock authentication middleware
jest.mock('../src/middlewares/authMiddleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
  requireRole: (role) => (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: role };
    next();
  }
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: [],
      error: null
    }),
    single: jest.fn().mockResolvedValue({
      data: { id: 'test-user-id', email: 'test@example.com', role: 'user' },
      error: null
    })
  })
}));

// Mock Supabase admin client
jest.mock('../src/db/supabase/admin.js', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({
    data: [],
    error: null
  })
}));

// Mock Redis helpers
jest.mock('../src/redis/redisHelpers.js', () => ({
  getCachedResponse: jest.fn().mockResolvedValue(null),
  cacheResponse: jest.fn().mockResolvedValue(true),
  invalidateCache: jest.fn().mockResolvedValue(true)
}));

describe('Subscriptions API', () => {
    it('should fetch subscriptions with pagination', async () => {
        const res = await request(app)
            .get('/api/subscriptions?limit=5&offset=0');

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
