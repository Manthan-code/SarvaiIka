/**
 * Chat Routes Unit Tests
 * Comprehensive tests for chat route handlers
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockChatController = {
  handleChat: jest.fn(),
  getHistory: jest.fn(),
  getConversations: jest.fn(),
  deleteConversation: jest.fn(),
  updateConversation: jest.fn()
};

const mockAuth = {
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user_123', email: 'test@example.com' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next()),
  rateLimitByUser: jest.fn((req, res, next) => next()),
  checkSubscriptionAccess: jest.fn((req, res, next) => next())
};

const mockValidation = {
  validateChatMessage: jest.fn((req, res, next) => next()),
  validatePagination: jest.fn((req, res, next) => next()),
  validateConversationId: jest.fn((req, res, next) => next())
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/controllers/chatController', () => mockChatController);
jest.mock('../../../src/middleware/auth', () => mockAuth);
jest.mock('../../../src/middleware/validation', () => mockValidation);
jest.mock('../../../src/utils/logger', () => mockLogger);

// Create Express app with routes
const app = express();
app.use(express.json());

// Import and use routes after mocking
const chatRoutes = require('../../../src/routes/chat');
app.use('/api/chat', chatRoutes);

describe('Chat Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/chat', () => {
    it('should handle chat request successfully', async () => {
      const mockResponse = {
        content: 'Hello! How can I help you today?',
        usage: { total_tokens: 25 },
        conversationId: 'conv_123'
      };

      mockChatController.handleChat.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hello',
          conversationId: 'conv_123'
        })
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockAuth.rateLimitByUser).toHaveBeenCalled();
      expect(mockAuth.checkSubscriptionAccess).toHaveBeenCalled();
      expect(mockValidation.validateChatMessage).toHaveBeenCalled();
      expect(mockChatController.handleChat).toHaveBeenCalled();
    });

    it('should handle streaming chat request', async () => {
      mockChatController.handleChat.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        res.write('data: {"content": "Hello"}\n\n');
        res.write('data: {"content": " there!"}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hello',
          stream: true
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should require authentication', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(401);
    });

    it('should enforce rate limiting', async () => {
      mockAuth.rateLimitByUser.mockImplementation((req, res, next) => {
        res.status(429).json({ error: 'Too many requests' });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(429);
    });

    it('should check subscription access', async () => {
      mockAuth.checkSubscriptionAccess.mockImplementation((req, res, next) => {
        res.status(403).json({ error: 'Subscription required' });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(403);
    });

    it('should validate message format', async () => {
      mockValidation.validateChatMessage.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid message format' });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: '' })
        .expect(400);
    });

    it('should handle controller errors', async () => {
      mockChatController.handleChat.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(500);
    });

    it('should handle missing message body', async () => {
      await request(app)
        .post('/api/chat')
        .send({})
        .expect(400);
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('GET /api/chat/history/:conversationId', () => {
    it('should get conversation history successfully', async () => {
      const mockHistory = {
        messages: [
          { id: 'msg_1', role: 'user', content: 'Hello' },
          { id: 'msg_2', role: 'assistant', content: 'Hi there!' }
        ],
        total: 2,
        page: 1,
        limit: 50
      };

      mockChatController.getHistory.mockImplementation((req, res) => {
        res.status(200).json(mockHistory);
      });

      const response = await request(app)
        .get('/api/chat/history/conv_123')
        .expect(200);

      expect(response.body).toEqual(mockHistory);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateConversationId).toHaveBeenCalled();
      expect(mockChatController.getHistory).toHaveBeenCalled();
    });

    it('should handle pagination parameters', async () => {
      mockChatController.getHistory.mockImplementation((req, res) => {
        expect(req.query.page).toBe('2');
        expect(req.query.limit).toBe('25');
        res.status(200).json({ messages: [], total: 0, page: 2, limit: 25 });
      });

      await request(app)
        .get('/api/chat/history/conv_123?page=2&limit=25')
        .expect(200);
    });

    it('should validate conversation ID', async () => {
      mockValidation.validateConversationId.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid conversation ID' });
      });

      await request(app)
        .get('/api/chat/history/invalid-id')
        .expect(400);
    });

    it('should handle conversation not found', async () => {
      mockChatController.getHistory.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Conversation not found' });
      });

      await request(app)
        .get('/api/chat/history/nonexistent')
        .expect(404);
    });

    it('should handle unauthorized access', async () => {
      mockChatController.getHistory.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Unauthorized access to conversation' });
      });

      await request(app)
        .get('/api/chat/history/conv_123')
        .expect(403);
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('should get user conversations successfully', async () => {
      const mockConversations = {
        conversations: [
          { id: 'conv_1', title: 'Conversation 1', created_at: '2024-01-01' },
          { id: 'conv_2', title: 'Conversation 2', created_at: '2024-01-02' }
        ],
        total: 2,
        page: 1,
        limit: 10
      };

      mockChatController.getConversations.mockImplementation((req, res) => {
        res.status(200).json(mockConversations);
      });

      const response = await request(app)
        .get('/api/chat/conversations')
        .expect(200);

      expect(response.body).toEqual(mockConversations);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validatePagination).toHaveBeenCalled();
      expect(mockChatController.getConversations).toHaveBeenCalled();
    });

    it('should handle empty conversations list', async () => {
      mockChatController.getConversations.mockImplementation((req, res) => {
        res.status(200).json({
          conversations: [],
          total: 0,
          page: 1,
          limit: 10
        });
      });

      const response = await request(app)
        .get('/api/chat/conversations')
        .expect(200);

      expect(response.body.conversations).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should handle pagination for conversations', async () => {
      mockChatController.getConversations.mockImplementation((req, res) => {
        expect(req.query.page).toBe('3');
        expect(req.query.limit).toBe('5');
        res.status(200).json({
          conversations: [],
          total: 20,
          page: 3,
          limit: 5
        });
      });

      await request(app)
        .get('/api/chat/conversations?page=3&limit=5')
        .expect(200);
    });

    it('should validate pagination parameters', async () => {
      mockValidation.validatePagination.mockImplementation((req, res, next) => {
        res.status(400).json({ error: 'Invalid pagination parameters' });
      });

      await request(app)
        .get('/api/chat/conversations?page=-1&limit=0')
        .expect(400);
    });
  });

  describe('DELETE /api/chat/conversations/:conversationId', () => {
    it('should delete conversation successfully', async () => {
      mockChatController.deleteConversation.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Conversation deleted successfully' });
      });

      const response = await request(app)
        .delete('/api/chat/conversations/conv_123')
        .expect(200);

      expect(response.body.message).toBe('Conversation deleted successfully');
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateConversationId).toHaveBeenCalled();
      expect(mockChatController.deleteConversation).toHaveBeenCalled();
    });

    it('should handle conversation not found for deletion', async () => {
      mockChatController.deleteConversation.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Conversation not found' });
      });

      await request(app)
        .delete('/api/chat/conversations/nonexistent')
        .expect(404);
    });

    it('should handle unauthorized deletion', async () => {
      mockChatController.deleteConversation.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Unauthorized to delete conversation' });
      });

      await request(app)
        .delete('/api/chat/conversations/conv_123')
        .expect(403);
    });

    it('should handle deletion errors', async () => {
      mockChatController.deleteConversation.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to delete conversation' });
      });

      await request(app)
        .delete('/api/chat/conversations/conv_123')
        .expect(500);
    });
  });

  describe('PUT /api/chat/conversations/:conversationId', () => {
    it('should update conversation successfully', async () => {
      const updatedConversation = {
        id: 'conv_123',
        title: 'Updated Title',
        updated_at: '2024-01-01T12:00:00Z'
      };

      mockChatController.updateConversation.mockImplementation((req, res) => {
        res.status(200).json(updatedConversation);
      });

      const response = await request(app)
        .put('/api/chat/conversations/conv_123')
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body).toEqual(updatedConversation);
      expect(mockAuth.authenticateToken).toHaveBeenCalled();
      expect(mockValidation.validateConversationId).toHaveBeenCalled();
      expect(mockChatController.updateConversation).toHaveBeenCalled();
    });

    it('should handle invalid update data', async () => {
      mockChatController.updateConversation.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Invalid update data' });
      });

      await request(app)
        .put('/api/chat/conversations/conv_123')
        .send({ title: '' })
        .expect(400);
    });

    it('should handle conversation not found for update', async () => {
      mockChatController.updateConversation.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Conversation not found' });
      });

      await request(app)
        .put('/api/chat/conversations/nonexistent')
        .send({ title: 'New Title' })
        .expect(404);
    });

    it('should handle unauthorized update', async () => {
      mockChatController.updateConversation.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Unauthorized to update conversation' });
      });

      await request(app)
        .put('/api/chat/conversations/conv_123')
        .send({ title: 'New Title' })
        .expect(403);
    });
  });

  describe('Route Security', () => {
    it('should require authentication for all routes', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      // Test all protected routes
      await request(app).post('/api/chat').expect(401);
      await request(app).get('/api/chat/history/conv_123').expect(401);
      await request(app).get('/api/chat/conversations').expect(401);
      await request(app).delete('/api/chat/conversations/conv_123').expect(401);
      await request(app).put('/api/chat/conversations/conv_123').expect(401);
    });

    it('should apply rate limiting to chat endpoint', async () => {
      mockAuth.rateLimitByUser.mockImplementation((req, res, next) => {
        res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: 60
        });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(429);
    });

    it('should check subscription access for chat', async () => {
      mockAuth.checkSubscriptionAccess.mockImplementation((req, res, next) => {
        res.status(402).json({ 
          error: 'Active subscription required',
          upgradeUrl: '/upgrade'
        });
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(402);
    });
  });

  describe('Input Validation', () => {
    it('should validate chat message content', async () => {
      mockValidation.validateChatMessage.mockImplementation((req, res, next) => {
        if (!req.body.message || req.body.message.trim().length === 0) {
          return res.status(400).json({ error: 'Message cannot be empty' });
        }
        if (req.body.message.length > 4000) {
          return res.status(400).json({ error: 'Message too long' });
        }
        next();
      });

      // Test empty message
      await request(app)
        .post('/api/chat')
        .send({ message: '' })
        .expect(400);

      // Test long message
      await request(app)
        .post('/api/chat')
        .send({ message: 'x'.repeat(4001) })
        .expect(400);
    });

    it('should validate conversation ID format', async () => {
      mockValidation.validateConversationId.mockImplementation((req, res, next) => {
        const { conversationId } = req.params;
        if (!/^[a-zA-Z0-9_-]+$/.test(conversationId)) {
          return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        next();
      });

      await request(app)
        .get('/api/chat/history/invalid@id')
        .expect(400);
    });

    it('should validate pagination parameters', async () => {
      mockValidation.validatePagination.mockImplementation((req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        if (page < 1 || limit < 1 || limit > 100) {
          return res.status(400).json({ error: 'Invalid pagination parameters' });
        }
        next();
      });

      await request(app)
        .get('/api/chat/conversations?page=0&limit=101')
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller exceptions', async () => {
      mockChatController.handleChat.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(500);
    });

    it('should handle async controller errors', async () => {
      mockChatController.getHistory.mockImplementation(async (req, res) => {
        throw new Error('Async controller error');
      });

      await request(app)
        .get('/api/chat/history/conv_123')
        .expect(500);
    });

    it('should handle middleware errors', async () => {
      mockAuth.authenticateToken.mockImplementation((req, res, next) => {
        next(new Error('Auth middleware error'));
      });

      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(500);
    });
  });

  describe('Content-Type Handling', () => {
    it('should handle JSON content type', async () => {
      mockChatController.handleChat.mockImplementation((req, res) => {
        res.status(200).json({ content: 'Response' });
      });

      await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ message: 'Hello' }))
        .expect(200);
    });

    it('should reject non-JSON content types for POST', async () => {
      await request(app)
        .post('/api/chat')
        .set('Content-Type', 'text/plain')
        .send('Hello')
        .expect(400);
    });

    it('should handle missing content type', async () => {
      await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(200); // Express should handle this gracefully
    });
  });

  describe('HTTP Methods', () => {
    it('should reject unsupported HTTP methods', async () => {
      await request(app)
        .patch('/api/chat')
        .expect(404);

      await request(app)
        .options('/api/chat/conversations/conv_123')
        .expect(404);
    });

    it('should handle HEAD requests', async () => {
      await request(app)
        .head('/api/chat/conversations')
        .expect(200);
    });
  });

  describe('Response Headers', () => {
    it('should set appropriate headers for streaming', async () => {
      mockChatController.handleChat.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end();
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello', stream: true })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should set JSON headers for regular responses', async () => {
      mockChatController.handleChat.mockImplementation((req, res) => {
        res.status(200).json({ content: 'Response' });
      });

      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});