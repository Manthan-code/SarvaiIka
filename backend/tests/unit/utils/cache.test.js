/**
 * Cache Utility Unit Tests
 * Comprehensive tests for cache utility functions
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    flushall: jest.fn(),
    ping: jest.fn(),
    on: jest.fn(),
    isReady: true
  }))
}));

jest.mock('../../../src/utils/logger');

const redis = require('redis');
const logger = require('../../../src/utils/logger');
const cache = require('../../../src/utils/cache');

describe('Cache Utility Unit Tests', () => {
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      flushall: jest.fn(),
      ping: jest.fn(),
      on: jest.fn(),
      isReady: true
    };
    
    redis.createClient.mockReturnValue(mockRedisClient);
    
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Cache Connection', () => {
    it('should connect to Redis successfully', async () => {
      mockRedisClient.connect.mockResolvedValue();

      await cache.connect();

      expect(redis.createClient).toHaveBeenCalledWith({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      });
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Connected to Redis cache');
    });

    it('should handle Redis connection errors', async () => {
      const connectionError = new Error('Redis connection failed');
      mockRedisClient.connect.mockRejectedValue(connectionError);

      await expect(cache.connect()).rejects.toThrow('Redis connection failed');
      expect(logger.error).toHaveBeenCalledWith('Redis connection error:', connectionError);
    });

    it('should disconnect from Redis successfully', async () => {
      mockRedisClient.disconnect.mockResolvedValue();

      await cache.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Disconnected from Redis cache');
    });

    it('should handle Redis disconnection errors', async () => {
      const disconnectionError = new Error('Redis disconnection failed');
      mockRedisClient.disconnect.mockRejectedValue(disconnectionError);

      await cache.disconnect();

      expect(logger.error).toHaveBeenCalledWith('Redis disconnection error:', disconnectionError);
    });
  });

  describe('Cache Operations', () => {
    beforeEach(() => {
      // Mock successful connection
      cache.client = mockRedisClient;
    });

    describe('get', () => {
      it('should retrieve cached value successfully', async () => {
        const key = 'test:key';
        const cachedValue = JSON.stringify({ data: 'test data' });
        
        mockRedisClient.get.mockResolvedValue(cachedValue);

        const result = await cache.get(key);

        expect(mockRedisClient.get).toHaveBeenCalledWith(key);
        expect(result).toEqual({ data: 'test data' });
      });

      it('should return null for non-existent key', async () => {
        const key = 'nonexistent:key';
        
        mockRedisClient.get.mockResolvedValue(null);

        const result = await cache.get(key);

        expect(mockRedisClient.get).toHaveBeenCalledWith(key);
        expect(result).toBeNull();
      });

      it('should handle JSON parsing errors', async () => {
        const key = 'invalid:json';
        const invalidJson = 'invalid json string';
        
        mockRedisClient.get.mockResolvedValue(invalidJson);

        const result = await cache.get(key);

        expect(logger.error).toHaveBeenCalledWith('Cache JSON parse error:', expect.any(Error));
        expect(result).toBeNull();
      });

      it('should handle Redis get errors', async () => {
        const key = 'test:key';
        const redisError = new Error('Redis get error');
        
        mockRedisClient.get.mockRejectedValue(redisError);

        const result = await cache.get(key);

        expect(logger.error).toHaveBeenCalledWith('Cache get error:', redisError);
        expect(result).toBeNull();
      });

      it('should return raw string when parseJson is false', async () => {
        const key = 'test:string';
        const stringValue = 'plain string value';
        
        mockRedisClient.get.mockResolvedValue(stringValue);

        const result = await cache.get(key, false);

        expect(result).toBe(stringValue);
      });
    });

    describe('set', () => {
      it('should cache value successfully with TTL', async () => {
        const key = 'test:key';
        const value = { data: 'test data' };
        const ttl = 3600;
        
        mockRedisClient.set.mockResolvedValue('OK');

        const result = await cache.set(key, value, ttl);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          key,
          JSON.stringify(value),
          'EX',
          ttl
        );
        expect(result).toBe(true);
      });

      it('should cache value successfully without TTL', async () => {
        const key = 'test:key';
        const value = { data: 'test data' };
        
        mockRedisClient.set.mockResolvedValue('OK');

        const result = await cache.set(key, value);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          key,
          JSON.stringify(value)
        );
        expect(result).toBe(true);
      });

      it('should handle Redis set errors', async () => {
        const key = 'test:key';
        const value = { data: 'test data' };
        const redisError = new Error('Redis set error');
        
        mockRedisClient.set.mockRejectedValue(redisError);

        const result = await cache.set(key, value);

        expect(logger.error).toHaveBeenCalledWith('Cache set error:', redisError);
        expect(result).toBe(false);
      });

      it('should cache string value without JSON stringification', async () => {
        const key = 'test:string';
        const value = 'plain string';
        
        mockRedisClient.set.mockResolvedValue('OK');

        const result = await cache.set(key, value, null, false);

        expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
        expect(result).toBe(true);
      });
    });

    describe('del', () => {
      it('should delete cached value successfully', async () => {
        const key = 'test:key';
        
        mockRedisClient.del.mockResolvedValue(1);

        const result = await cache.del(key);

        expect(mockRedisClient.del).toHaveBeenCalledWith(key);
        expect(result).toBe(true);
      });

      it('should handle deletion of non-existent key', async () => {
        const key = 'nonexistent:key';
        
        mockRedisClient.del.mockResolvedValue(0);

        const result = await cache.del(key);

        expect(result).toBe(false);
      });

      it('should delete multiple keys successfully', async () => {
        const keys = ['key1', 'key2', 'key3'];
        
        mockRedisClient.del.mockResolvedValue(3);

        const result = await cache.del(keys);

        expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
        expect(result).toBe(true);
      });

      it('should handle Redis delete errors', async () => {
        const key = 'test:key';
        const redisError = new Error('Redis delete error');
        
        mockRedisClient.del.mockRejectedValue(redisError);

        const result = await cache.del(key);

        expect(logger.error).toHaveBeenCalledWith('Cache delete error:', redisError);
        expect(result).toBe(false);
      });
    });

    describe('exists', () => {
      it('should check if key exists successfully', async () => {
        const key = 'test:key';
        
        mockRedisClient.exists.mockResolvedValue(1);

        const result = await cache.exists(key);

        expect(mockRedisClient.exists).toHaveBeenCalledWith(key);
        expect(result).toBe(true);
      });

      it('should return false for non-existent key', async () => {
        const key = 'nonexistent:key';
        
        mockRedisClient.exists.mockResolvedValue(0);

        const result = await cache.exists(key);

        expect(result).toBe(false);
      });

      it('should handle Redis exists errors', async () => {
        const key = 'test:key';
        const redisError = new Error('Redis exists error');
        
        mockRedisClient.exists.mockRejectedValue(redisError);

        const result = await cache.exists(key);

        expect(logger.error).toHaveBeenCalledWith('Cache exists error:', redisError);
        expect(result).toBe(false);
      });
    });

    describe('expire', () => {
      it('should set expiration successfully', async () => {
        const key = 'test:key';
        const ttl = 3600;
        
        mockRedisClient.expire.mockResolvedValue(1);

        const result = await cache.expire(key, ttl);

        expect(mockRedisClient.expire).toHaveBeenCalledWith(key, ttl);
        expect(result).toBe(true);
      });

      it('should handle expiration of non-existent key', async () => {
        const key = 'nonexistent:key';
        const ttl = 3600;
        
        mockRedisClient.expire.mockResolvedValue(0);

        const result = await cache.expire(key, ttl);

        expect(result).toBe(false);
      });

      it('should handle Redis expire errors', async () => {
        const key = 'test:key';
        const ttl = 3600;
        const redisError = new Error('Redis expire error');
        
        mockRedisClient.expire.mockRejectedValue(redisError);

        const result = await cache.expire(key, ttl);

        expect(logger.error).toHaveBeenCalledWith('Cache expire error:', redisError);
        expect(result).toBe(false);
      });
    });

    describe('ttl', () => {
      it('should get TTL successfully', async () => {
        const key = 'test:key';
        const expectedTtl = 3600;
        
        mockRedisClient.ttl.mockResolvedValue(expectedTtl);

        const result = await cache.ttl(key);

        expect(mockRedisClient.ttl).toHaveBeenCalledWith(key);
        expect(result).toBe(expectedTtl);
      });

      it('should return -1 for key without expiration', async () => {
        const key = 'persistent:key';
        
        mockRedisClient.ttl.mockResolvedValue(-1);

        const result = await cache.ttl(key);

        expect(result).toBe(-1);
      });

      it('should return -2 for non-existent key', async () => {
        const key = 'nonexistent:key';
        
        mockRedisClient.ttl.mockResolvedValue(-2);

        const result = await cache.ttl(key);

        expect(result).toBe(-2);
      });

      it('should handle Redis TTL errors', async () => {
        const key = 'test:key';
        const redisError = new Error('Redis TTL error');
        
        mockRedisClient.ttl.mockRejectedValue(redisError);

        const result = await cache.ttl(key);

        expect(logger.error).toHaveBeenCalledWith('Cache TTL error:', redisError);
        expect(result).toBe(-1);
      });
    });

    describe('keys', () => {
      it('should get keys by pattern successfully', async () => {
        const pattern = 'user:*';
        const expectedKeys = ['user:123', 'user:456', 'user:789'];
        
        mockRedisClient.keys.mockResolvedValue(expectedKeys);

        const result = await cache.keys(pattern);

        expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
        expect(result).toEqual(expectedKeys);
      });

      it('should return empty array for no matching keys', async () => {
        const pattern = 'nonexistent:*';
        
        mockRedisClient.keys.mockResolvedValue([]);

        const result = await cache.keys(pattern);

        expect(result).toEqual([]);
      });

      it('should handle Redis keys errors', async () => {
        const pattern = 'test:*';
        const redisError = new Error('Redis keys error');
        
        mockRedisClient.keys.mockRejectedValue(redisError);

        const result = await cache.keys(pattern);

        expect(logger.error).toHaveBeenCalledWith('Cache keys error:', redisError);
        expect(result).toEqual([]);
      });
    });

    describe('flushall', () => {
      it('should flush all keys successfully', async () => {
        mockRedisClient.flushall.mockResolvedValue('OK');

        const result = await cache.flushall();

        expect(mockRedisClient.flushall).toHaveBeenCalled();
        expect(result).toBe(true);
        expect(logger.info).toHaveBeenCalledWith('Cache flushed successfully');
      });

      it('should handle Redis flushall errors', async () => {
        const redisError = new Error('Redis flushall error');
        
        mockRedisClient.flushall.mockRejectedValue(redisError);

        const result = await cache.flushall();

        expect(logger.error).toHaveBeenCalledWith('Cache flush error:', redisError);
        expect(result).toBe(false);
      });
    });
  });

  describe('Cache Utilities', () => {
    beforeEach(() => {
      cache.client = mockRedisClient;
    });

    describe('generateKey', () => {
      it('should generate cache key with prefix', () => {
        const result = cache.generateKey('user', '123');
        expect(result).toBe('user:123');
      });

      it('should generate cache key with multiple parts', () => {
        const result = cache.generateKey('user', '123', 'profile');
        expect(result).toBe('user:123:profile');
      });

      it('should handle empty parts', () => {
        const result = cache.generateKey('user', '', '123');
        expect(result).toBe('user::123');
      });
    });

    describe('mget', () => {
      it('should get multiple values successfully', async () => {
        const keys = ['key1', 'key2', 'key3'];
        const values = [
          JSON.stringify({ data: 'value1' }),
          JSON.stringify({ data: 'value2' }),
          null
        ];
        
        mockRedisClient.mget = jest.fn().mockResolvedValue(values);

        const result = await cache.mget(keys);

        expect(mockRedisClient.mget).toHaveBeenCalledWith(keys);
        expect(result).toEqual([
          { data: 'value1' },
          { data: 'value2' },
          null
        ]);
      });

      it('should handle mget errors', async () => {
        const keys = ['key1', 'key2'];
        const redisError = new Error('Redis mget error');
        
        mockRedisClient.mget = jest.fn().mockRejectedValue(redisError);

        const result = await cache.mget(keys);

        expect(logger.error).toHaveBeenCalledWith('Cache mget error:', redisError);
        expect(result).toEqual([]);
      });
    });

    describe('mset', () => {
      it('should set multiple values successfully', async () => {
        const keyValuePairs = {
          'key1': { data: 'value1' },
          'key2': { data: 'value2' }
        };
        
        mockRedisClient.mset = jest.fn().mockResolvedValue('OK');

        const result = await cache.mset(keyValuePairs);

        expect(mockRedisClient.mset).toHaveBeenCalledWith([
          'key1', JSON.stringify({ data: 'value1' }),
          'key2', JSON.stringify({ data: 'value2' })
        ]);
        expect(result).toBe(true);
      });

      it('should handle mset errors', async () => {
        const keyValuePairs = { 'key1': 'value1' };
        const redisError = new Error('Redis mset error');
        
        mockRedisClient.mset = jest.fn().mockRejectedValue(redisError);

        const result = await cache.mset(keyValuePairs);

        expect(logger.error).toHaveBeenCalledWith('Cache mset error:', redisError);
        expect(result).toBe(false);
      });
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      cache.client = mockRedisClient;
    });

    it('should perform health check successfully', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await cache.healthCheck();

      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'healthy',
        response: 'PONG',
        timestamp: expect.any(Date)
      });
    });

    it('should handle health check failures', async () => {
      const pingError = new Error('Redis ping failed');
      mockRedisClient.ping.mockRejectedValue(pingError);

      const result = await cache.healthCheck();

      expect(result).toEqual({
        status: 'unhealthy',
        error: 'Redis ping failed',
        timestamp: expect.any(Date)
      });
    });

    it('should handle disconnected client', async () => {
      cache.client = null;

      const result = await cache.healthCheck();

      expect(result).toEqual({
        status: 'disconnected',
        error: 'Redis client not connected',
        timestamp: expect.any(Date)
      });
    });
  });
});