/**
 * Chat Controller Unit Tests
 * Comprehensive tests for all chat controller methods and edge cases
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const chatController = require('../src/controllers/chatController');
const chatService = require('../src/services/chatService');

// Mock dependencies
jest.mock('../src/services/chatService');

describe('Chat Controller Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request object
    mockReq = {
      body: {},
      params: {},
      user: { id: 'test-user-id' }
    };
    
    // Setup mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleChat', () => {
    beforeEach(() => {
      mockReq.body = {
        userId: 'test-user-123',
        message: 'Hello, how are you?'
      };
    });

    it('should handle chat request successfully', async () => {
      const mockAiResponse = 'Hello! I\'m doing well, thank you for asking.';
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue(mockAiResponse);
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(chatService.saveChatMessage).toHaveBeenCalledWith(
        'test-user-123',
        'Hello, how are you?',
        'user'
      );
      expect(chatService.generateChatResponse).toHaveBeenCalledWith('Hello, how are you?');
      expect(chatService.saveChatMessage).toHaveBeenCalledWith(
        'test-user-123',
        mockAiResponse,
        'agent'
      );
      expect(mockRes.json).toHaveBeenCalledWith({ message: mockAiResponse });
    });

    it('should return 400 when userId is missing', async () => {
      mockReq.body = {
        message: 'Hello, how are you?'
      };
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
      expect(chatService.saveChatMessage).not.toHaveBeenCalled();
      expect(chatService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should return 400 when message is missing', async () => {
      mockReq.body = {
        userId: 'test-user-123'
      };
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
      expect(chatService.saveChatMessage).not.toHaveBeenCalled();
      expect(chatService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should return 400 when both userId and message are missing', async () => {
      mockReq.body = {};
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });

    it('should handle empty string userId', async () => {
      mockReq.body = {
        userId: '',
        message: 'Hello'
      };
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });

    it('should handle empty string message', async () => {
      mockReq.body = {
        userId: 'test-user-123',
        message: ''
      };
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });

    it('should handle null values', async () => {
      mockReq.body = {
        userId: null,
        message: null
      };
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });

    it('should handle undefined values', async () => {
      mockReq.body = {
        userId: undefined,
        message: undefined
      };
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });

    it('should handle error when saving user message fails', async () => {
      chatService.saveChatMessage.mockRejectedValue(new Error('Database error'));
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to process chat' });
    });

    it('should handle error when generating AI response fails', async () => {
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockRejectedValue(new Error('AI service error'));
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to process chat' });
    });

    it('should handle error when saving AI response fails', async () => {
      chatService.saveChatMessage
        .mockResolvedValueOnce(true) // First call succeeds (user message)
        .mockRejectedValueOnce(new Error('Database error')); // Second call fails (AI message)
      chatService.generateChatResponse.mockResolvedValue('AI response');
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to process chat' });
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(10000);
      mockReq.body.message = longMessage;
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue('Response to long message');
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(chatService.generateChatResponse).toHaveBeenCalledWith(longMessage);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Response to long message' });
    });

    it('should handle special characters in messages', async () => {
      const specialMessage = '!@#$%^&*()_+{}|:<>?[]\\;\',./`~';
      mockReq.body.message = specialMessage;
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue('Response to special chars');
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(chatService.generateChatResponse).toHaveBeenCalledWith(specialMessage);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Response to special chars' });
    });

    it('should handle unicode characters in messages', async () => {
      const unicodeMessage = '你好世界 🌍 émojis and ñoñó';
      mockReq.body.message = unicodeMessage;
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue('Unicode response');
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(chatService.generateChatResponse).toHaveBeenCalledWith(unicodeMessage);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unicode response' });
    });

    it('should handle numeric userId', async () => {
      mockReq.body.userId = 12345;
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue('Numeric user response');
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(chatService.saveChatMessage).toHaveBeenCalledWith(
        12345,
        'Hello, how are you?',
        'user'
      );
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Numeric user response' });
    });

    it('should handle malformed request body', async () => {
      mockReq.body = 'invalid-json';
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      mockReq.params = {
        userId: 'test-user-123'
      };
    });

    it('should get chat history successfully', async () => {
      const mockHistory = [
        { id: 1, message: 'Hello', sender: 'user', timestamp: '2023-01-01T00:00:00Z' },
        { id: 2, message: 'Hi there!', sender: 'agent', timestamp: '2023-01-01T00:00:01Z' }
      ];
      
      chatService.getChatHistory.mockResolvedValue(mockHistory);
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(chatService.getChatHistory).toHaveBeenCalledWith('test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ history: mockHistory });
    });

    it('should return 400 when userId is missing', async () => {
      mockReq.params = {};
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId' });
      expect(chatService.getChatHistory).not.toHaveBeenCalled();
    });

    it('should return 400 when userId is empty string', async () => {
      mockReq.params = { userId: '' };
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId' });
    });

    it('should return 400 when userId is null', async () => {
      mockReq.params = { userId: null };
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId' });
    });

    it('should return 400 when userId is undefined', async () => {
      mockReq.params = { userId: undefined };
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId' });
    });

    it('should handle error when fetching chat history fails', async () => {
      chatService.getChatHistory.mockRejectedValue(new Error('Database error'));
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch chat history' });
    });

    it('should handle empty chat history', async () => {
      chatService.getChatHistory.mockResolvedValue([]);
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({ history: [] });
    });

    it('should handle large chat history', async () => {
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        message: `Message ${i + 1}`,
        sender: i % 2 === 0 ? 'user' : 'agent',
        timestamp: new Date().toISOString()
      }));
      
      chatService.getChatHistory.mockResolvedValue(largeHistory);
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({ history: largeHistory });
    });

    it('should handle numeric userId in params', async () => {
      mockReq.params.userId = '12345';
      
      chatService.getChatHistory.mockResolvedValue([]);
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(chatService.getChatHistory).toHaveBeenCalledWith('12345');
      expect(mockRes.json).toHaveBeenCalledWith({ history: [] });
    });

    it('should handle special characters in userId', async () => {
      mockReq.params.userId = 'user-123@domain.com';
      
      chatService.getChatHistory.mockResolvedValue([]);
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(chatService.getChatHistory).toHaveBeenCalledWith('user-123@domain.com');
      expect(mockRes.json).toHaveBeenCalledWith({ history: [] });
    });

    it('should handle malformed params object', async () => {
      mockReq.params = null;
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId' });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing request body', async () => {
      mockReq.body = undefined;
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
    });

    it('should handle missing request params', async () => {
      mockReq.params = undefined;
      
      await chatController.getHistory(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing userId' });
    });

    it('should handle service returning null', async () => {
      mockReq.body = {
        userId: 'test-user-123',
        message: 'Hello'
      };
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue(null);
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({ message: null });
    });

    it('should handle service returning undefined', async () => {
      mockReq.body = {
        userId: 'test-user-123',
        message: 'Hello'
      };
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue(undefined);
      
      await chatController.handleChat(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({ message: undefined });
    });

    it('should handle concurrent requests', async () => {
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        const req = {
          body: {
            userId: `user-${i}`,
            message: `Message ${i}`
          }
        };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };
        
        chatService.saveChatMessage.mockResolvedValue(true);
        chatService.generateChatResponse.mockResolvedValue(`Response ${i}`);
        
        requests.push(chatController.handleChat(req, res));
      }
      
      await Promise.all(requests);
      
      expect(chatService.saveChatMessage).toHaveBeenCalledTimes(20); // 10 user + 10 agent messages
      expect(chatService.generateChatResponse).toHaveBeenCalledTimes(10);
    });
  });

  describe('Performance Tests', () => {
    it('should handle requests within reasonable time', async () => {
      mockReq.body = {
        userId: 'test-user-123',
        message: 'Performance test message'
      };
      
      chatService.saveChatMessage.mockResolvedValue(true);
      chatService.generateChatResponse.mockResolvedValue('Performance response');
      
      const startTime = Date.now();
      await chatController.handleChat(mockReq, mockRes);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle history requests within reasonable time', async () => {
      chatService.getChatHistory.mockResolvedValue([]);
      
      const startTime = Date.now();
      await chatController.getHistory(mockReq, mockRes);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });
  });
});