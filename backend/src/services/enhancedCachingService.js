/**
 * Enhanced Caching Service - Intelligent caching for AI responses and sessions
 * Uses mock Redis for development and can switch to real Redis for production
 */

const MockRedisService = require('./mockRedisService');
const logger = require('../config/logger');
const crypto = require('crypto');
const redisClient = require('../redis/unifiedRedisClient.js');

class EnhancedCachingService {
  constructor() {
    this.mockRedis = new MockRedisService();
    this.realRedis = null; // Will be initialized if available
    this.useRealRedis = false;
    this.cacheConfig = this.initializeCacheConfig();
    this.hitStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    this.initializeRedisConnection();
  }

  /**
   * Initialize cache configuration
   */
  initializeCacheConfig() {
    return {
      // TTL settings (in seconds)
      ttl: {
        queryAnalysis: 3600,      // 1 hour
        routingDecision: 1800,    // 30 minutes
        aiResponse: 7200,         // 2 hours
        userSession: 86400,       // 24 hours
        modelMetadata: 43200,     // 12 hours
        errorResponse: 300,       // 5 minutes
        streamingSession: 1800    // 30 minutes
      },
      
      // Cache key prefixes
      prefixes: {
        query: 'query:',
        routing: 'routing:',
        response: 'response:',
        session: 'session:',
        user: 'user:',
        model: 'model:',
        error: 'error:',
        stream: 'stream:',
        analytics: 'analytics:'
      },
      
      // Cache strategies
      strategies: {
        queryAnalysis: 'hash-based',
        routing: 'content-aware',
        responses: 'semantic-similarity',
        sessions: 'time-based',
        errors: 'pattern-based'
      },
      
      // Performance settings
      performance: {
        maxResponseSize: 50000,   // 50KB
        compressionThreshold: 1000, // 1KB
        batchSize: 100,
        maxConcurrentOps: 10
      }
    };
  }

  /**
   * Initialize Redis connection (mock or real)
   */
  async initializeRedisConnection() {
    try {
      // Initialize unified Redis client (uses in-memory fallback if Redis is unavailable)
      await redisClient.initialize();
      this.realRedis = redisClient;
      this.useRealRedis = true;
      const status = redisClient.getStatus();
      if (status.useFallback) {
        logger.info('Using unified Redis client with in-memory fallback');
      } else {
        logger.info('Connected to unified Redis client');
      }
    } catch (error) {
      logger.warn('Failed to initialize unified Redis client, using mock Redis', { error: error.message });
      this.useRealRedis = false;
      await this.mockRedis.connect();
      logger.info('Using mock Redis for caching');
    }
  }

  /**
   * Get Redis client (real or mock)
   */
  getRedisClient() {
    return this.useRealRedis ? this.realRedis : this.mockRedis;
  }

