/**
 * Enhanced Router Service Unit Tests
 * Tests routing logic, pattern matching, and context analysis
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const EnhancedRouterService = require('../../../src/services/enhancedRouterService');

// Mock dependencies
jest.mock('../../../src/services/mockAiService');
jest.mock('../../../src/services/hybridClassifier');
jest.mock('../../../src/config/logger');

const MockAiService = require('../../../src/services/mockAiService');
const HybridClassifier = require('../../../src/services/hybridClassifier');

describe('EnhancedRouterService', () => {
  let routerService;
  let mockAiService;
  let mockHybridClassifier;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock MockAiService
    mockAiService = {
      getAvailableModels: jest.fn().mockReturnValue([
        { id: 'gpt-4', name: 'GPT-4', specialty: 'coding' },
        { id: 'dall-e-3', name: 'DALL-E 3', specialty: 'image' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', specialty: 'text' }
      ]),
      generateResponse: jest.fn().mockResolvedValue('Mock response')
    };
    MockAiService.mockImplementation(() => mockAiService);

    // Mock HybridClassifier
    mockHybridClassifier = {
      classifyQuery: jest.fn().mockImplementation((query) => {
        // Return different types based on query content
        if (query.toLowerCase().includes('image') || query.toLowerCase().includes('picture') || query.toLowerCase().includes('create an image')) {
          return { type: 'image', confidence: 0.85, difficulty: 'medium' };
        } else if (query.toLowerCase().includes('code') || query.toLowerCase().includes('function') || query.toLowerCase().includes('python')) {
          return { type: 'coding', confidence: 0.85, difficulty: 'medium' };
        } else {
          return { type: 'text', confidence: 0.85, difficulty: 'medium' };
        }
      }),
      getPerformanceStats: jest.fn().mockReturnValue({
        accuracy: 0.92,
        totalClassifications: 100
      })
    };
    HybridClassifier.mockImplementation(() => mockHybridClassifier);

    routerService = new EnhancedRouterService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct dependencies', () => {
      expect(routerService.mockAi).toBeDefined();
      expect(routerService.hybridClassifier).toBeDefined();
      expect(routerService.routingRules).toBeDefined();
      expect(routerService.patterns).toBeDefined();
      expect(routerService.contextCache).toBeInstanceOf(Map);
    });

    it('should initialize routing rules correctly', () => {
      const rules = routerService.routingRules;
      expect(rules.contentType).toBeDefined();
      expect(rules.difficulty).toBeDefined();
      expect(rules.context).toBeDefined();
      
      expect(rules.contentType.coding).toBeDefined();
      expect(rules.contentType.image).toBeDefined();
      expect(rules.contentType.text).toBeDefined();
    });

    it('should initialize patterns correctly', () => {
      const patterns = routerService.patterns;
      expect(patterns.codeBlocks).toBeInstanceOf(RegExp);
      expect(patterns.urls).toBeInstanceOf(RegExp);
      expect(patterns.technicalTerms).toBeInstanceOf(RegExp);
    });
  });

  describe('Query Preprocessing', () => {
    it('should preprocess simple text query correctly', () => {
      const query = 'What is JavaScript?';
      const result = routerService.preprocessQuery(query);

      expect(result.original).toBe(query);
      expect(result.cleaned).toBe('what is javascript?');
      expect(result.tokens).toContain('what');
      expect(result.tokens).toContain('javascript');
      expect(result.length).toBe(query.length);
      expect(result.wordCount).toBe(3);
      expect(result.hasCodeBlocks).toBe(false);
      expect(result.hasUrls).toBe(false);
    });

    it('should detect code blocks in query', () => {
      const query = 'Here is some code: ```function test() { return true; }```';
      const result = routerService.preprocessQuery(query);

      expect(result.hasCodeBlocks).toBe(true);
    });

    it('should detect URLs in query', () => {
      const query = 'Check this link: https://example.com';
      const result = routerService.preprocessQuery(query);

      expect(result.hasUrls).toBe(true);
    });

    it('should extract technical terms', () => {
      const query = 'I need help with REST API and JSON parsing';
      const result = routerService.preprocessQuery(query);

      expect(result.technicalTerms).toContain('rest');
      expect(result.technicalTerms).toContain('api');
      expect(result.technicalTerms).toContain('json');
    });

    it('should extract programming languages', () => {
      const query = 'I want to learn Python and JavaScript';
      const result = routerService.preprocessQuery(query);

      expect(result.programmingLanguages).toContain('python');
      expect(result.programmingLanguages).toContain('javascript');
    });
  });

  describe('Content Type Analysis', () => {
    it('should identify coding queries correctly', () => {
      const queries = [
        'Write a function to sort an array',
        'How to debug this JavaScript error?',
        'Create a React component',
        'Implement a binary search algorithm'
      ];

      queries.forEach(query => {
        const preprocessed = routerService.preprocessQuery(query);
        const analysis = routerService.analyzeContentType(preprocessed);
        
        expect(analysis.type).toBe('coding');
        expect(analysis.confidence).toBeGreaterThan(0.1);
      });
    });

    it('should identify image generation queries correctly', () => {
      const queries = [
        'Create an image of a sunset',
        'Generate a logo for my company',
        'Draw a picture of a cat',
        'Make an illustration of a tree'
      ];

      queries.forEach(query => {
        const preprocessed = routerService.preprocessQuery(query);
        const analysis = routerService.analyzeContentType(preprocessed);
        
        expect(analysis.type).toBe('image');
        expect(analysis.confidence).toBeGreaterThan(0.3);
      });
    });

    it('should identify text queries correctly', () => {
      const queries = [
        'What is the capital of France?',
        'Explain quantum physics',
        'Tell me about history',
        'How does photosynthesis work?'
      ];

      queries.forEach(query => {
        const preprocessed = routerService.preprocessQuery(query);
        const analysis = routerService.analyzeContentType(preprocessed);
        
        expect(analysis.type).toBe('text');
        expect(analysis.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should handle ambiguous queries', () => {
      const query = 'help';
      const preprocessed = routerService.preprocessQuery(query);
      const analysis = routerService.analyzeContentType(preprocessed);
      
      expect(analysis.type).toBe('text'); // Default fallback
      expect(analysis.confidence).toBeLessThan(0.8);
    });
  });

  describe('Difficulty Assessment', () => {
    it('should identify hard queries correctly', () => {
      const queries = [
        'Design a scalable microservices architecture for enterprise applications',
        'Implement advanced machine learning optimization algorithms',
        'Create a comprehensive distributed system with performance tuning'
      ];

      queries.forEach(query => {
        const preprocessed = routerService.preprocessQuery(query);
        const difficulty = routerService.assessDifficulty(preprocessed);
        
        expect(difficulty.level).toBe('hard');
      });
    });

    it('should identify easy queries correctly', () => {
      const queries = [
        'What is a variable?',
        'Simple tutorial on HTML',
        'Basic introduction to programming',
        'How to print hello world?'
      ];

      queries.forEach(query => {
        const preprocessed = routerService.preprocessQuery(query);
        const difficulty = routerService.assessDifficulty(preprocessed);
        
        expect(difficulty.level).toBe('easy');
      });
    });

    it('should consider query length in difficulty assessment', () => {
      const shortQuery = 'help';
      const longQuery = 'I need a detailed, comprehensive, and thorough explanation of advanced software architecture patterns including microservices, event sourcing, CQRS, and distributed system design principles with practical implementation examples and performance optimization strategies';

      const shortPreprocessed = routerService.preprocessQuery(shortQuery);
      const longPreprocessed = routerService.preprocessQuery(longQuery);

      const shortDifficulty = routerService.assessDifficulty(shortPreprocessed);
      const longDifficulty = routerService.assessDifficulty(longPreprocessed);

      expect(shortDifficulty.level).toBe('easy');
      expect(longDifficulty.level).toBe('hard');
    });
  });

  describe('Context Analysis', () => {
    it('should detect follow-up queries', () => {
      const query = 'Can you also explain more about this topic?';
      const preprocessed = routerService.preprocessQuery(query);
      const context = routerService.analyzeContext(preprocessed, { sessionId: 'test-session' });

      expect(context.isFollowUp).toBe(true);
      expect(context.isCorrection).toBe(false);
    });

    it('should detect correction queries', () => {
      const query = 'No, that\'s not quite right. Please fix the code.';
      const preprocessed = routerService.preprocessQuery(query);
      const context = routerService.analyzeContext(preprocessed, { sessionId: 'test-session' });

      expect(context.isCorrection).toBe(true);
      expect(context.isFollowUp).toBe(false);
    });

    it('should handle context without session history', () => {
      const query = 'What is JavaScript?';
      const preprocessed = routerService.preprocessQuery(query);
      const context = routerService.analyzeContext(preprocessed, { sessionId: 'new-session' });

      expect(context.hasHistory).toBe(false);
      expect(context.lastType).toBeUndefined();
      expect(context.timeSinceLastQuery).toBeNull();
    });
  });

  describe('Model Selection', () => {
    it('should select appropriate model for coding queries', async () => {
      const query = 'Write a Python function to calculate fibonacci';
      const result = await routerService.routeQuery(query, { sessionId: 'test' });

      expect(result).toBeDefined();
      expect(result.primaryModel).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.type).toBe('coding');
    });

    it('should select appropriate model for image queries', async () => {
      const query = 'Create an image of a beautiful landscape';
      const result = await routerService.routeQuery(query, { sessionId: 'test' });

      expect(result).toBeDefined();
      expect(result.primaryModel).toBeDefined();
      expect(result.type).toBe('image');
    });

    it('should handle subscription plan constraints', async () => {
      const query = 'Complex enterprise architecture design';
      const freeResult = await routerService.routeQuery(query, { 
        sessionId: 'test',
        subscriptionPlan: 'free' 
      });
      const proResult = await routerService.routeQuery(query, { 
        sessionId: 'test',
        subscriptionPlan: 'pro' 
      });

      expect(freeResult).toBeDefined();
      expect(proResult).toBeDefined();
      expect(freeResult.primaryModel).toBeDefined();
      expect(proResult.primaryModel).toBeDefined();
    });
  });

  describe('Context Cache Management', () => {
    it('should update context cache correctly', () => {
      const sessionId = 'test-session';
      const data = { lastQuery: 'test query', timestamp: Date.now() };

      routerService.updateContextCache(sessionId, data);

      const cached = routerService.contextCache.get(sessionId);
      expect(cached).toEqual(data);
    });

    it('should clear context cache', () => {
      routerService.contextCache.set('session1', { data: 'test' });
      routerService.contextCache.set('session2', { data: 'test' });

      expect(routerService.contextCache.size).toBe(2);

      routerService.clearContextCache();

      expect(routerService.contextCache.size).toBe(0);
    });

    it('should handle null session ID gracefully', () => {
      expect(() => {
        routerService.updateContextCache(null, { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should tokenize text correctly', () => {
      const text = 'Hello, world! This is a test.';
      const tokens = routerService.tokenize(text);

      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('this');
      expect(tokens).toContain('test');
      expect(tokens).not.toContain('is'); // Too short
      expect(tokens).not.toContain('a'); // Too short
    });

    it('should extract technical terms correctly', () => {
      const query = 'I need help with REST API, JSON, and HTTP requests';
      const terms = routerService.extractTechnicalTerms(query);

      expect(terms).toContain('rest');
      expect(terms).toContain('api');
      expect(terms).toContain('json');
      expect(terms).toContain('http');
    });

    it('should extract programming languages correctly', () => {
      const query = 'I want to learn JavaScript, Python, and TypeScript';
      const languages = routerService.extractProgrammingLanguages(query);

      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('typescript');
    });
  });

  describe('Performance and Statistics', () => {
    it('should return routing statistics', () => {
      const stats = routerService.getRoutingStats();

      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('availableModels');
      expect(stats).toHaveProperty('routingRules');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.availableModels).toBe('number');
      expect(typeof stats.routingRules).toBe('number');
    });

    it('should return hybrid performance stats', () => {
      const stats = routerService.getHybridPerformanceStats();

      expect(stats).toHaveProperty('accuracy');
      expect(stats).toHaveProperty('totalClassifications');
      expect(mockHybridClassifier.getPerformanceStats).toHaveBeenCalled();
    });

    it('should return health check status', () => {
      const health = routerService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('contextCacheSize');
      expect(health).toHaveProperty('routingRules');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('timestamp');
      expect(health.status).toBe('healthy');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty query', () => {
      const query = '';
      const result = routerService.preprocessQuery(query);

      expect(result.original).toBe('');
      expect(result.cleaned).toBe('');
      expect(result.tokens).toEqual([]);
      expect(result.wordCount).toBe(1); // Empty string split gives array with one empty element
    });

    it('should handle very long query', () => {
      const query = 'a'.repeat(10000);
      const result = routerService.preprocessQuery(query);

      expect(result.original).toBe(query);
      expect(result.length).toBe(10000);
    });

    it('should handle special characters in query', () => {
      const query = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = routerService.preprocessQuery(query);

      expect(result.original).toBe(query);
      expect(result.tokens).toEqual([]); // Special chars should be filtered out
    });

    it('should handle non-string input gracefully', () => {
      expect(() => {
        routerService.preprocessQuery(null);
      }).not.toThrow();

      expect(() => {
        routerService.preprocessQuery(undefined);
      }).not.toThrow();

      expect(() => {
        routerService.preprocessQuery(123);
      }).not.toThrow();
    });
  });

  describe('Integration with Dependencies', () => {
    it('should use hybrid classifier for query classification', async () => {
      const query = 'Write a function';
      const context = { sessionId: 'test' };
      await routerService.routeQuery(query, context);

      expect(mockHybridClassifier.classifyQuery).toHaveBeenCalledWith(query, context);
    });

    it('should use mock AI service for model information', () => {
      const stats = routerService.getRoutingStats();
      
      expect(mockAiService.getAvailableModels).toHaveBeenCalled();
      expect(stats.availableModels).toBe(3); // Based on our mock
    });
  });
});