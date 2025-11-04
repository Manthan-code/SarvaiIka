const request = require('supertest');
const app = require('../app.js');

// Mock authentication middleware
jest.mock('../src/middlewares/authMiddleware.js', () => ({
  requireAuth: (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'admin-token') {
      req.user = { id: 'admin-user-id', email: 'admin@example.com', role: 'admin' };
    } else if (token === 'mocked-user-jwt') {
      req.user = { id: 'user-id', email: 'user@example.com', role: 'user' };
    } else {
      req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    }
    next();
  },
  requireRole: (role) => (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'admin-token' && role === 'admin') {
      req.user = { id: 'admin-user-id', email: 'admin@example.com', role: 'admin' };
      next();
    } else if (token === 'mocked-user-jwt' && role !== 'admin') {
      req.user = { id: 'user-id', email: 'user@example.com', role: 'user' };
      next();
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockImplementation((token) => {
        if (token === 'admin-token') {
          return Promise.resolve({
            data: { user: { id: 'admin-user-id', email: 'admin@example.com' } },
            error: null
          });
        } else if (token === 'mocked-user-jwt') {
          return Promise.resolve({
            data: { user: { id: 'user-id', email: 'user@example.com' } },
            error: null
          });
        }
        return Promise.resolve({
          data: { user: { id: 'test-user-id', email: 'test@example.com' } },
          error: null
        });
      }),
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'new-user-id' } },
        error: null
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null
      })
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => {
      // Mock the profile query for admin check
      const authHeader = global.mockAuthHeader;
      if (authHeader === 'Bearer admin-token') {
        return Promise.resolve({
          data: { id: 'admin-user-id', email: 'admin@example.com', role: 'admin' },
          error: null
        });
      }
      return Promise.resolve({
        data: { id: 'test-user-id', email: 'test@example.com', role: 'user' },
        error: null
      });
    })
  })
}));

describe('Auth Routes', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
  });

  it('should login an existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('access_token');
  });
});

describe('Role-Based Access Control (RBAC)', () => {
  it('should allow access to admin-only route for admin users', async () => {
    const adminToken = 'admin-token'; // Corrected token for admin user
    
    // Set global mock auth header for Supabase mock
    global.mockAuthHeader = `Bearer ${adminToken}`;

    const res = await request(app)
      .get('/api/auth/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Admin access granted');
    
    // Clean up
    delete global.mockAuthHeader;
  });

  it('should deny access to admin-only route for non-admin users', async () => {
    const userToken = 'mocked-user-jwt'; // Mocked JWT for regular user

    const res = await request(app)
      .get('/api/auth/admin')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('error', 'Access denied');
  });
});
