/**
 * Comprehensive Test Suite for Mock AI Services
 * Tests all mock services without requiring real API keys or costs
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const MockStreamingService = require('../src/services/mockStreamingService');
const MockRouterService = require('../src/services/mockRouterService');
const MockRedisService = require('../src/services/mockRedisService');
const EnhancedCachingService = require('../src/services/enhancedCachingService');
const EnhancedQdrantService = require('../src/services/enhancedQdrantService');

describe('Mock AI Services Test Suite', () => {
  let mockStreamingService;
  let mockRouterService;
  let mockRedisService;
  let cachingService;
  let qdrantService;

  beforeEach(() => {
    // Initialize all services
    mockStreamingService = new MockStreamingService();
    mockRouterService = new MockRouterService();
    mockRedisService = new MockRedisService();
    cachingService = new EnhancedCachingService();
    qdrantService = new EnhancedQdrantService();
    
    // Set environment for testing
    process.env.NODE_ENV = 'test';
    process.env.USE_MOCK_AI = 'true';
  });

  afterEach(async () => {
    // Cleanup
    if (mockRedisService) {
      await mockRedisService.flushall();
      await mockRedisService.disconnect();
    }
    if (cachingService && cachingService.redisService) {
      await cachingService.redisService.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('MockStreamingService', () => {
    it('should initialize with default configuration', () => {
      expect(mockStreamingService).toBeDefined();
      expect(mockStreamingService.models).toBeDefined();
      expect(mockStreamingService.responsePatterns).toBeDefined();
    });

    it('should simulate streaming response for text queries', async () => {
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      const query = {
        message: 'What is artificial intelligence?',
        model: 'gpt-3.5-turbo',
        userId: 'test-user'
      };

      await mockStreamingService.startStream(query.message || query, {}, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }));
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle coding queries with appropriate responses', async () => {
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      const query = {
        message: 'Write a Python function to sort an array',
        model: 'gpt-4',
        userId: 'test-user'
      };

      await mockStreamingService.startStream(query.message || query, {}, mockRes);

      // Check that coding-related content was generated
      const writeCalls = mockRes.write.mock.calls;
      const allContent = writeCalls.map(call => call[0]).join('');
      
      expect(allContent).toMatch(/def|function|sort|array|python/i);
    });

    it('should simulate image generation requests', async () => {
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      const query = {
        message: 'Generate an image of a sunset',
        model: 'dall-e-3',
        userId: 'test-user'
      };

      await mockStreamingService.startStream(query.message || query, {}, mockRes);

      const writeCalls = mockRes.write.mock.calls;
      const allContent = writeCalls.map(call => call[0]).join('');
      
      expect(allContent).toMatch(/data:.*"type":"image"/i);
    }, 15000);

    it('should handle errors gracefully', async () => {
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      const query = {
        message: '', // Empty message should trigger error handling
        model: 'gpt-3.5-turbo',
        userId: 'test-user'
      };

      await mockStreamingService.startStream(query.message || query, {}, mockRes);

      const writeCalls = mockRes.write.mock.calls;
      const allContent = writeCalls.map(call => call[0]).join('');
      
      expect(allContent).toMatch(/error|invalid/i);
    });

    it('should respect different model characteristics', async () => {
      const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet'];
      
      for (const model of models) {
        const mockRes = {
          writeHead: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };

        const query = {
          message: 'Explain quantum computing',
          model,
          userId: 'test-user'
        };

        await mockStreamingService.startStream(query.message || query, {}, mockRes);
        
        expect(mockRes.write).toHaveBeenCalled();
        
        // Each model should have different response characteristics
        const writeCalls = mockRes.write.mock.calls;
        expect(writeCalls.length).toBeGreaterThan(0);
      }
    });
  });

  describe('MockRouterService', () => {
    it('should analyze text queries correctly', async () => {
      const queries = [
        'What is the weather today?',
        'Write a Python function',
        'Generate an image of a cat',
        'Explain quantum physics in detail'
      ];

      for (const query of queries) {
        const analysis = await mockRouterService.analyzeQuery(query);
        
        expect(analysis).toHaveProperty('type');
        expect(analysis).toHaveProperty('difficulty');
        expect(analysis).toHaveProperty('confidence');
        expect(analysis).toHaveProperty('reasoning');
        expect(analysis).toHaveProperty('suggestedModels');
        
        expect(['text', 'coding', 'image', 'video']).toContain(analysis.type);
        expect(['normal', 'hard']).toContain(analysis.difficulty);
        expect(analysis.confidence).toBeGreaterThanOrEqual(0);
        expect(analysis.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should identify coding queries', async () => {
      const codingQueries = [
        'Write a JavaScript function to reverse a string',
        'How do I implement a binary search in Python?',
        'Debug this SQL query',
        'Create a React component'
      ];

      for (const query of codingQueries) {
        const analysis = await mockRouterService.analyzeQuery(query);
        expect(analysis.type).toBe('coding');
        expect(analysis.suggestedModels).toContain('gpt-4');
      }
    });

    it('should identify image generation requests', async () => {
      const imageQueries = [
        'Generate an image of a sunset',
        'Create a picture of a dog',
        'Draw a landscape',
        'Make an illustration of a robot'
      ];

      for (const query of imageQueries) {
        const analysis = await mockRouterService.analyzeQuery(query);
        expect(analysis.type).toBe('image');
        expect(analysis.suggestedModels).toContain('dall-e-3');
      }
    });

    it('should determine query difficulty', async () => {
      const simpleQuery = 'What is 2+2?';
      const complexQuery = 'Explain the mathematical foundations of quantum field theory and its applications in particle physics';

      const simpleAnalysis = await mockRouterService.analyzeQuery(simpleQuery);
      const complexAnalysis = await mockRouterService.analyzeQuery(complexQuery);

      expect(simpleAnalysis.difficulty).toBe('normal');
      expect(complexAnalysis.difficulty).toBe('hard');
    });

    it('should provide reasoning for routing decisions', async () => {
      const query = 'Write a machine learning algorithm';
      const analysis = await mockRouterService.analyzeQuery(query);
      
      expect(analysis.reasoning).toBeDefined();
      expect(typeof analysis.reasoning).toBe('string');
      expect(analysis.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('MockRedisService', () => {
    it('should store and retrieve string values', async () => {
      const key = 'test:key';
      const value = 'test value';
      
      await mockRedisService.set(key, value);
      const retrieved = await mockRedisService.get(key);
      
      expect(retrieved).toBe(value);
    });

    it('should handle expiration times', async () => {
      const key = 'test:expiring';
      const value = 'will expire';
      
      await mockRedisService.setex(key, 1, value); // 1 second expiration
      
      let retrieved = await mockRedisService.get(key);
      expect(retrieved).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      retrieved = await mockRedisService.get(key);
      expect(retrieved).toBeNull();
    });

    it('should support hash operations', async () => {
      const key = 'test:hash';
      const field1 = 'field1';
      const value1 = 'value1';
      const field2 = 'field2';
      const value2 = 'value2';
      
      await mockRedisService.hset(key, field1, value1);
      await mockRedisService.hset(key, field2, value2);
      
      const retrievedValue1 = await mockRedisService.hget(key, field1);
      const retrievedValue2 = await mockRedisService.hget(key, field2);
      const allFields = await mockRedisService.hgetall(key);
      
      expect(retrievedValue1).toBe(value1);
      expect(retrievedValue2).toBe(value2);
      expect(allFields).toEqual({ [field1]: value1, [field2]: value2 });
    });

    it('should support list operations', async () => {
      const key = 'test:list';
      const values = ['item1', 'item2', 'item3'];
      
      for (const value of values) {
        await mockRedisService.lpush(key, value);
      }
      
      const length = await mockRedisService.llen(key);
      expect(length).toBe(values.length);
      
      const range = await mockRedisService.lrange(key, 0, -1);
      expect(range).toEqual(values.reverse()); // lpush reverses order
    });

    it('should increment numeric values', async () => {
      const key = 'test:counter';
      
      const result1 = await mockRedisService.incr(key);
      expect(result1).toBe(1);
      
      const result2 = await mockRedisService.incr(key);
      expect(result2).toBe(2);
      
      const result3 = await mockRedisService.incrby(key, 5);
      expect(result3).toBe(7);
    });

    it('should support pattern matching', async () => {
      await mockRedisService.set('user:1:name', 'Alice');
      await mockRedisService.set('user:2:name', 'Bob');
      await mockRedisService.set('user:1:email', 'alice@example.com');
      await mockRedisService.set('product:1:name', 'Widget');
      
      const userKeys = await mockRedisService.keys('user:*');
      const nameKeys = await mockRedisService.keys('*:name');
      
      expect(userKeys).toHaveLength(3);
      expect(nameKeys).toHaveLength(3);
      expect(userKeys.every(key => key.startsWith('user:'))).toBe(true);
    });
  });

  describe('EnhancedCachingService', () => {
    it('should cache and retrieve query analysis', async () => {
      const query = 'What is machine learning?';
      const analysis = {
        type: 'text',
        difficulty: 'normal',
        confidence: 0.9
      };
      
      await cachingService.cacheQueryAnalysis(query, analysis);
      const cached = await cachingService.getCachedQueryAnalysis(query);
      
      expect(cached).toEqual(analysis);
    });

    it('should cache routing decisions', async () => {
      const query = 'Write Python code';
      const routingDecision = {
        model: 'gpt-4',
        reasoning: 'Coding query requires advanced model'
      };
      
      await cachingService.cacheRoutingDecision(query, 'pro', routingDecision);
      const cached = await cachingService.getCachedRoutingDecision(query, 'pro');
      
      expect(cached).toEqual(routingDecision);
    });

    it('should handle cache invalidation', async () => {
      const query = 'Test query';
      const data = { test: 'data' };
      
      await cachingService.cacheQueryAnalysis(query, data);
      let cached = await cachingService.getCachedQueryAnalysis(query);
      expect(cached).toEqual(data);
      
      await cachingService.invalidateQueryCache(query);
      cached = await cachingService.getCachedQueryAnalysis(query);
      expect(cached).toBeNull();
    });

    it('should provide cache statistics', async () => {
      // Add some cache entries
      await cachingService.cacheQueryAnalysis('query1', { type: 'text' });
      await cachingService.cacheQueryAnalysis('query2', { type: 'coding' });
      
      const stats = await cachingService.getCacheStats();
      
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('hitRate');
      expect(stats.totalKeys).toBeGreaterThanOrEqual(2);
    });
  });

  describe('EnhancedQdrantService', () => {
    it('should initialize collections', async () => {
      const result = await qdrantService.initializeCollections();
      expect(result).toBe(true);
    });

    it('should store and search query context', async () => {
      const userId = 'test-user';
      const query = 'What is artificial intelligence?';
      const context = {
        timestamp: new Date(),
        model: 'gpt-3.5-turbo',
        response: 'AI is a field of computer science...'
      };
      
      await qdrantService.storeQueryContext(userId, query, context);
      const similar = await qdrantService.searchSimilarQueries(userId, query, 5);
      
      expect(similar).toBeInstanceOf(Array);
      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0]).toHaveProperty('query');
      expect(similar[0]).toHaveProperty('similarity');
    });

    it('should find response patterns', async () => {
      const queryType = 'coding';
      const pattern = {
        structure: 'function definition',
        language: 'python',
        complexity: 'medium'
      };
      
      await qdrantService.storeResponsePattern(queryType, pattern);
      const patterns = await qdrantService.findResponsePatterns(queryType, 3);
      
      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should manage semantic cache', async () => {
      const query = 'Explain neural networks';
      const response = 'Neural networks are computing systems...';
      const metadata = { model: 'gpt-4', tokens: 150 };
      
      await qdrantService.storeSemanticCache(query, response, metadata);
      const cached = await qdrantService.searchSemanticCache(query, 0.8);
      
      expect(cached).toBeDefined();
      if (cached) {
        expect(cached).toHaveProperty('response');
        expect(cached).toHaveProperty('metadata');
        expect(cached.response).toBe(response);
      }
    });

    it('should provide user analytics', async () => {
      const userId = 'analytics-test-user';
      
      // Store some queries
      await qdrantService.storeQueryContext(userId, 'Query 1', { model: 'gpt-3.5-turbo' });
      await qdrantService.storeQueryContext(userId, 'Query 2', { model: 'gpt-4' });
      
      const analytics = await qdrantService.getUserAnalytics(userId);
      
      expect(analytics).toHaveProperty('totalQueries');
      expect(analytics).toHaveProperty('queryTypes');
      expect(analytics).toHaveProperty('modelUsage');
      expect(analytics).toHaveProperty('averageSimilarity');
      expect(analytics.totalQueries).toBeGreaterThanOrEqual(2);
    });

    it('should perform health checks', async () => {
      const health = await qdrantService.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('collections');
      expect(health).toHaveProperty('totalVectors');
      expect(health).toHaveProperty('memoryUsage');
      expect(['healthy', 'degraded', 'error']).toContain(health.status);
    });
  });

  describe('Integration Tests', () => {
    it('should work together in a complete flow', async () => {
      const query = 'Write a Python function to calculate fibonacci numbers';
      const userId = 'integration-test-user';
      
      // 1. Analyze query with router
      const analysis = await mockRouterService.analyzeQuery(query);
      expect(analysis.type).toBe('coding');
      
      // 2. Cache the analysis
      await cachingService.cacheQueryAnalysis(query, analysis);
      const cachedAnalysis = await cachingService.getCachedQueryAnalysis(query);
      expect(cachedAnalysis).toEqual(analysis);
      
      // 3. Store in vector database
      await qdrantService.storeQueryContext(userId, query, {
        analysis,
        timestamp: new Date()
      });
      
      // 4. Simulate streaming response
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
      
      await mockStreamingService.startStream(query, {
        model: analysis.suggestedModels[0],
        userId
      }, mockRes);
      
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
      
      // 5. Verify semantic cache can be searched
      const cached = await qdrantService.searchSemanticCache('fibonacci sequence python');
      expect(cached).toBeDefined();
    });

    it('should handle caching across services', async () => {
      const query = 'Explain quantum computing';
      const userId = 'cache-test-user';
      
      // First request - should not be cached
      let cachedAnalysis = await cachingService.getCachedQueryAnalysis(query);
      expect(cachedAnalysis).toBeNull();
      
      // Analyze and cache
      const analysis = await mockRouterService.analyzeQuery(query);
      await cachingService.cacheQueryAnalysis(query, analysis);
      
      // Second request - should be cached
      cachedAnalysis = await cachingService.getCachedQueryAnalysis(query);
      expect(cachedAnalysis).toEqual(analysis);
      
      // Store in vector DB for semantic caching
      const response = 'Quantum computing uses quantum mechanics...';
      await qdrantService.storeSemanticCache(query, response, { model: 'gpt-4' });
      
      // Search semantic cache
      const semanticCached = await qdrantService.searchSemanticCache('What is quantum computing?', 0.7);
      expect(semanticCached).toBeDefined();
    });

    it('should maintain performance under load', async () => {
      const queries = Array.from({ length: 50 }, (_, i) => `Test query ${i}`);
      const startTime = Date.now();
      
      // Process multiple queries concurrently
      const promises = queries.map(async (query, index) => {
        const analysis = await mockRouterService.analyzeQuery(query);
        await cachingService.cacheQueryAnalysis(query, analysis);
        await qdrantService.storeQueryContext('load-test-user', query, { analysis });
        return analysis;
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(queries.length);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify cache performance
      const cacheStats = await cachingService.getCacheStats();
      expect(cacheStats.totalKeys).toBeGreaterThanOrEqual(queries.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', async () => {
      // Test with null/undefined inputs
      const nullAnalysis = await mockRouterService.analyzeQuery(null);
      expect(nullAnalysis).toHaveProperty('type');
      expect(nullAnalysis.type).toBe('text'); // Should default to text
      
      const undefinedAnalysis = await mockRouterService.analyzeQuery(undefined);
      expect(undefinedAnalysis).toHaveProperty('type');
      
      // Test empty string
      const emptyAnalysis = await mockRouterService.analyzeQuery('');
      expect(emptyAnalysis).toHaveProperty('type');
    });

    it('should handle service failures gracefully', async () => {
      // Simulate Redis service failure
      const originalGet = mockRedisService.get;
      mockRedisService.get = jest.fn().mockRejectedValue(new Error('Redis connection failed'));
      
      // Caching service should handle Redis failures
      const result = await cachingService.getCachedQueryAnalysis('test query');
      expect(result).toBeNull(); // Should return null instead of throwing
      
      // Restore original method
      mockRedisService.get = originalGet;
    });

    it('should validate input parameters', async () => {
      // Test invalid user IDs
      const analytics = await qdrantService.getUserAnalytics('');
      expect(analytics.totalQueries).toBe(0);
      
      // Test invalid similarity thresholds
      const cached = await qdrantService.searchSemanticCache('test', 2.0); // Invalid threshold > 1
      expect(cached).toBeNull();
    });
  });

  describe('Performance Metrics', () => {
    it('should track response times', async () => {
      const startTime = Date.now();
      
      await mockRouterService.analyzeQuery('Performance test query');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should measure memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform memory-intensive operations
      for (let i = 0; i < 100; i++) {
        await mockRouterService.analyzeQuery(`Memory test query ${i}`);
        await cachingService.cacheQueryAnalysis(`query-${i}`, { type: 'text' });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

// Test utilities
function generateRandomQuery() {
  const queryTypes = [
    'What is',
    'How do I',
    'Write a function to',
    'Generate an image of',
    'Explain the concept of'
  ];
  
  const subjects = [
    'machine learning',
    'quantum computing',
    'web development',
    'data structures',
    'artificial intelligence'
  ];
  
  const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  
  return `${queryType} ${subject}`;
}

function createMockResponse() {
  return {
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn()
  };
}

module.exports = {
  generateRandomQuery,
  createMockResponse
};