/**
 * Cache Service Unit Tests
 * Tests Redis operations, cache strategies, and performance monitoring
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock Redis client before importing cacheService
jest.mock('../../../src/redis/client.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
  flushall: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hgetall: jest.fn(),
  hdel: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn()
}));

jest.mock('../../../src/config/logger');
jest.mock('../../../src/config/sentry');

const redisClient = require('../../../src/redis/client.js');

// Import after mocking
const cacheService = require('../../../src/services/cacheService');

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset cache stats
    if (cacheService.resetCacheStats) {
      cacheService.resetCacheStats();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Cache Operations', () => {
    it('should get value from cache successfully', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      
      redisClient.get.mockResolvedValue(JSON.stringify(value));
      
      const result = await cacheService.getCache(key);
      
      expect(redisClient.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non:existent';
      
      redisClient.get.mockResolvedValue(null);
      
      const result = await cacheService.getCache(key);
      
      expect(redisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should set value in cache successfully', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      const ttl = 3600;
      
      redisClient.set.mockResolvedValue('OK');
      
      const result = await cacheService.setCache(key, value, ttl);
      
      expect(redisClient.set).toHaveBeenCalledWith(key, JSON.stringify(value), 'EX', ttl);
      expect(result).toBe(true);
    });

    it('should set value with default TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      
      redisClient.set.mockResolvedValue('OK');
      
      const result = await cacheService.setCache(key, value);
      
      expect(redisClient.set).toHaveBeenCalledWith(key, JSON.stringify(value), 'EX', 3600);
      expect(result).toBe(true);
    });

    it('should delete value from cache successfully', async () => {
      const key = 'test:key';
      
      redisClient.del.mockResolvedValue(1);
      
      const result = await cacheService.deleteCache(key);
      
      expect(redisClient.del).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it('should return false when deleting fails', async () => {
      const key = 'test:key';
      
      redisClient.del.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.deleteCache(key);
      
      expect(redisClient.del).toHaveBeenCalledWith(key);
      expect(result).toBe(false);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate user cache key correctly', () => {
      const userId = 'user123';
      const expectedKey = 'user:user123';
      
      const key = cacheService.CacheKeys.user(userId);
      
      expect(key).toBe(expectedKey);
    });

    it('should generate user settings cache key correctly', () => {
      const userId = 'user123';
      const expectedKey = 'user:user123:settings';
      
      const key = cacheService.CacheKeys.userSettings(userId);
      
      expect(key).toBe(expectedKey);
    });

    it('should generate chat session cache key correctly', () => {
      const sessionId = 'session123';
      const expectedKey = 'chat:session:session123';
      
      const key = cacheService.CacheKeys.chatSession(sessionId);
      
      expect(key).toBe(expectedKey);
    });

    it('should generate API response cache key correctly', () => {
      const endpoint = '/api/test';
      const params = { param1: 'value1' };
      
      const key = cacheService.CacheKeys.apiResponse(endpoint, params);
      
      expect(key).toContain('api:/api/test:');
      expect(typeof key).toBe('string');
    });
  });

  describe('Chat History Caching', () => {
    it('should cache chat history successfully', async () => {
      const userId = 'user123';
      const history = [{ message: 'Hello', timestamp: Date.now() }];
      const ttl = 3600;
      
      redisClient.set.mockResolvedValue('OK');
      
      await cacheService.cacheChatHistory(userId, history, ttl);
      
      expect(redisClient.set).toHaveBeenCalledWith(
        'chat:history:user123',
        JSON.stringify(history),
        'EX',
        ttl
      );
    });

    it('should retrieve cached chat history', async () => {
      const userId = 'user123';
      const history = [{ message: 'Hello', timestamp: Date.now() }];
      
      redisClient.get.mockResolvedValue(JSON.stringify(history));
      
      const result = await cacheService.getCachedChatHistory(userId);
      
      expect(redisClient.get).toHaveBeenCalledWith('chat:history:user123');
      expect(result).toEqual(history);
    });
  });

  describe('User Profile Caching', () => {
    it('should cache user profile successfully', async () => {
      const userId = 'user123';
      const profile = { name: 'John Doe', email: 'john@example.com' };
      const ttl = 3600;
      
      redisClient.set.mockResolvedValue('OK');
      
      await cacheService.cacheUserProfile(userId, profile, ttl);
      
      expect(redisClient.set).toHaveBeenCalledWith(
        'user:profile:user123',
        JSON.stringify(profile),
        'EX',
        ttl
      );
    });

    it('should retrieve cached user profile', async () => {
      const userId = 'user123';
      const profile = { name: 'John Doe', email: 'john@example.com' };
      
      redisClient.get.mockResolvedValue(JSON.stringify(profile));
      
      const result = await cacheService.getCachedUserProfile(userId);
      
      expect(redisClient.get).toHaveBeenCalledWith('user:profile:user123');
      expect(result).toEqual(profile);
    });
  });

  describe('User Subscription Caching', () => {
    it('should cache user subscription successfully', async () => {
      const userId = 'user123';
      const subscription = { plan: 'pro', expires: Date.now() + 86400000 };
      const ttl = 1800;
      
      redisClient.set.mockResolvedValue('OK');
      
      const result = await cacheService.cacheUserSubscription(userId, subscription, ttl);
      
      expect(redisClient.set).toHaveBeenCalledWith(
        'subscription:user123',
        JSON.stringify(subscription),
        'EX',
        ttl
      );
      expect(result).toBe(true);
    });

    it('should retrieve cached user subscription', async () => {
      const userId = 'user123';
      const subscription = { plan: 'pro', expires: Date.now() + 86400000 };
      
      redisClient.get.mockResolvedValue(JSON.stringify(subscription));
      
      const result = await cacheService.getCachedUserSubscription(userId);
      
      expect(redisClient.get).toHaveBeenCalledWith('subscription:user123');
      expect(result).toEqual(subscription);
    });
  });

  describe('API Response Caching', () => {
    it('should cache API response successfully', async () => {
      const endpoint = '/api/data';
      const params = { page: 1, limit: 10 };
      const response = { data: [1, 2, 3], total: 100 };
      const ttl = 300;
      
      redisClient.set.mockResolvedValue('OK');
      
      const result = await cacheService.cacheApiResponse(endpoint, params, response, ttl);
      
      expect(redisClient.set).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should retrieve cached API response', async () => {
      const endpoint = '/api/data';
      const params = { page: 1, limit: 10 };
      const response = { data: [1, 2, 3], total: 100 };
      
      redisClient.get.mockResolvedValue(JSON.stringify(response));
      
      const result = await cacheService.getCachedApiResponse(endpoint, params);
      
      expect(redisClient.get).toHaveBeenCalled();
      expect(result).toEqual(response);
    });
  });

  describe('Cache Wrapper', () => {
    it('should return cached value if available', async () => {
      const key = 'test:wrap';
      const cachedValue = { data: 'cached' };
      const fn = jest.fn().mockResolvedValue({ data: 'fresh' });
      
      redisClient.get.mockResolvedValue(JSON.stringify(cachedValue));
      
      const result = await cacheService.cacheWrap(key, fn);
      
      expect(result).toEqual(cachedValue);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should execute function and cache result if not cached', async () => {
      const key = 'test:wrap';
      const freshValue = { data: 'fresh' };
      const fn = jest.fn().mockResolvedValue(freshValue);
      
      redisClient.get.mockResolvedValue(null);
      redisClient.set.mockResolvedValue('OK');
      
      const result = await cacheService.cacheWrap(key, fn);
      
      expect(result).toEqual(freshValue);
      expect(fn).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(freshValue),
        'EX',
        3600
      );
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const stats = cacheService.getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('missRate');
    });

    it('should reset cache statistics', () => {
      cacheService.resetCacheStats();
      
      const stats = cacheService.getCacheStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const key = 'test:key';
      
      redisClient.get.mockRejectedValue(new Error('Connection refused'));
      
      const result = await cacheService.getCache(key);
      
      expect(result).toBeNull();
    });

    it('should handle Redis set errors gracefully', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      
      redisClient.set.mockRejectedValue(new Error('Command timeout'));
      
      const result = await cacheService.setCache(key, value);
      
      expect(result).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent operations', async () => {
      const promises = [];
      
      redisClient.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      redisClient.set.mockResolvedValue('OK');
      
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.getCache(`key:${i}`));
        promises.push(cacheService.setCache(`key:${i}`, { data: `value:${i}` }));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(20);
    });

    it('should handle large data efficiently', async () => {
      const key = 'large:data';
      const largeData = { data: 'x'.repeat(10000) };
      
      redisClient.set.mockResolvedValue('OK');
      redisClient.get.mockResolvedValue(JSON.stringify(largeData));
      
      const startTime = Date.now();
      
      await cacheService.setCache(key, largeData);
      const result = await cacheService.getCache(key);
      
      const endTime = Date.now();
      
      expect(result).toEqual(largeData);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});