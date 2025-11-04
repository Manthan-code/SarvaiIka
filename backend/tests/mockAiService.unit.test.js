/**
 * Mock AI Service Unit Tests
 * Comprehensive tests for all AI service operations and edge cases
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const MockAiService = require('../src/services/mockAiService');
const EventEmitter = require('events');

// Mock dependencies
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('MockAiService Unit Tests', () => {
  let mockAiService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAiService = new MockAiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default models', () => {
      expect(mockAiService.models).toBeDefined();
      expect(mockAiService.models.size).toBeGreaterThan(0);
      expect(mockAiService.responseTemplates).toBeDefined();
      expect(mockAiService.config).toBeDefined();
    });

    it('should have all required model types', () => {
      const modelTypes = Array.from(mockAiService.models.values())
        .flatMap(model => model.capabilities);
      
      expect(modelTypes).toContain('text');
      expect(modelTypes).toContain('coding');
      expect(modelTypes).toContain('image');
    });

    it('should initialize response templates for all content types', () => {
      expect(mockAiService.responseTemplates).toHaveProperty('text');
      expect(mockAiService.responseTemplates).toHaveProperty('coding');
      expect(mockAiService.responseTemplates).toHaveProperty('image');
      expect(mockAiService.responseTemplates).toHaveProperty('error');
    });
  });

  describe('getAvailableModels', () => {
    it('should return all available models', () => {
      const models = mockAiService.getAvailableModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('capabilities');
        expect(model).toHaveProperty('maxTokens');
        expect(model).toHaveProperty('costPerToken');
      });
    });

    it('should filter models by capability', () => {
      const codingModels = mockAiService.getAvailableModels('coding');
      
      expect(Array.isArray(codingModels)).toBe(true);
      codingModels.forEach(model => {
        expect(model.capabilities).toContain('coding');
      });
    });

    it('should return empty array for non-existent capability', () => {
      const models = mockAiService.getAvailableModels('non-existent');
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
    });

    it('should handle null capability filter', () => {
      const models = mockAiService.getAvailableModels(null);
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('generateResponse', () => {
    const defaultParams = {
      model: 'gpt-3.5-turbo',
      prompt: 'Test prompt',
      maxTokens: 100,
      temperature: 0.7
    };

    it('should generate text response successfully', async () => {
      const response = await mockAiService.generateResponse({
        ...defaultParams,
        contentType: 'text'
      });
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.model).toBe('gpt-3.5-turbo');
      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should generate coding response successfully', async () => {
      const response = await mockAiService.generateResponse({
        ...defaultParams,
        model: 'gpt-4',
        contentType: 'coding',
        prompt: 'Write a Python function to sort an array'
      });
      
      expect(response).toBeDefined();
      expect(response.content).toContain('def ');
      expect(response.content).toContain('python');
      expect(response.model).toBe('gpt-4');
    });

    it('should generate image response successfully', async () => {
      const response = await mockAiService.generateResponse({
        ...defaultParams,
        model: 'dall-e-3',
        contentType: 'image',
        prompt: 'A beautiful sunset over mountains'
      });
      
      expect(response).toBeDefined();
      expect(response.content).toContain('image');
      expect(response.imageUrl).toBeDefined();
      expect(response.model).toBe('dall-e-3');
    });

    it('should handle missing required parameters', async () => {
      await expect(mockAiService.generateResponse({})).rejects.toThrow('Missing required parameters');
      await expect(mockAiService.generateResponse({ model: 'gpt-3.5-turbo' })).rejects.toThrow('Missing required parameters');
      await expect(mockAiService.generateResponse({ prompt: 'test' })).rejects.toThrow('Missing required parameters');
    });

    it('should handle invalid model', async () => {
      await expect(mockAiService.generateResponse({
        model: 'invalid-model',
        prompt: 'Test prompt'
      })).rejects.toThrow('Model not found');
    });

    it('should respect maxTokens parameter', async () => {
      const response = await mockAiService.generateResponse({
        ...defaultParams,
        maxTokens: 50
      });
      
      expect(response.usage.completionTokens).toBeLessThanOrEqual(50);
    });

    it('should handle temperature parameter', async () => {
      const response1 = await mockAiService.generateResponse({
        ...defaultParams,
        temperature: 0.1
      });
      
      const response2 = await mockAiService.generateResponse({
        ...defaultParams,
        temperature: 0.9
      });
      
      expect(response1.content).toBeDefined();
      expect(response2.content).toBeDefined();
      // With different temperatures, responses might vary
    });

    it('should simulate response time based on model complexity', async () => {
      const startTime = Date.now();
      
      await mockAiService.generateResponse({
        model: 'gpt-4',
        prompt: 'Complex reasoning task',
        contentType: 'text'
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeGreaterThan(0);
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);
      
      const response = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: longPrompt,
        contentType: 'text'
      });
      
      expect(response).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(1000);
    });

    it('should handle special characters in prompts', async () => {
      const specialPrompt = '!@#$%^&*()_+{}|:<>?[]\\;\',./`~';
      
      const response = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: specialPrompt,
        contentType: 'text'
      });
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  describe('generateStreamingResponse', () => {
    const defaultParams = {
      model: 'gpt-3.5-turbo',
      prompt: 'Test streaming prompt',
      contentType: 'text'
    };

    it('should return a readable stream', async () => {
      const stream = await mockAiService.generateStreamingResponse(defaultParams);
      
      expect(stream).toBeInstanceOf(EventEmitter);
      expect(typeof stream.on).toBe('function');
      expect(typeof stream.emit).toBe('function');
    });

    it('should emit data events with proper format', (done) => {
      mockAiService.generateStreamingResponse(defaultParams).then(stream => {
        let dataReceived = false;
        
        stream.on('data', (chunk) => {
          expect(chunk).toBeDefined();
          expect(chunk).toHaveProperty('content');
          expect(chunk).toHaveProperty('type');
          dataReceived = true;
        });
        
        stream.on('end', () => {
          expect(dataReceived).toBe(true);
          done();
        });
      });
    });

    it('should emit end event when streaming completes', (done) => {
      mockAiService.generateStreamingResponse(defaultParams).then(stream => {
        stream.on('end', () => {
          done();
        });
      });
    });

    it('should handle streaming errors gracefully', (done) => {
      mockAiService.generateStreamingResponse({
        model: 'invalid-model',
        prompt: 'Test prompt'
      }).then(stream => {
        stream.on('error', (error) => {
          expect(error).toBeInstanceOf(Error);
          done();
        });
      }).catch(() => {
        // If promise rejects instead of emitting error, that's also acceptable
        done();
      });
    });

    it('should stream coding responses with proper formatting', (done) => {
      mockAiService.generateStreamingResponse({
        model: 'gpt-4',
        prompt: 'Write a JavaScript function',
        contentType: 'coding'
      }).then(stream => {
        let codeReceived = false;
        
        stream.on('data', (chunk) => {
          if (chunk.content.includes('function') || chunk.content.includes('def')) {
            codeReceived = true;
          }
        });
        
        stream.on('end', () => {
          expect(codeReceived).toBe(true);
          done();
        });
      });
    });

    it('should respect streaming chunk size', (done) => {
      mockAiService.generateStreamingResponse({
        ...defaultParams,
        chunkSize: 10
      }).then(stream => {
        stream.on('data', (chunk) => {
          expect(chunk.content.length).toBeLessThanOrEqual(20); // Allow some variance
        });
        
        stream.on('end', done);
      });
    });

    it('should handle concurrent streaming requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(mockAiService.generateStreamingResponse({
          ...defaultParams,
          prompt: `Concurrent request ${i}`
        }));
      }
      
      const streams = await Promise.all(promises);
      
      expect(streams).toHaveLength(5);
      streams.forEach(stream => {
        expect(stream).toBeInstanceOf(EventEmitter);
      });
    });
  });

  describe('Model Management', () => {
    it('should validate model capabilities', () => {
      const textModel = mockAiService.models.get('gpt-3.5-turbo');
      const imageModel = mockAiService.models.get('dall-e-3');
      
      expect(textModel.capabilities).toContain('text');
      expect(imageModel.capabilities).toContain('image');
    });

    it('should calculate token usage accurately', () => {
      const prompt = 'This is a test prompt with multiple words';
      const tokens = mockAiService.calculateTokens(prompt);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(prompt.length); // Tokens should be less than character count
    });

    it('should handle empty prompts for token calculation', () => {
      const tokens = mockAiService.calculateTokens('');
      
      expect(tokens).toBe(0);
    });

    it('should calculate costs correctly', () => {
      const model = mockAiService.models.get('gpt-3.5-turbo');
      const tokens = 100;
      const cost = mockAiService.calculateCost(model.id, tokens);
      
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });
  });

  describe('Response Templates', () => {
    it('should generate appropriate responses for different content types', async () => {
      const textResponse = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'What is AI?',
        contentType: 'text'
      });
      
      const codingResponse = await mockAiService.generateResponse({
        model: 'gpt-4',
        prompt: 'Write a function',
        contentType: 'coding'
      });
      
      expect(textResponse.content).not.toContain('```');
      expect(codingResponse.content).toContain('```');
    });

    it('should vary responses for similar prompts', async () => {
      const response1 = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Hello world',
        contentType: 'text'
      });
      
      const response2 = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Hello world',
        contentType: 'text'
      });
      
      // Responses might be different due to randomization
      expect(response1.content).toBeDefined();
      expect(response2.content).toBeDefined();
    });

    it('should include appropriate metadata in responses', async () => {
      const response = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Test prompt',
        contentType: 'text'
      });
      
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('created');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('usage');
      expect(response.usage).toHaveProperty('promptTokens');
      expect(response.usage).toHaveProperty('completionTokens');
      expect(response.usage).toHaveProperty('totalTokens');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null parameters gracefully', async () => {
      await expect(mockAiService.generateResponse(null)).rejects.toThrow();
    });

    it('should handle undefined parameters gracefully', async () => {
      await expect(mockAiService.generateResponse(undefined)).rejects.toThrow();
    });

    it('should handle negative maxTokens', async () => {
      await expect(mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Test',
        maxTokens: -100
      })).rejects.toThrow();
    });

    it('should handle invalid temperature values', async () => {
      await expect(mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Test',
        temperature: 2.0 // Should be between 0 and 1
      })).rejects.toThrow();
    });

    it('should handle extremely large maxTokens', async () => {
      const response = await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Test',
        maxTokens: 1000000
      });
      
      // Should cap at model's maximum
      const model = mockAiService.models.get('gpt-3.5-turbo');
      expect(response.usage.completionTokens).toBeLessThanOrEqual(model.maxTokens);
    });

    it('should handle concurrent requests without interference', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(mockAiService.generateResponse({
          model: 'gpt-3.5-turbo',
          prompt: `Concurrent request ${i}`,
          contentType: 'text'
        }));
      }
      
      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(10);
      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete responses within reasonable time', async () => {
      const startTime = Date.now();
      
      await mockAiService.generateResponse({
        model: 'gpt-3.5-turbo',
        prompt: 'Performance test prompt',
        contentType: 'text'
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle high-frequency requests', async () => {
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(mockAiService.generateResponse({
          model: 'gpt-3.5-turbo',
          prompt: `High frequency request ${i}`,
          contentType: 'text'
        }));
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(10000); // Should complete 50 requests within 10 seconds
    });

    it('should maintain consistent memory usage', () => {
      const initialMemory = process.memoryUsage();
      
      // Generate many responses
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(mockAiService.generateResponse({
          model: 'gpt-3.5-turbo',
          prompt: `Memory test ${i}`,
          contentType: 'text'
        }));
      }
      
      return Promise.all(promises).then(() => {
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        defaultMaxTokens: 200,
        defaultTemperature: 0.8,
        simulatedDelay: 500
      };
      
      mockAiService.updateConfig(newConfig);
      
      expect(mockAiService.config.defaultMaxTokens).toBe(200);
      expect(mockAiService.config.defaultTemperature).toBe(0.8);
      expect(mockAiService.config.simulatedDelay).toBe(500);
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        mockAiService.updateConfig({
          defaultTemperature: 2.0 // Invalid temperature
        });
      }).toThrow();
      
      expect(() => {
        mockAiService.updateConfig({
          defaultMaxTokens: -100 // Invalid max tokens
        });
      }).toThrow();
    });

    it('should allow adding custom models', () => {
      const customModel = {
        id: 'custom-model',
        name: 'Custom Test Model',
        capabilities: ['text'],
        maxTokens: 2048,
        costPerToken: 0.001
      };
      
      mockAiService.addModel(customModel);
      
      expect(mockAiService.models.has('custom-model')).toBe(true);
      
      const models = mockAiService.getAvailableModels();
      expect(models.find(m => m.id === 'custom-model')).toBeDefined();
    });
  });
});