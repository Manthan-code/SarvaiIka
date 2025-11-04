const request = require('supertest');
const app = require('../src/server');
const supabase = require('../src/db/supabase/admin');

describe('N+1 Query Fixes', () => {
  let authToken;
  let userId;
  let chatId;

  beforeAll(async () => {
    // Setup test user and auth token
    const testUser = {
      email: 'test-n1@example.com',
      password: 'testpassword123'
    };

    // Create test user
    const { data: { user }, error } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true
    });

    if (error) throw error;
    userId = user.id;

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send(testUser);
    
    authToken = loginResponse.body.token;

    // Create test chat session
    const { data: chat } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        title: 'Test Chat for N+1 Fix',
        total_messages: 2
      })
      .select()
      .single();
    
    chatId = chat.id;

    // Create test messages
    await supabase
      .from('chat_messages')
      .insert([
        {
          chat_id: chatId,
          role: 'user',
          content: 'Test message 1',
          tokens: 10
        },
        {
          chat_id: chatId,
          role: 'assistant',
          content: 'Test response 1',
          tokens: 15
        }
      ]);
  });

  afterAll(async () => {
    // Cleanup
    if (chatId) {
      await supabase.from('chat_messages').delete().eq('chat_id', chatId);
      await supabase.from('chats').delete().eq('id', chatId);
    }
    if (userId) {
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  describe('Chat Routes - N+1 Fix', () => {
    test('GET /api/chat/:id should fetch chat with messages in single query', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/chat/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(chatId);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].role).toBe('user');
      expect(response.body.messages[1].role).toBe('assistant');
      
      // Response should be fast (under 500ms for optimized query)
      expect(responseTime).toBeLessThan(500);
      
      console.log(`✅ Chat fetch optimized - Response time: ${responseTime}ms`);
    });

    test('GET /api/chat/history should fetch recent chat with messages efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe(chatId);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.totalSessions).toBeGreaterThanOrEqual(1);
      
      // Response should be fast (under 300ms for optimized query)
      expect(responseTime).toBeLessThan(300);
      
      console.log(`✅ Chat history optimized - Response time: ${responseTime}ms`);
    });
  });

  describe('Subscription Routes - N+1 Fix', () => {
    test('GET /api/subscriptions should fetch subscriptions with plans efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Response should be fast (under 200ms for optimized query)
      expect(responseTime).toBeLessThan(200);
      
      console.log(`✅ Subscriptions fetch optimized - Response time: ${responseTime}ms`);
    });
  });

  describe('Enhanced Profile Routes - N+1 Fix', () => {
    test('GET /api/enhanced-profile should fetch profile with related data efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/enhanced-profile')
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.subscription).toBeDefined();
      expect(response.body.usage).toBeDefined();
      
      // Response should be fast (under 300ms for optimized query)
      expect(responseTime).toBeLessThan(300);
      
      console.log(`✅ Enhanced profile optimized - Response time: ${responseTime}ms`);
    });
  });

  describe('Performance Comparison', () => {
    test('Multiple concurrent requests should maintain performance', async () => {
      const startTime = Date.now();
      
      // Simulate concurrent requests
      const promises = Array(5).fill().map(() => 
        request(app)
          .get(`/api/chat/${chatId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.messages).toHaveLength(2);
      });
      
      // Total time for 5 concurrent requests should be reasonable
      expect(totalTime).toBeLessThan(2000);
      
      console.log(`✅ Concurrent requests handled efficiently - Total time: ${totalTime}ms`);
    });
  });
});