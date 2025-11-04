/**
 * Chat Controller Unit Tests
 * Comprehensive tests for all chat controller methods
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('../../../src/services/chatService');
jest.mock('../../../src/services/aiService');
jest.mock('../../../src/utils/logger');

const chatController = require('../../../src/controllers/chatController');
const chatService = require('../../../src/services/chatService');
const aiService = require('../../../src/services/aiService');
const logger = require('../../../src/utils/logger');

describe('Chat Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: {
        id: 'user_123',
        email: 'test@example.com'
      },
      headers: {
        'content-type': 'application/json'
      }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleChat', () => {
    it('should handle chat request successfully', async () => {
      const mockChatResponse = {
        response: 'This is a test response',
        conversationId: 'conv_123',
        messageId: 'msg_456'
      };

      mockReq.body = {
        message: 'Hello, how are you?',
        conversationId: 'conv_123'
      };

      chatService.processChat.mockResolvedValue(mockChatResponse);

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(chatService.processChat).toHaveBeenCalledWith({
        message: 'Hello, how are you?',
        conversationId: 'conv_123',
        userId: 'user_123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockChatResponse
      });
    });

    it('should handle streaming chat response', async () => {
      const mockStreamResponse = {
        stream: true,
        conversationId: 'conv_123'
      };

      mockReq.body = {
        message: 'Tell me a story',
        stream: true
      };

      chatService.processStreamingChat.mockResolvedValue(mockStreamResponse);

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(chatService.processStreamingChat).toHaveBeenCalledWith({
        message: 'Tell me a story',
        stream: true,
        userId: 'user_123'
      });
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    });

    it('should handle missing message in request', async () => {
      mockReq.body = {
        conversationId: 'conv_123'
      };

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message is required'
      });
    });

    it('should handle empty message', async () => {
      mockReq.body = {
        message: '',
        conversationId: 'conv_123'
      };

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message cannot be empty'
      });
    });

    it('should handle chat service errors', async () => {
      mockReq.body = {
        message: 'Hello, how are you?',
        conversationId: 'conv_123'
      };

      const error = new Error('Chat service error');
      chatService.processChat.mockRejectedValue(error);

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Chat error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle rate limiting errors', async () => {
      mockReq.body = {
        message: 'Hello, how are you?'
      };

      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.code = 'RATE_LIMIT_EXCEEDED';
      chatService.processChat.mockRejectedValue(rateLimitError);

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    });

    it('should handle unauthorized access', async () => {
      mockReq.user = null;

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized access'
      });
    });
  });

  describe('getHistory', () => {
    it('should get chat history successfully', async () => {
      const mockHistory = [
        {
          id: 'msg_1',
          message: 'Hello',
          response: 'Hi there!',
          timestamp: new Date().toISOString()
        },
        {
          id: 'msg_2',
          message: 'How are you?',
          response: 'I am doing well, thank you!',
          timestamp: new Date().toISOString()
        }
      ];

      mockReq.params = {
        conversationId: 'conv_123'
      };

      chatService.getChatHistory.mockResolvedValue(mockHistory);

      await chatController.getHistory(mockReq, mockRes, mockNext);

      expect(chatService.getChatHistory).toHaveBeenCalledWith('conv_123', 'user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory
      });
    });

    it('should handle pagination in history', async () => {
      const mockHistory = {
        messages: [
          {
            id: 'msg_1',
            message: 'Hello',
            response: 'Hi there!'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          hasMore: false
        }
      };

      mockReq.params = {
        conversationId: 'conv_123'
      };
      mockReq.query = {
        page: '1',
        limit: '20'
      };

      chatService.getChatHistory.mockResolvedValue(mockHistory);

      await chatController.getHistory(mockReq, mockRes, mockNext);

      expect(chatService.getChatHistory).toHaveBeenCalledWith('conv_123', 'user_123', {
        page: 1,
        limit: 20
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory
      });
    });

    it('should handle missing conversation ID', async () => {
      mockReq.params = {};

      await chatController.getHistory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Conversation ID is required'
      });
    });

    it('should handle history service errors', async () => {
      mockReq.params = {
        conversationId: 'conv_123'
      };

      const error = new Error('Database error');
      chatService.getChatHistory.mockRejectedValue(error);

      await chatController.getHistory(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Get history error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve chat history'
      });
    });

    it('should handle unauthorized history access', async () => {
      mockReq.user = null;
      mockReq.params = {
        conversationId: 'conv_123'
      };

      await chatController.getHistory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized access'
      });
    });
  });

  describe('getConversations', () => {
    it('should get user conversations successfully', async () => {
      const mockConversations = [
        {
          id: 'conv_1',
          title: 'First Conversation',
          lastMessage: 'Hello',
          updatedAt: new Date().toISOString()
        },
        {
          id: 'conv_2',
          title: 'Second Conversation',
          lastMessage: 'How are you?',
          updatedAt: new Date().toISOString()
        }
      ];

      chatService.getUserConversations.mockResolvedValue(mockConversations);

      await chatController.getConversations(mockReq, mockRes, mockNext);

      expect(chatService.getUserConversations).toHaveBeenCalledWith('user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockConversations
      });
    });

    it('should handle empty conversations list', async () => {
      chatService.getUserConversations.mockResolvedValue([]);

      await chatController.getConversations(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle conversations service errors', async () => {
      const error = new Error('Database connection error');
      chatService.getUserConversations.mockRejectedValue(error);

      await chatController.getConversations(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Get conversations error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve conversations'
      });
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation successfully', async () => {
      mockReq.params = {
        conversationId: 'conv_123'
      };

      chatService.deleteConversation.mockResolvedValue({ success: true });

      await chatController.deleteConversation(mockReq, mockRes, mockNext);

      expect(chatService.deleteConversation).toHaveBeenCalledWith('conv_123', 'user_123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Conversation deleted successfully'
      });
    });

    it('should handle conversation not found', async () => {
      mockReq.params = {
        conversationId: 'conv_nonexistent'
      };

      const error = new Error('Conversation not found');
      error.code = 'NOT_FOUND';
      chatService.deleteConversation.mockRejectedValue(error);

      await chatController.deleteConversation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Conversation not found'
      });
    });

    it('should handle deletion errors', async () => {
      mockReq.params = {
        conversationId: 'conv_123'
      };

      const error = new Error('Database error');
      chatService.deleteConversation.mockRejectedValue(error);

      await chatController.deleteConversation(mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Delete conversation error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete conversation'
      });
    });
  });

  describe('updateConversation', () => {
    it('should update conversation title successfully', async () => {
      mockReq.params = {
        conversationId: 'conv_123'
      };
      mockReq.body = {
        title: 'Updated Conversation Title'
      };

      const updatedConversation = {
        id: 'conv_123',
        title: 'Updated Conversation Title',
        updatedAt: new Date().toISOString()
      };

      chatService.updateConversation.mockResolvedValue(updatedConversation);

      await chatController.updateConversation(mockReq, mockRes, mockNext);

      expect(chatService.updateConversation).toHaveBeenCalledWith('conv_123', 'user_123', {
        title: 'Updated Conversation Title'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedConversation
      });
    });

    it('should handle invalid update data', async () => {
      mockReq.params = {
        conversationId: 'conv_123'
      };
      mockReq.body = {};

      await chatController.updateConversation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No valid update data provided'
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate message length', async () => {
      const longMessage = 'a'.repeat(10001); // Assuming 10000 char limit
      mockReq.body = {
        message: longMessage
      };

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message too long. Maximum 10000 characters allowed.'
      });
    });

    it('should sanitize input message', async () => {
      const maliciousMessage = '<script>alert("xss")</script>Hello';
      mockReq.body = {
        message: maliciousMessage
      };

      const sanitizedResponse = {
        response: 'Hello there!',
        conversationId: 'conv_123'
      };

      chatService.processChat.mockResolvedValue(sanitizedResponse);

      await chatController.handleChat(mockReq, mockRes, mockNext);

      expect(chatService.processChat).toHaveBeenCalledWith({
        message: expect.not.stringContaining('<script>'),
        userId: 'user_123'
      });
    });
  });
});