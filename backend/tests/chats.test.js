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
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    })),
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    },
  })),
}));

describe('Chats API', () => {
    it('should fetch chats with pagination', async () => {
        const res = await request(app)
            .get('/api/chats?limit=5&offset=0');

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
