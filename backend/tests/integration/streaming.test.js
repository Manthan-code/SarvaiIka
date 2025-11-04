const request = require('supertest');
const app = require('../../src/server');
const { createTestUser, cleanupTestData, generateAuthToken } = require('../helpers/testHelpers');
const EventSource = require('eventsource');

describe('Streaming Chat Routes Integration Tests', () => {
  let testUser;
  let authToken;
  let sessionId;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
    sessionId = 'test-session-' + Date.now();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('CORS Preflight', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await request(app)
        .options('/api/streaming/chat')
        .set('Origin', 'http://localhost:8080')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
  });

  describe('POST /api/streaming/chat', () => {
    it('should establish SSE connection and stream chat response', (done) => {
      const messageData = {
        message: 'Hello, how are you?',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      // Start the streaming request
      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .set('Cache-Control', 'no-cache')
        .send(messageData);

      let receivedData = '';
      let eventCount = 0;

      req.on('response', (res) => {
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['connection']).toBe('keep-alive');
        expect(res.headers['access-control-allow-credentials']).toBe('true');

        res.on('data', (chunk) => {
          const data = chunk.toString();
          receivedData += data;
          
          // Parse SSE events
          const events = data.split('\n\n').filter(event => event.trim());
          
          events.forEach(event => {
            if (event.includes('data: ')) {
              eventCount++;
              const eventData = event.split('data: ')[1];
              
              if (eventData === '[DONE]') {
                // Stream completed
                expect(eventCount).toBeGreaterThan(0);
                expect(receivedData).toContain('data: ');
                done();
              } else {
                try {
                  const parsedData = JSON.parse(eventData);
                  expect(parsedData).toHaveProperty('content');
                  expect(parsedData).toHaveProperty('sessionId', sessionId);
                } catch (e) {
                  // Some events might not be JSON (like heartbeat)
                }
              }
            }
          });
        });

        res.on('error', (err) => {
          done(err);
        });

        // Set timeout to prevent hanging tests
        setTimeout(() => {
          if (eventCount === 0) {
            done(new Error('No events received within timeout'));
          }
        }, 10000);
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should require authentication for streaming', (done) => {
      const messageData = {
        message: 'Hello, how are you?',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect(res.status).toBe(401);
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should validate required fields for streaming', (done) => {
      const invalidData = {
        sessionId: sessionId
        // Missing message
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(invalidData);

      req.on('response', (res) => {
        expect(res.status).toBe(400);
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should handle empty messages', (done) => {
      const messageData = {
        message: '',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect(res.status).toBe(400);
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should handle very long messages', (done) => {
      const longMessage = 'a'.repeat(10000);
      const messageData = {
        message: longMessage,
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect([200, 413]).toContain(res.status); // Should either work or be too large
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should handle different AI models', (done) => {
      const messageData = {
        message: 'Test message for different model',
        sessionId: sessionId,
        model: 'gpt-4'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      let receivedResponse = false;

      req.on('response', (res) => {
        expect(res.status).toBe(200);
        
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('[DONE]')) {
            receivedResponse = true;
            done();
          }
        });

        // Timeout protection
        setTimeout(() => {
          if (!receivedResponse) {
            done(new Error('No response received within timeout'));
          }
        }, 10000);
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should handle coding-related queries with streaming', (done) => {
      const messageData = {
        message: 'Write a simple Python function to calculate factorial',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      let codeReceived = false;

      req.on('response', (res) => {
        expect(res.status).toBe(200);
        
        res.on('data', (chunk) => {
          const data = chunk.toString();
          
          if (data.includes('def ') || data.includes('function') || data.includes('factorial')) {
            codeReceived = true;
          }
          
          if (data.includes('[DONE]')) {
            expect(codeReceived).toBe(true);
            done();
          }
        });

        setTimeout(() => {
          if (!codeReceived) {
            done(new Error('No code content received'));
          }
        }, 15000);
      });

      req.on('error', (err) => {
        done(err);
      });
    });
  });

  describe('GET /api/streaming/status/:sessionId', () => {
    it('should return streaming status for valid session', async () => {
      const response = await request(app)
        .get(`/api/streaming/status/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessionId', sessionId);
      expect(response.body.data).toHaveProperty('status');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/streaming/status/${sessionId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate session ID format', async () => {
      const response = await request(app)
        .get('/api/streaming/status/invalid-session-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent sessions', async () => {
      const nonExistentSessionId = 'non-existent-session-' + Date.now();
      
      const response = await request(app)
        .get(`/api/streaming/status/${nonExistentSessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/streaming/stop/:sessionId', () => {
    it('should stop streaming session', async () => {
      const response = await request(app)
        .delete(`/api/streaming/stop/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/streaming/stop/${sessionId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate session ID format', async () => {
      const response = await request(app)
        .delete('/api/streaming/stop/invalid-session-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle stopping non-existent sessions gracefully', async () => {
      const nonExistentSessionId = 'non-existent-session-' + Date.now();
      
      const response = await request(app)
        .delete(`/api/streaming/stop/${nonExistentSessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service errors gracefully in streaming', (done) => {
      // Mock AI service to throw an error
      const mockAIService = require('../../src/services/aiService');
      const originalStreamChat = mockAIService.streamChatCompletion;
      
      mockAIService.streamChatCompletion = jest.fn().mockRejectedValue(
        new Error('AI service unavailable')
      );

      const messageData = {
        message: 'Test message',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect([200, 500]).toContain(res.status);
        
        if (res.status === 200) {
          res.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('error') || data.includes('[DONE]')) {
              // Restore original function
              mockAIService.streamChatCompletion = originalStreamChat;
              done();
            }
          });
        } else {
          // Restore original function
          mockAIService.streamChatCompletion = originalStreamChat;
          done();
        }
      });

      req.on('error', (err) => {
        // Restore original function
        mockAIService.streamChatCompletion = originalStreamChat;
        done(err);
      });
    });

    it('should handle malformed JSON in streaming requests', (done) => {
      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      req.on('response', (res) => {
        expect(res.status).toBe(400);
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should handle connection drops gracefully', (done) => {
      const messageData = {
        message: 'Test message for connection drop',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect(res.status).toBe(200);
        
        // Simulate connection drop after a short time
        setTimeout(() => {
          req.abort();
          done();
        }, 1000);
      });

      req.on('error', (err) => {
        // Expected error due to abort
        if (err.code === 'ECONNRESET' || err.message.includes('aborted')) {
          done();
        } else {
          done(err);
        }
      });
    });
  });

  describe('Security', () => {
    it('should include security headers in streaming responses', (done) => {
      const messageData = {
        message: 'Security test message',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
        expect(res.headers).toHaveProperty('x-frame-options', 'DENY');
        expect(res.headers).toHaveProperty('x-xss-protection', '1; mode=block');
        expect(res.headers).toHaveProperty('access-control-allow-credentials', 'true');
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should sanitize input in streaming requests', (done) => {
      const maliciousMessage = '<script>alert("xss")</script>Hello';
      const messageData = {
        message: maliciousMessage,
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect(res.status).toBe(200);
        
        res.on('data', (chunk) => {
          const data = chunk.toString();
          // Should not contain script tags in the response
          expect(data).not.toContain('<script>');
          
          if (data.includes('[DONE]')) {
            done();
          }
        });
      });

      req.on('error', (err) => {
        done(err);
      });
    });

    it('should prevent SQL injection in streaming requests', (done) => {
      const sqlInjectionMessage = "'; DROP TABLE users; --";
      const messageData = {
        message: sqlInjectionMessage,
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        expect([200, 400]).toContain(res.status); // Should either sanitize or reject
        done();
      });

      req.on('error', (err) => {
        done(err);
      });
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent streaming sessions', (done) => {
      const concurrentSessions = 3;
      let completedSessions = 0;
      
      for (let i = 0; i < concurrentSessions; i++) {
        const messageData = {
          message: `Concurrent test message ${i}`,
          sessionId: `concurrent-session-${i}-${Date.now()}`,
          model: 'gpt-3.5-turbo'
        };

        const req = request(app)
          .post('/api/streaming/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .send(messageData);

        req.on('response', (res) => {
          expect([200, 429]).toContain(res.status); // 200 or rate limited
          
          if (res.status === 200) {
            res.on('data', (chunk) => {
              if (chunk.toString().includes('[DONE]')) {
                completedSessions++;
                if (completedSessions === concurrentSessions) {
                  done();
                }
              }
            });
          } else {
            completedSessions++;
            if (completedSessions === concurrentSessions) {
              done();
            }
          }
        });

        req.on('error', (err) => {
          completedSessions++;
          if (completedSessions === concurrentSessions) {
            done();
          }
        });
      }

      // Timeout protection
      setTimeout(() => {
        if (completedSessions < concurrentSessions) {
          done(new Error(`Only ${completedSessions}/${concurrentSessions} sessions completed`));
        }
      }, 30000);
    });

    it('should maintain reasonable response times for streaming', (done) => {
      const startTime = Date.now();
      const messageData = {
        message: 'Performance test message',
        sessionId: sessionId,
        model: 'gpt-3.5-turbo'
      };

      const req = request(app)
        .post('/api/streaming/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(messageData);

      req.on('response', (res) => {
        const firstResponseTime = Date.now() - startTime;
        expect(firstResponseTime).toBeLessThan(5000); // First response within 5 seconds
        
        res.on('data', (chunk) => {
          if (chunk.toString().includes('[DONE]')) {
            const totalTime = Date.now() - startTime;
            expect(totalTime).toBeLessThan(30000); // Total response within 30 seconds
            done();
          }
        });
      });

      req.on('error', (err) => {
        done(err);
      });
    });
  });
});