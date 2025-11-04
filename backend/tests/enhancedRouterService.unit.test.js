/**
 * Enhanced Router Service Unit Tests
 * Comprehensive tests for all methods and edge cases
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const EnhancedRouterService = require('../src/services/enhancedRouterService');
const MockAiService = require('../src/services/mockAiService');
const HybridClassifier = require('../src/services/hybridClassifier');

// Mock dependencies
jest.mock('../src/services/mockAiService');
jest.mock('../src/services/hybridClassifier');
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('EnhancedRouterService Unit Tests', () => {
  let routerService;
  let mockAiService;
  let hybridClassifier;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock instances
    mockAiService = {
      getAvailableModels: jest.fn().mockReturnValue([
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', capabilities: ['text'] },
        { id: 'gpt-4', name: 'GPT-4', capabilities: ['text', 'coding'] },
        { id: 'dall-e-3', name: 'DALL-E 3', capabilities: ['image'] },
        { id: 'codellama-34b', name: 'CodeLlama 34B', capabilities: ['coding'] }
      ])
    };
    
    hybridClassifier = {
      classifyQuery: jest.fn()
    };
    
    MockAiService.mockImplementation(() => mockAiService);
    HybridClassifier.mockImplementation(() => hybridClassifier);
    
    routerService = new EnhancedRouterService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct default values', () => {
      expect(routerService.mockAi).toBeDefined();
      expect(routerService.hybridClassifier).toBeDefined();
      expect(routerService.routingRules).toBeDefined();
      expect(routerService.patterns).toBeDefined();
      expect(routerService.contextCache).toBeInstanceOf(Map);
    });

    it('should initialize routing rules with all content types', () => {
      const rules = routerService.routingRules;
      expect(rules.contentType).toHaveProperty('coding');
      expect(rules.contentType).toHaveProperty('image');
      expect(rules.contentType).toHaveProperty('video');
      expect(rules.contentType).toHaveProperty('text');
      expect(rules.difficulty).toHaveProperty('hard');
      expect(rules.difficulty).toHaveProperty('easy');
    });

    it('should initialize patterns for text processing', () => {
      const patterns = routerService.patterns;
      expect(patterns).toHaveProperty('codeBlocks');
      expect(patterns).toHaveProperty('urls');
      expect(patterns).toHaveProperty('emails');
      expect(patterns).toHaveProperty('technicalTerms');
      expect(patterns).toHaveProperty('programmingLanguages');
    });
  });

  describe('routeQuery', () => {
    it('should route simple text queries correctly', async () => {
      const mockClassification = {
        type: 'text',
        difficulty: 'easy',
        confidence: 0.85,
        reasoning: 'Simple question pattern detected',
        method: 'local'
      };
      
      hybridClassifier.classifyQuery.mockResolvedValue(mockClassification);
      
      const result = await routerService.routeQuery('What is JavaScript?', {
        sessionId: 'test-session',
        userId: 'test-user'
      });
      
      expect(result.type).toBe('text');
      expect(result.difficulty).toBe('easy');
      expect(result.primaryModel).toBeDefined();
      expect(result.confidence).toBe(0.85);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.classificationMethod).toBe('local');
    });

    it('should route coding queries to appropriate models', async () => {
      const mockClassification = {
        type: 'coding',
        difficulty: 'hard',
        confidence: 0.92,
        reasoning: 'Code implementation request detected',
        method: 'local'
      };
      
      hybridClassifier.classifyQuery.mockResolvedValue(mockClassification);
      
      const result = await routerService.routeQuery(
        'Write a Python function to implement binary search',
        { sessionId: 'test-session', subscriptionPlan: 'pro' }
      );
      
      expect(result.type).toBe('coding');
      expect(result.difficulty).toBe('hard');
      expect(result.primaryModel).toBeDefined();
      expect(result.confidence).toBe(0.92);
    });

    it('should route image generation requests correctly', async () => {
      const mockClassification = {
        type: 'image',
        difficulty: 'easy',
        confidence: 0.88,
        reasoning: 'Image generation request detected',
        method: 'local'
      };
      
      hybridClassifier.classifyQuery.mockResolvedValue(mockClassification);
      
      const result = await routerService.routeQuery(
        'Generate an image of a sunset over mountains',
        { sessionId: 'test-session' }
      );
      
      expect(result.type).toBe('image');
      expect(result.primaryModel).toBeDefined();
    });

    it('should handle context and update cache', async () => {
      const mockClassification = {
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      };
      
      hybridClassifier.classifyQuery.mockResolvedValue(mockClassification);
      
      const sessionId = 'test-session-123';
      await routerService.routeQuery('Test query', { sessionId });
      
      // Check if context was cached
      const cachedContext = routerService.contextCache.get(sessionId);
      expect(cachedContext).toBeDefined();
      expect(cachedContext.lastQuery).toBe('Test query');
      expect(cachedContext.timestamp).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      hybridClassifier.classifyQuery.mockRejectedValue(new Error('Classification failed'));
      
      const result = await routerService.routeQuery('Test query', { sessionId: 'test' });
      
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.primaryModel).toBeDefined();
    });
  });

  describe('selectModelForClassification', () => {
    it('should select appropriate model for coding tasks', () => {
      const classification = {
        type: 'coding',
        difficulty: 'hard',
        confidence: 0.9
      };
      
      const model = routerService.selectModelForClassification(classification);
      expect(model).toBeDefined();
      expect(typeof model).toBe('string');
    });

    it('should select appropriate model for text tasks', () => {
      const classification = {
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8
      };
      
      const model = routerService.selectModelForClassification(classification);
      expect(model).toBeDefined();
      expect(typeof model).toBe('string');
    });

    it('should select appropriate model for image tasks', () => {
      const classification = {
        type: 'image',
        difficulty: 'easy',
        confidence: 0.85
      };
      
      const model = routerService.selectModelForClassification(classification);
      expect(model).toBeDefined();
    });

    it('should handle unknown classification types', () => {
      const classification = {
        type: 'unknown',
        difficulty: 'easy',
        confidence: 0.5
      };
      
      const model = routerService.selectModelForClassification(classification);
      expect(model).toBeDefined();
    });
  });

  describe('updateContextCache', () => {
    it('should update context cache with new data', () => {
      const sessionId = 'test-session';
      const contextData = {
        lastQuery: 'Test query',
        lastRouting: { type: 'text', difficulty: 'easy' },
        timestamp: Date.now()
      };
      
      routerService.updateContextCache(sessionId, contextData);
      
      const cached = routerService.contextCache.get(sessionId);
      expect(cached).toEqual(contextData);
    });

    it('should handle null sessionId gracefully', () => {
      expect(() => {
        routerService.updateContextCache(null, { test: 'data' });
      }).not.toThrow();
    });
  });

  describe('getDefaultRouting', () => {
    it('should return valid default routing', () => {
      const defaultRouting = routerService.getDefaultRouting();
      
      expect(defaultRouting).toBeDefined();
      expect(defaultRouting.type).toBeDefined();
      expect(defaultRouting.difficulty).toBeDefined();
      expect(defaultRouting.primaryModel).toBeDefined();
      expect(defaultRouting.confidence).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty query strings', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.5,
        method: 'local'
      });
      
      const result = await routerService.routeQuery('', { sessionId: 'test' });
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(10000);
      
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.7,
        method: 'local'
      });
      
      const result = await routerService.routeQuery(longQuery, { sessionId: 'test' });
      expect(result).toBeDefined();
    });

    it('should handle special characters in queries', async () => {
      const specialQuery = '!@#$%^&*()_+{}|:<>?[]\\;\',./`~';
      
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.6,
        method: 'local'
      });
      
      const result = await routerService.routeQuery(specialQuery, { sessionId: 'test' });
      expect(result).toBeDefined();
    });

    it('should handle missing context gracefully', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      });
      
      const result = await routerService.routeQuery('Test query');
      expect(result).toBeDefined();
    });

    it('should handle malformed context objects', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      });
      
      const result = await routerService.routeQuery('Test query', 'invalid-context');
      expect(result).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should complete routing within reasonable time', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      });
      
      const startTime = Date.now();
      await routerService.routeQuery('Test query', { sessionId: 'test' });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple concurrent requests', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      });
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(routerService.routeQuery(`Query ${i}`, { sessionId: `session-${i}` }));
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.type).toBeDefined();
      });
    });
  });

  describe('Context Cache Management', () => {
    it('should maintain separate contexts for different sessions', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      });
      
      await routerService.routeQuery('Query 1', { sessionId: 'session-1' });
      await routerService.routeQuery('Query 2', { sessionId: 'session-2' });
      
      const context1 = routerService.contextCache.get('session-1');
      const context2 = routerService.contextCache.get('session-2');
      
      expect(context1.lastQuery).toBe('Query 1');
      expect(context2.lastQuery).toBe('Query 2');
    });

    it('should update existing context for same session', async () => {
      hybridClassifier.classifyQuery.mockResolvedValue({
        type: 'text',
        difficulty: 'easy',
        confidence: 0.8,
        method: 'local'
      });
      
      await routerService.routeQuery('First query', { sessionId: 'session-1' });
      await routerService.routeQuery('Second query', { sessionId: 'session-1' });
      
      const context = routerService.contextCache.get('session-1');
      expect(context.lastQuery).toBe('Second query');
    });
  });
});