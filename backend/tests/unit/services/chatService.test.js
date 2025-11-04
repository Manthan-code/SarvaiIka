// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockOpenAI = {
  embeddings: {
    create: jest.fn()
  },
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

const mockQdrant = {
  search: jest.fn()
};

// Mock Supabase with proper chaining
const createMockChain = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  range: jest.fn().mockResolvedValue({ data: [] })
});

const mockSupabase = {
  from: jest.fn(() => createMockChain())
};

const { createClient } = require('@supabase/supabase-js');

jest.mock('../../../src/config/logger.js', () => mockLogger);
jest.mock('openai', () => jest.fn(() => mockOpenAI));
jest.mock('../../../src/db/qdrant/client.js', () => mockQdrant);
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

const chatService = require('../../../src/services/chatService');

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEmbedding', () => {
    it('should generate embeddings for text', async () => {
      const text = 'Hello world';
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const result = await chatService.getEmbedding(text);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: text
      });
      expect(result).toEqual(mockEmbedding);
    });
  });

  describe('retrieveContext', () => {
    it('should retrieve context from vector database', async () => {
      const query = 'test query';
      const mockResults = [
        { payload: { text: 'Context 1' }, score: 0.9 },
        { payload: { text: 'Context 2' }, score: 0.8 }
      ];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });
      mockQdrant.search.mockResolvedValue(mockResults);

      const result = await chatService.retrieveContext(query);

      expect(mockQdrant.search).toHaveBeenCalled();
      expect(result).toEqual(['Context 1', 'Context 2']);
    });
  });

  describe('generateChatResponse', () => {
    it('should generate AI response', async () => {
      const userQuery = 'What is AI?';
      const mockResponse = 'AI stands for Artificial Intelligence...';

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });
      mockQdrant.search.mockResolvedValue([]);
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const result = await chatService.generateChatResponse(userQuery);

      expect(result).toBe(mockResponse);
    });
  });

  describe('getChatHistory', () => {
    it('should return hardcoded chat history', async () => {
      const userId = 'user123';

      const result = await chatService.getChatHistory(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        from: 'user',
        message: 'Hello',
        timestamp: expect.any(String)
      });
      expect(result[1]).toEqual({
        from: 'agent',
        message: 'Hi there!',
        timestamp: expect.any(String)
      });
    });
  });

  describe('saveChatMessage', () => {
    it('should log the message being saved', async () => {
      const userId = 'user123';
      const message = 'Hello world';
      const from = 'user';

      const result = await chatService.saveChatMessage(userId, message, from);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Saving message for user ${userId}:`,
        { from, message }
      );
      expect(result).toBeUndefined();
    });

    it('should default from parameter to user', async () => {
      const userId = 'user123';
      const message = 'Hello world';

      await chatService.saveChatMessage(userId, message);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Saving message for user ${userId}:`,
        { from: 'user', message }
      );
    });
  });

  describe('getUserChats', () => {
    it('should retrieve user chats from database', async () => {
      const userId = 'user123';
      const mockChats = [
        { id: 'chat1', title: 'Chat 1', updated_at: '2023-01-01T00:00:00Z' }
      ];

      // Mock the complete Supabase chain for getUserChats
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockChats })
      };
      
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await chatService.getUserChats(userId);

      expect(mockSupabase.from).toHaveBeenCalledWith('chats');
      expect(result).toEqual(mockChats);
    });
  });

  describe('getChatMessages', () => {
    it('should retrieve chat messages from database', async () => {
      const chatId = 'chat123';
      const mockMessages = [
        { id: 'msg1', content: 'Hello', role: 'user', created_at: '2023-01-01T00:00:00Z' }
      ];

      // Mock the complete Supabase chain for getChatMessages
      const mockQuery = Promise.resolve({ data: mockMessages });
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        then: mockQuery.then.bind(mockQuery),
        catch: mockQuery.catch.bind(mockQuery),
        finally: mockQuery.finally.bind(mockQuery),
        [Symbol.toStringTag]: 'Promise'
      };
      
      // Make the chain thenable/awaitable
      Object.setPrototypeOf(mockChain, Promise.prototype);
      mockChain.then = mockQuery.then.bind(mockQuery);
      
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await chatService.getChatMessages(chatId);

      expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages');
      expect(result).toEqual(mockMessages.reverse());
    });
  });
});