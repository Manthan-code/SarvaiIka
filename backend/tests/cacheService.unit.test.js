/**
 * Cache Service Unit Tests
 * Comprehensive tests for all caching operations and edge cases
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const CacheService = require('../src/services/cacheService');
const Redis = require('redis');

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn()
}));

jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('CacheService Unit Tests', () => {
  let cacheService;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Redis client
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      flushAll: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      isReady: true,
      on: jest.fn(),
      off: jest.fn()
    };
    
    Redis.createClient.mockReturnValue(mockRedisClient);
    cacheService = new CacheService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Connection', () => {
    it('should initialize with Redis client', () => {
      expect(Redis.createClient).toHaveBeenCalled();
      expect(cacheService.client).toBe(mockRedisClient);
    });

    it('should setup error handlers', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should connect to Redis on initialization', async () => {
      await cacheService.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(cacheService.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(async () => {
      await cacheService.connect();
    });

    describe('set', () => {
      it('should set a value with default TTL', async () => {
        mockRedisClient.set.mockResolvedValue('OK');
        
        const result = await cacheService.set('test-key', 'test-value');
        
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'test-key',
          JSON.stringify('test-value'),
          { EX: 3600 }
        );
        expect(result).toBe(true);
      });

      it('should set a value with custom TTL', async () => {
        mockRedisClient.set.mockResolvedValue('OK');
        
        await cacheService.set('test-key', 'test-value', 7200);
        
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'test-key',
          JSON.stringify('test-value'),
          { EX: 7200 }
        );
      });

      it('should handle complex objects', async () => {
        mockRedisClient.set.mockResolvedValue('OK');
        const complexObject = {
          id: 1,
          name: 'Test',
          nested: { value: 'nested-value' },
          array: [1, 2, 3]
        };
        
        await cacheService.set('complex-key', complexObject);
        
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'complex-key',
          JSON.stringify(complexObject),
          { EX: 3600 }
        );
      });

      it('should handle set errors gracefully', async () => {
        mockRedisClient.set.mockRejectedValue(new Error('Set failed'));
        
        const result = await cacheService.set('test-key', 'test-value');
        expect(result).toBe(false);
      });

      it('should handle null and undefined values', async () => {
        mockRedisClient.set.mockResolvedValue('OK');
        
        await cacheService.set('null-key', null);
        await cacheService.set('undefined-key', undefined);
        
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'null-key',
          JSON.stringify(null),
          { EX: 3600 }
        );
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'undefined-key',
          JSON.stringify(undefined),
          { EX: 3600 }
        );
      });
    });

    describe('get', () => {
      it('should get and parse a value', async () => {
        const testValue = { id: 1, name: 'Test' };
        mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));
        
        const result = await cacheService.get('test-key');
        
        expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
        expect(result).toEqual(testValue);
      });

      it('should return null for non-existent keys', async () => {
        mockRedisClient.get.mockResolvedValue(null);
        
        const result = await cacheService.get('non-existent-key');
        
        expect(result).toBeNull();
      });

      it('should handle JSON parsing errors', async () => {
        mockRedisClient.get.mockResolvedValue('invalid-json{');
        
        const result = await cacheService.get('invalid-key');
        
        expect(result).toBeNull();
      });

      it('should handle get errors gracefully', async () => {
        mockRedisClient.get.mockRejectedValue(new Error('Get failed'));
        
        const result = await cacheService.get('test-key');
        expect(result).toBeNull();
      });

      it('should handle primitive values correctly', async () => {
        mockRedisClient.get.mockResolvedValue(JSON.stringify('string-value'));
        
        const result = await cacheService.get('string-key');
        expect(result).toBe('string-value');
      });
    });

    describe('del', () => {
      it('should delete a single key', async () => {
        mockRedisClient.del.mockResolvedValue(1);
        
        const result = await cacheService.del('test-key');
        
        expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
        expect(result).toBe(true);
      });

      it('should delete multiple keys', async () => {
        mockRedisClient.del.mockResolvedValue(2);
        
        const result = await cacheService.del(['key1', 'key2']);
        
        expect(mockRedisClient.del).toHaveBeenCalledWith(['key1', 'key2']);
        expect(result).toBe(true);
      });

      it('should return false when no keys are deleted', async () => {
        mockRedisClient.del.mockResolvedValue(0);
        
        const result = await cacheService.del('non-existent-key');
        expect(result).toBe(false);
      });

      it('should handle delete errors gracefully', async () => {
        mockRedisClient.del.mockRejectedValue(new Error('Delete failed'));
        
        const result = await cacheService.del('test-key');
        expect(result).toBe(false);
      });
    });

    describe('exists', () => {
      it('should check if key exists', async () => {
        mockRedisClient.exists.mockResolvedValue(1);
        
        const result = await cacheService.exists('test-key');
        
        expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
        expect(result).toBe(true);
      });

      it('should return false for non-existent keys', async () => {
        mockRedisClient.exists.mockResolvedValue(0);
        
        const result = await cacheService.exists('non-existent-key');
        expect(result).toBe(false);
      });

      it('should handle exists errors gracefully', async () => {
        mockRedisClient.exists.mockRejectedValue(new Error('Exists failed'));
        
        const result = await cacheService.exists('test-key');
        expect(result).toBe(false);
      });
    });

    describe('expire', () => {
      it('should set expiration for a key', async () => {
        mockRedisClient.expire.mockResolvedValue(1);
        
        const result = await cacheService.expire('test-key', 3600);
        
        expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 3600);
        expect(result).toBe(true);
      });

      it('should return false for non-existent keys', async () => {
        mockRedisClient.expire.mockResolvedValue(0);
        
        const result = await cacheService.expire('non-existent-key', 3600);
        expect(result).toBe(false);
      });

      it('should handle expire errors gracefully', async () => {
        mockRedisClient.expire.mockRejectedValue(new Error('Expire failed'));
        
        const result = await cacheService.expire('test-key', 3600);
        expect(result).toBe(false);
      });
    });

    describe('ttl', () => {
      it('should get TTL for a key', async () => {
        mockRedisClient.ttl.mockResolvedValue(3600);
        
        const result = await cacheService.ttl('test-key');
        
        expect(mockRedisClient.ttl).toHaveBeenCalledWith('test-key');
        expect(result).toBe(3600);
      });

      it('should return -1 for keys without expiration', async () => {
        mockRedisClient.ttl.mockResolvedValue(-1);
        
        const result = await cacheService.ttl('persistent-key');
        expect(result).toBe(-1);
      });

      it('should return -2 for non-existent keys', async () => {
        mockRedisClient.ttl.mockResolvedValue(-2);
        
        const result = await cacheService.ttl('non-existent-key');
        expect(result).toBe(-2);
      });

      it('should handle TTL errors gracefully', async () => {
        mockRedisClient.ttl.mockRejectedValue(new Error('TTL failed'));
        
        const result = await cacheService.ttl('test-key');
        expect(result).toBe(-2);
      });
    });
  });

  describe('Advanced Operations', () => {
    beforeEach(async () => {
      await cacheService.connect();
    });

    describe('keys', () => {
      it('should get keys matching pattern', async () => {
        const mockKeys = ['user:1', 'user:2', 'user:3'];
        mockRedisClient.keys.mockResolvedValue(mockKeys);
        
        const result = await cacheService.keys('user:*');
        
        expect(mockRedisClient.keys).toHaveBeenCalledWith('user:*');
        expect(result).toEqual(mockKeys);
      });

      it('should return empty array when no keys match', async () => {
        mockRedisClient.keys.mockResolvedValue([]);
        
        const result = await cacheService.keys('nonexistent:*');
        expect(result).toEqual([]);
      });

      it('should handle keys errors gracefully', async () => {
        mockRedisClient.keys.mockRejectedValue(new Error('Keys failed'));
        
        const result = await cacheService.keys('test:*');
        expect(result).toEqual([]);
      });
    });

    describe('clear', () => {
      it('should clear all cache', async () => {
        mockRedisClient.flushAll.mockResolvedValue('OK');
        
        const result = await cacheService.clear();
        
        expect(mockRedisClient.flushAll).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should handle clear errors gracefully', async () => {
        mockRedisClient.flushAll.mockRejectedValue(new Error('Clear failed'));
        
        const result = await cacheService.clear();
        expect(result).toBe(false);
      });
    });

    describe('ping', () => {
      it('should ping Redis server', async () => {
        mockRedisClient.ping.mockResolvedValue('PONG');
        
        const result = await cacheService.ping();
        
        expect(mockRedisClient.ping).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should handle ping errors gracefully', async () => {
        mockRedisClient.ping.mockRejectedValue(new Error('Ping failed'));
        
        const result = await cacheService.ping();
        expect(result).toBe(false);
      });
    });
  });

  describe('Connection Management', () => {
    it('should disconnect from Redis', async () => {
      await cacheService.connect();
      mockRedisClient.disconnect.mockResolvedValue(undefined);
      
      await cacheService.disconnect();
      
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      await cacheService.connect();
      mockRedisClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      
      await expect(cacheService.disconnect()).rejects.toThrow('Disconnect failed');
    });

    it('should check if client is ready', () => {
      expect(cacheService.isReady()).toBe(true);
      
      mockRedisClient.isReady = false;
      expect(cacheService.isReady()).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      await cacheService.connect();
    });

    it('should handle operations when client is not ready', async () => {
      mockRedisClient.isReady = false;
      
      const setResult = await cacheService.set('test-key', 'test-value');
      const getResult = await cacheService.get('test-key');
      
      expect(setResult).toBe(false);
      expect(getResult).toBeNull();
    });

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(1000000); // 1MB string
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(largeValue));
      
      const setResult = await cacheService.set('large-key', largeValue);
      const getResult = await cacheService.get('large-key');
      
      expect(setResult).toBe(true);
      expect(getResult).toBe(largeValue);
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with:special:chars:@#$%';
      mockRedisClient.set.mockResolvedValue('OK');
      
      const result = await cacheService.set(specialKey, 'test-value');
      
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        specialKey,
        JSON.stringify('test-value'),
        { EX: 3600 }
      );
      expect(result).toBe(true);
    });

    it('should handle circular references in objects', async () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;
      
      const result = await cacheService.set('circular-key', circularObj);
      
      // Should handle the error gracefully
      expect(result).toBe(false);
    });

    it('should handle zero TTL values', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      
      await cacheService.set('test-key', 'test-value', 0);
      
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify('test-value'),
        { EX: 0 }
      );
    });

    it('should handle negative TTL values', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      
      await cacheService.set('test-key', 'test-value', -1);
      
      // Should use default TTL for negative values
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify('test-value'),
        { EX: 3600 }
      );
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await cacheService.connect();
    });

    it('should handle multiple concurrent operations', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify('test-value'));
      
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(cacheService.set(`key-${i}`, `value-${i}`));
        operations.push(cacheService.get(`key-${i}`));
      }
      
      const results = await Promise.all(operations);
      expect(results).toHaveLength(200);
    });

    it('should complete operations within reasonable time', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      
      const startTime = Date.now();
      await cacheService.set('performance-key', 'performance-value');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});