/**
 * AI Service Unit Tests
 * Comprehensive tests for AI service functionality
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  },
  embeddings: {
    create: jest.fn()
  },
  models: {
    list: jest.fn()
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/utils/logger', () => mockLogger);

// Mock cache
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  generateKey: jest.fn()
};

jest.mock('../../../src/utils/cache', () => mockCache);

const aiService = require('../../../src/services/aiService');

describe('AI Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.generateKey.mockImplementation((prefix, data) => `${prefix}:${JSON.stringify(data)}`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Chat Completion', () => {
    it('should generate chat completion successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Hello! How can I help you today?',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18
        },
        model: 'gpt-4'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await aiService.generateChatCompletion(messages);

      expect(result).toEqual({
        content: 'Hello! How can I help you today?',
        usage: mockResponse.usage,
        model: 'gpt-4'
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });
    });

    it('should use cached response when available', async () => {
      const cachedResponse = {
        content: 'Cached response',
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        model: 'gpt-4'
      };

      mockCache.get.mockResolvedValue(JSON.stringify(cachedResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await aiService.generateChatCompletion(messages);

      expect(result).toEqual(cachedResponse);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached chat completion');
    });

    it('should cache new responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'New response',
            role: 'assistant'
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        model: 'gpt-4'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      mockCache.get.mockResolvedValue(null);

      const messages = [{ role: 'user', content: 'Hello' }];
      await aiService.generateChatCompletion(messages);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('New response'),
        3600 // 1 hour cache
      );
    });

    it('should handle streaming responses', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: { content: ' there!' },
              finish_reason: 'stop'
            }]
          };
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await aiService.generateChatCompletion(messages, { stream: true });

      expect(result).toBeDefined();
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true })
      );
    });

    it('should handle different models', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response', role: 'assistant' } }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        model: 'gpt-3.5-turbo'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      await aiService.generateChatCompletion(messages, { model: 'gpt-3.5-turbo' });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-3.5-turbo' })
      );
    });

    it('should handle custom parameters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response', role: 'assistant' } }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        model: 'gpt-4'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      const options = {
        temperature: 0.9,
        max_tokens: 1000,
        top_p: 0.8,
        frequency_penalty: 0.5,
        presence_penalty: 0.3
      };

      await aiService.generateChatCompletion(messages, options);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining(options)
      );
    });

    it('should handle OpenAI API errors', async () => {
      const error = new Error('OpenAI API error');
      error.status = 429;
      error.code = 'rate_limit_exceeded';

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(aiService.generateChatCompletion(messages)).rejects.toThrow('OpenAI API error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OpenAI API error',
        expect.objectContaining({
          error: error.message,
          status: 429,
          code: 'rate_limit_exceeded'
        })
      );
    });

    it('should validate message format', async () => {
      const invalidMessages = [
        { content: 'Missing role' },
        { role: 'user' }, // Missing content
        { role: 'invalid', content: 'Invalid role' }
      ];

      for (const messages of invalidMessages) {
        await expect(aiService.generateChatCompletion([messages])).rejects.toThrow();
      }
    });

    it('should handle empty messages array', async () => {
      await expect(aiService.generateChatCompletion([])).rejects.toThrow('Messages array cannot be empty');
    });

    it('should handle system messages', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response', role: 'assistant' } }],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
        model: 'gpt-4'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ];

      await aiService.generateChatCompletion(messages);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ messages })
      );
    });
  });

  describe('Embeddings', () => {
    it('should generate embeddings successfully', async () => {
      const mockResponse = {
        data: [{
          embedding: [0.1, 0.2, 0.3, 0.4],
          index: 0
        }],
        usage: {
          prompt_tokens: 5,
          total_tokens: 5
        },
        model: 'text-embedding-ada-002'
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      const text = 'Hello world';
      const result = await aiService.generateEmbedding(text);

      expect(result).toEqual({
        embedding: [0.1, 0.2, 0.3, 0.4],
        usage: mockResponse.usage,
        model: 'text-embedding-ada-002'
      });

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: text
      });
    });

    it('should use cached embeddings when available', async () => {
      const cachedEmbedding = {
        embedding: [0.1, 0.2, 0.3, 0.4],
        usage: { prompt_tokens: 5, total_tokens: 5 },
        model: 'text-embedding-ada-002'
      };

      mockCache.get.mockResolvedValue(JSON.stringify(cachedEmbedding));

      const text = 'Hello world';
      const result = await aiService.generateEmbedding(text);

      expect(result).toEqual(cachedEmbedding);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached embedding');
    });

    it('should cache new embeddings', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }],
        usage: { prompt_tokens: 5, total_tokens: 5 },
        model: 'text-embedding-ada-002'
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);
      mockCache.get.mockResolvedValue(null);

      const text = 'Hello world';
      await aiService.generateEmbedding(text);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[0.1,0.2,0.3,0.4]'),
        86400 // 24 hours cache
      );
    });

    it('should handle batch embeddings', async () => {
      const mockResponse = {
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 }
        ],
        usage: { prompt_tokens: 10, total_tokens: 10 },
        model: 'text-embedding-ada-002'
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      const texts = ['Hello', 'World'];
      const result = await aiService.generateBatchEmbeddings(texts);

      expect(result).toEqual({
        embeddings: [[0.1, 0.2], [0.3, 0.4]],
        usage: mockResponse.usage,
        model: 'text-embedding-ada-002'
      });

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: texts
      });
    });

    it('should handle embedding API errors', async () => {
      const error = new Error('Embedding API error');
      error.status = 400;

      mockOpenAI.embeddings.create.mockRejectedValue(error);

      await expect(aiService.generateEmbedding('test')).rejects.toThrow('Embedding API error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate embedding input', async () => {
      await expect(aiService.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
      await expect(aiService.generateEmbedding(null)).rejects.toThrow('Text must be a string');
      await expect(aiService.generateEmbedding(undefined)).rejects.toThrow('Text must be a string');
    });

    it('should handle different embedding models', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2] }],
        usage: { prompt_tokens: 5, total_tokens: 5 },
        model: 'text-embedding-3-small'
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      await aiService.generateEmbedding('test', { model: 'text-embedding-3-small' });

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test'
      });
    });
  });

  describe('Model Management', () => {
    it('should list available models', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4', object: 'model', owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' }
        ]
      };

      mockOpenAI.models.list.mockResolvedValue(mockModels);

      const result = await aiService.listModels();

      expect(result).toEqual(mockModels.data);
      expect(mockOpenAI.models.list).toHaveBeenCalled();
    });

    it('should cache model list', async () => {
      const cachedModels = [
        { id: 'gpt-4', object: 'model', owned_by: 'openai' }
      ];

      mockCache.get.mockResolvedValue(JSON.stringify(cachedModels));

      const result = await aiService.listModels();

      expect(result).toEqual(cachedModels);
      expect(mockOpenAI.models.list).not.toHaveBeenCalled();
    });

    it('should validate model availability', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' }
        ]
      };

      mockOpenAI.models.list.mockResolvedValue(mockModels);

      const isAvailable = await aiService.isModelAvailable('gpt-4');
      const isNotAvailable = await aiService.isModelAvailable('gpt-5');

      expect(isAvailable).toBe(true);
      expect(isNotAvailable).toBe(false);
    });
  });

  describe('Token Management', () => {
    it('should estimate token count for text', () => {
      const text = 'Hello world, this is a test message.';
      const tokenCount = aiService.estimateTokens(text);

      expect(typeof tokenCount).toBe('number');
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should estimate token count for messages', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' }
      ];

      const tokenCount = aiService.estimateMessagesTokens(messages);

      expect(typeof tokenCount).toBe('number');
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should validate token limits', () => {
      const shortText = 'Hello';
      const longText = 'x'.repeat(10000);

      expect(aiService.isWithinTokenLimit(shortText, 'gpt-4')).toBe(true);
      expect(aiService.isWithinTokenLimit(longText, 'gpt-4')).toBe(false);
    });

    it('should truncate text to token limit', () => {
      const longText = 'This is a very long text that exceeds the token limit.';
      const truncated = aiService.truncateToTokenLimit(longText, 5);

      expect(aiService.estimateTokens(truncated)).toBeLessThanOrEqual(5);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit errors with retry', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      rateLimitError.headers = { 'retry-after': '1' };

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success', role: 'assistant' } }],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
        });

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await aiService.generateChatCompletion(messages, { retryOnRateLimit: true });

      expect(result.content).toBe('Success');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should respect retry limits', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(
        aiService.generateChatCompletion(messages, { retryOnRateLimit: true, maxRetries: 2 })
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Content Filtering', () => {
    it('should detect inappropriate content', () => {
      const inappropriateText = 'This contains harmful content';
      const appropriateText = 'This is a normal message';

      // Mock content filter
      const isInappropriate = aiService.containsInappropriateContent(inappropriateText);
      const isAppropriate = aiService.containsInappropriateContent(appropriateText);

      expect(typeof isInappropriate).toBe('boolean');
      expect(typeof isAppropriate).toBe('boolean');
    });

    it('should filter messages before sending to API', async () => {
      const messages = [
        { role: 'user', content: 'This is inappropriate content' }
      ];

      // Mock that content is flagged as inappropriate
      jest.spyOn(aiService, 'containsInappropriateContent').mockReturnValue(true);

      await expect(aiService.generateChatCompletion(messages)).rejects.toThrow('Content violates policy');
    });

    it('should sanitize user input', () => {
      const unsafeInput = '<script>alert("xss")</script>Hello';
      const sanitized = aiService.sanitizeInput(unsafeInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track API response times', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response', role: 'assistant' } }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      await aiService.generateChatCompletion(messages);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Chat completion generated',
        expect.objectContaining({
          duration: expect.any(Number),
          tokens: 18,
          model: expect.any(String)
        })
      );
    });

    it('should track token usage', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response', role: 'assistant' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      await aiService.generateChatCompletion(messages);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Chat completion generated',
        expect.objectContaining({
          tokens: 150,
          promptTokens: 100,
          completionTokens: 50
        })
      );
    });

    it('should monitor cache hit rates', async () => {
      // First call - cache miss
      mockCache.get.mockResolvedValueOnce(null);
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response', role: 'assistant' } }],
        usage: { total_tokens: 18 }
      });

      const messages = [{ role: 'user', content: 'Hello' }];
      await aiService.generateChatCompletion(messages);

      expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss for chat completion');

      // Second call - cache hit
      mockCache.get.mockResolvedValueOnce(JSON.stringify({
        content: 'Cached response',
        usage: { total_tokens: 18 }
      }));

      await aiService.generateChatCompletion(messages);

      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached chat completion');
    });
  });

  describe('Error Recovery', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockOpenAI.chat.completions.create.mockRejectedValue(timeoutError);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(aiService.generateChatCompletion(messages)).rejects.toThrow('Request timeout');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OpenAI API error',
        expect.objectContaining({
          error: 'Request timeout',
          code: 'ETIMEDOUT'
        })
      );
    });

    it('should handle API key errors', async () => {
      const authError = new Error('Invalid API key');
      authError.status = 401;

      mockOpenAI.chat.completions.create.mockRejectedValue(authError);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(aiService.generateChatCompletion(messages)).rejects.toThrow('Invalid API key');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service unavailable');
      serviceError.status = 503;

      mockOpenAI.chat.completions.create.mockRejectedValue(serviceError);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(aiService.generateChatCompletion(messages)).rejects.toThrow('Service unavailable');
    });
  });
});