const request = require('supertest');
const app = require('../app.js');

// Mock Redis helpers to avoid Redis client issues
jest.mock('../src/redis/redisHelpers.js', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
  cacheResponse: jest.fn().mockResolvedValue(undefined),
  getCachedResponse: jest.fn().mockResolvedValue(null),
  invalidateCache: jest.fn().mockResolvedValue(0),
  invalidateUserCache: jest.fn().mockResolvedValue(0),
  invalidateKey: jest.fn().mockResolvedValue(0),
  clearAllCache: jest.fn().mockResolvedValue(0),
  getCacheStats: jest.fn().mockResolvedValue({ keys: 0, memory: 0 })
}));

// Mock Redis clients
jest.mock('../src/redis/redisClient.js', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/redis/client.js', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined)
}));

// Mock Supabase client with comprehensive chat session support
jest.mock('../src/db/supabase/client', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { 
        id: 'mock-session-id',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        messages: [],
        created_at: new Date().toISOString()
      },
      error: null
    }),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ 
          data: {
            id: 'mock-session-id',
            user_id: '550e8400-e29b-41d4-a716-446655440000',
            created_at: new Date().toISOString()
          },
          error: null
        }),
      })),
    })),
  })),
}));

// Mock Supabase admin client
jest.mock('../src/db/supabase/admin', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { 
        id: 'mock-session-id',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        messages: [],
        created_at: new Date().toISOString()
      },
      error: null
    }),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ 
          data: {
            id: 'mock-session-id',
            user_id: '550e8400-e29b-41d4-a716-446655440000',
            created_at: new Date().toISOString()
          },
          error: null
        }),
      })),
    })),
  })),
}));

jest.mock('../src/services/routerAgent', () => ({
  analyzeQuery: jest.fn().mockResolvedValue({ intent: 'test', complexity: 'low', content_type: 'text' }),
  routeQuery: jest.fn().mockResolvedValue({
    intent: 'text',
    difficulty: 'low',
    model: 'gpt-3.5-turbo',
    allowed: true,
    downgraded: false
  }),
}));

jest.mock('../src/middlewares/usageMiddleware', () => ({
  trackUsage: jest.fn((req, res, next) => next()),
  updateUsage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/middlewares/authMiddleware', () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.user = { id: '550e8400-e29b-41d4-a716-446655440000', plan: 'free' };
    req.profile = { subscription_plan: 'free' };
    next();
  }),
}));

jest.mock('../src/redis/redisClient', () => ({
  on: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(true),
  quit: jest.fn().mockResolvedValue(true),
  setex: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/services/vectorService', () => ({
  generateChatResponse: jest.fn().mockResolvedValue('Mocked response from AI'),
}));

describe('Chat Routes', () => {
  it('should send a chat message', async () => {
    // Add debug log to confirm request is being sent
    console.log('Sending request to /api/chat');

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer mocked-user-jwt')
      .send({ message: 'Hello AI' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('output');
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body).toHaveProperty('model');
    expect(res.body.output).toContain('Hello');
    expect(res.body.sessionId).toBe('mock-session-id');
  });
});
