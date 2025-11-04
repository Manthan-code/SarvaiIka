/**
 * Chat Controller Test Suite
 * Tests for chat controller functions
 */

const chatController = require('../../src/controllers/chatController');
const chatService = require('../../src/services/chatService');

// Mock dependencies
jest.mock('../../src/services/chatService');

describe('Chat Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup request and response mocks
    req = {
      body: {
        userId: 'user-123',
        message: 'Hello, AI!'
      },
      params: {
        userId: 'user-123'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('handleChat', () => {
    it('should return 400 if userId is missing', async () => {
      req.body = { message: 'Hello' };
      
      await chatController.handleChat(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
      expect(chatService.saveChatMessage).not.toHaveBeenCalled();
    });

    it('should return 400 if message is missing', async () => {
      req.body = { userId: 'user-123' };
      
      await chatController.handleChat(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing userId or message' });
      expect(chatService.saveChatMessage).not.toHaveBeenCalled();
    });

    it('should handle chat message and return AI response', async () => {
      const aiResponse = 'Hello, human!';
      chatService.generateChatResponse.mockResolvedValue(aiResponse);
      
      await chatController.handleChat(req, res);
      
      expect(chatService.saveChatMessage).toHaveBeenCalledWith('user-123', 'Hello, AI!', 'user');
      expect(chatService.generateChatResponse).toHaveBeenCalledWith('Hello, AI!');
      expect(chatService.saveChatMessage).toHaveBeenCalledWith('user-123', aiResponse, 'agent');
      expect(res.json).toHaveBeenCalledWith({ message: aiResponse });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Service error');
      chatService.saveChatMessage.mockRejectedValue(error);
      
      await chatController.handleChat(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to process chat' });
    });
  });

  describe('getHistory', () => {
    it('should return 400 if userId is missing', async () => {
      req.params = {};
      
      await chatController.getHistory(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing userId' });
      expect(chatService.getChatHistory).not.toHaveBeenCalled();
    });

    it('should return chat history for valid userId', async () => {
      const mockHistory = [
        { sender: 'user', message: 'Hello' },
        { sender: 'agent', message: 'Hi there!' }
      ];
      chatService.getChatHistory.mockResolvedValue(mockHistory);
      
      await chatController.getHistory(req, res);
      
      expect(chatService.getChatHistory).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({ history: mockHistory });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Database error');
      chatService.getChatHistory.mockRejectedValue(error);
      
      await chatController.getHistory(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch chat history' });
    });
  });
});