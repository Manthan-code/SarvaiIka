const request = require('supertest');
const app = require('../app.js');

describe('Router / Health and 404', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });
});

describe('Dynamic AI Model Routing', () => {
  it('should route free users to GPT-3.5-turbo', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ userMessage: 'Hello', subscriptionPlan: 'free' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('model');
    expect(res.body.model).toMatch(/gpt-3\.5|4o-mini/);
    expect(res.body).toHaveProperty('endpoint', '/api/free');
  });

  it('should route pro users to GPT-4', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ userMessage: 'Hello', subscriptionPlan: 'pro' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('model');
    expect(res.body.model).toMatch(/gpt-4/);
    expect(res.body).toHaveProperty('endpoint', '/api/pro');
  });
});