  /**
   * Cache query analysis result
   * @param {string} query - Original query
   * @param {Object} analysis - Analysis result
   * @param {Object} options - Caching options
   */
  async cacheQueryAnalysis(query, analysis, options = {}) {
    try {
      const key = this.generateQueryKey(query);
      const ttl = options.ttl || this.cacheConfig.ttl.queryAnalysis;
      
      const cacheData = {
        query,
        analysis,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      const redis = this.getRedisClient();
      await redis.set(key, JSON.stringify(cacheData), 'EX', ttl);
      
      this.hitStats.sets++;
      logger.debug('Cached query analysis', { key, ttl });
      
      return key;
    } catch (error) {
      logger.error('Failed to cache query analysis', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cached query analysis
   * @param {string} query - Original query
   * @returns {Object|null} Cached analysis or null
   */
  async getCachedQueryAnalysis(query) {
    try {
      const key = this.generateQueryKey(query);
      const redis = this.getRedisClient();
      const cached = await redis.get(key);
      
      if (cached) {
        this.hitStats.hits++;
        const data = JSON.parse(cached);
        logger.debug('Cache hit for query analysis', { key });
        return data.analysis;
      }
      
      this.hitStats.misses++;
      logger.debug('Cache miss for query analysis', { key });
      return null;
    } catch (error) {
      logger.error('Failed to get cached query analysis', { error: error.message });
      return null;
    }
  }

  /**
   * Cache routing decision
   * @param {string} query - Original query
   * @param {string} subscriptionPlan - User's subscription plan
   * @param {Object} routing - Routing decision
   */
  async cacheRoutingDecision(query, subscriptionPlan, routing) {
    try {
      const key = this.generateRoutingKey(query, subscriptionPlan);
      const ttl = this.cacheConfig.ttl.routingDecision;
      
      const cacheData = {
        query,
        subscriptionPlan,
        routing,
        timestamp: Date.now()
      };
      
      const redis = this.getRedisClient();
      await redis.set(key, JSON.stringify(cacheData), 'EX', ttl);
      
      this.hitStats.sets++;
      logger.debug('Cached routing decision', { key, model: routing.primaryModel });
      
      return key;
    } catch (error) {
      logger.error('Failed to cache routing decision', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cached routing decision
   * @param {string} query - Original query
   * @param {string} subscriptionPlan - User's subscription plan
   * @returns {Object|null} Cached routing or null
   */
  async getCachedRoutingDecision(query, subscriptionPlan) {
    try {
      const key = this.generateRoutingKey(query, subscriptionPlan);
      const redis = this.getRedisClient();
      const cached = await redis.get(key);
      
      if (cached) {
        this.hitStats.hits++;
        const data = JSON.parse(cached);
        logger.debug('Cache hit for routing decision', { key });
        return data.routing;
      }
      
      this.hitStats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached routing decision', { error: error.message });
      return null;
    }
  }

  /**
   * Cache AI response
   * @param {string} query - Original query
   * @param {string} model - Model used
   * @param {string} response - AI response
   * @param {Object} metadata - Response metadata
   */
  async cacheAiResponse(query, model, response, metadata = {}) {
    try {
      // Don't cache very large responses
      if (response.length > this.cacheConfig.performance.maxResponseSize) {
        logger.debug('Response too large to cache', { size: response.length });
        return null;
      }
      
      const key = this.generateResponseKey(query, model);
      const ttl = this.cacheConfig.ttl.aiResponse;
      
      const cacheData = {
        query,
        model,
        response,
        metadata,
        timestamp: Date.now(),
        size: response.length
      };
      
      const redis = this.getRedisClient();
      await redis.set(key, JSON.stringify(cacheData), 'EX', ttl);
      
      this.hitStats.sets++;
      logger.debug('Cached AI response', { key, model, size: response.length });
      
      return key;
    } catch (error) {
      logger.error('Failed to cache AI response', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cached AI response
   * @param {string} query - Original query
   * @param {string} model - Model used
   * @returns {Object|null} Cached response or null
   */
  async getCachedAiResponse(query, model) {
    try {
      const key = this.generateResponseKey(query, model);
      const redis = this.getRedisClient();
      const cached = await redis.get(key);
      
      if (cached) {
        this.hitStats.hits++;
        const data = JSON.parse(cached);
        logger.debug('Cache hit for AI response', { key, model });
        return {
          response: data.response,
          metadata: data.metadata,
          cached: true,
          cacheTimestamp: data.timestamp
        };
      }
      
      this.hitStats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached AI response', { error: error.message });
      return null;
    }
  }

  /**
   * Cache user session data
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data
   */
  async cacheUserSession(sessionId, sessionData) {
    try {
      const key = this.generateSessionKey(sessionId);
      const ttl = this.cacheConfig.ttl.userSession;
      
      const cacheData = {
        sessionId,
        data: sessionData,
        lastAccess: Date.now(),
        version: '1.0'
      };
      
      const redis = this.getRedisClient();
      await redis.set(key, JSON.stringify(cacheData), 'EX', ttl);
      
      this.hitStats.sets++;
      logger.debug('Cached user session', { sessionId });
      
      return key;
    } catch (error) {
      logger.error('Failed to cache user session', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cached user session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data or null
   */
  async getCachedUserSession(sessionId) {
    try {
      const key = this.generateSessionKey(sessionId);
      const redis = this.getRedisClient();
      const cached = await redis.get(key);
      
      if (cached) {
        this.hitStats.hits++;
        const data = JSON.parse(cached);
        
        // Update last access time
        data.lastAccess = Date.now();
        await redis.set(key, JSON.stringify(data), 'EX', this.cacheConfig.ttl.userSession);
        
        logger.debug('Cache hit for user session', { sessionId });
        return data.data;
      }
      
      this.hitStats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached user session', { error: error.message });
      return null;
    }
  }

  /**
   * Cache streaming session state
   * @param {string} streamId - Stream ID
   * @param {Object} streamState - Stream state
   */
  async cacheStreamingSession(streamId, streamState) {
    try {
      const key = this.generateStreamKey(streamId);
      const ttl = this.cacheConfig.ttl.streamingSession;
      
      const redis = this.getRedisClient();
      await redis.set(key, JSON.stringify(streamState), 'EX', ttl);
      
      this.hitStats.sets++;
      return key;
    } catch (error) {
      logger.error('Failed to cache streaming session', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cached streaming session
   * @param {string} streamId - Stream ID
   * @returns {Object|null} Stream state or null
   */
  async getCachedStreamingSession(streamId) {
    try {
      const key = this.generateStreamKey(streamId);
      const redis = this.getRedisClient();
      const cached = await redis.get(key);
      
      if (cached) {
        this.hitStats.hits++;
        return JSON.parse(cached);
      }
      
      this.hitStats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached streaming session', { error: error.message });
      return null;
    }
  }

  /**
   * Invalidate cache by pattern
   * @param {string} pattern - Cache key pattern
   */
  async invalidateByPattern(pattern) {
    try {
      const redis = this.getRedisClient();
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        this.hitStats.deletes += keys.length;
        logger.info('Invalidated cache keys', { pattern, count: keys.length });
      }
      
      return keys.length;
    } catch (error) {
      logger.error('Failed to invalidate cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate cache key for query analysis
   */
  generateQueryKey(query) {
    const hash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
    return `${this.cacheConfig.prefixes.query}${hash}`;
  }

  /**
   * Generate cache key for routing decision
   */
  generateRoutingKey(query, subscriptionPlan) {
    const content = `${query.toLowerCase().trim()}:${subscriptionPlan}`;
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `${this.cacheConfig.prefixes.routing}${hash}`;
  }

  /**
   * Generate cache key for AI response
   */
  generateResponseKey(query, model) {
    const content = `${query.toLowerCase().trim()}:${model}`;
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `${this.cacheConfig.prefixes.response}${hash}`;
  }

  /**
   * Generate cache key for user session
   */
  generateSessionKey(sessionId) {
    return `${this.cacheConfig.prefixes.session}${sessionId}`;
  }

  /**
   * Generate cache key for streaming session
   */
  generateStreamKey(streamId) {
    return `${this.cacheConfig.prefixes.stream}${streamId}`;
  }

  /**
   * Invalidate query cache
   * @param {string} query - Query to invalidate
   */
  async invalidateQueryCache(query) {
    try {
      const key = this.generateQueryKey(query);
      const redis = this.getRedisClient();
      await redis.del(key);
      
      this.hitStats.deletes++;
      logger.debug('Invalidated query cache', { key });
      return true;
    } catch (error) {
      logger.error('Failed to invalidate query cache', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const redis = this.getRedisClient();
      const redisStats = this.useRealRedis ? 
        await redis.info() : 
        redis.getStats();
      
      const hitRate = this.hitStats.hits + this.hitStats.misses > 0 ? 
        (this.hitStats.hits / (this.hitStats.hits + this.hitStats.misses) * 100).toFixed(2) : 0;
      
      return {
        type: this.useRealRedis ? 'real-redis' : 'mock-redis',
        hitRate: `${hitRate}%`,
        totalKeys: this.useRealRedis ? 0 : redisStats.keys, // Map keys to totalKeys for mock redis
        memoryUsage: this.useRealRedis ? 0 : redisStats.memoryUsage, // Map memoryUsage for compatibility
        ...this.hitStats,
        redis: redisStats,
        config: {
          ttlSettings: this.cacheConfig.ttl,
          performance: this.cacheConfig.performance
        }
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    try {
      const redis = this.getRedisClient();
      await redis.flushall();
      
      // Reset stats
      this.hitStats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0
      };
      
      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Failed to clear cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check for caching service
   */
  async healthCheck() {
    try {
      const redis = this.getRedisClient();
      const testKey = 'health:check';
      const testValue = Date.now().toString();
      
      // Test set and get
      await redis.set(testKey, testValue, 10);
      const retrieved = await redis.get(testKey);
      
      const isHealthy = retrieved === testValue;
      
      // Clean up
      await redis.del(testKey);
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        type: this.useRealRedis ? 'real-redis' : 'mock-redis',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Warm up cache with common queries
   */
  async warmUpCache(commonQueries = []) {
    logger.info('Starting cache warm-up', { queries: commonQueries.length });
    
    for (const query of commonQueries) {
      try {
        // Pre-generate cache keys
        this.generateQueryKey(query);
        this.generateRoutingKey(query, 'free');
        this.generateRoutingKey(query, 'pro');
      } catch (error) {
        logger.warn('Failed to warm up cache for query', { query, error: error.message });
      }
    }
    
    logger.info('Cache warm-up completed');
  }
}

module.exports = EnhancedCachingService;