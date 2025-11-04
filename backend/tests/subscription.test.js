const request = require('supertest');
const app = require('../app.js');

// Mock authentication middleware
jest.mock('../src/middlewares/authMiddleware.js', () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

// Mock Supabase admin client
jest.mock('../src/db/supabase/admin.js', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: {
        id: 'test-subscription-id',
        user_id: 'test-user-id',
        plan_id: '123',
        status: 'active',
        messages_limit: 1000,
        max_messages_per_month: 1000,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plans: { id: '123', name: 'Test Plan', max_messages_per_month: 1000 }
      }, 
      error: null 
    }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  })),
  auth: {
    admin: {
      createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    },
  },
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
    order: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { 
        id: 'test-subscription-id', 
        user_id: 'test-user-id', 
        plan_id: '123', 
        status: 'active',
        messages_limit: 1000,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plans: { id: '123', name: 'Test Plan' }
      },
      error: null
    })
  })
}));

describe('Subscription Routes', () => {
  it('should create a subscription', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .send({ plan_id: '123', status: 'active' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('subscriptionId');
  });

  it('should cancel a subscription', async () => {
    const res = await request(app)
      .delete('/api/subscriptions/test-subscription-id');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Subscription canceled successfully');
  });

  it('should handle Stripe webhook for payment success', async () => {
    const webhookEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    };

    const res = await request(app)
      .post('/api/subscriptions/webhook')
      .send(webhookEvent);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
