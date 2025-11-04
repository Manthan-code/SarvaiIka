// File: backend/src/services/cacheService.js
const redisClient = require("../redis/unifiedRedisClient.js");
const logger = require('../config/logger');
const { sentryErrorTracker } = require('../config/sentry');

// Performance monitoring
const cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  totalRequests: 0
};

// Cache key prefixes for organization
const CacheKeys = {
  user: (userId) => `user:${userId}`,
  userSettings: (userId) => `user:${userId}:settings`,
  chatSession: (sessionId) => `chat:session:${sessionId}`,
  chatHistory: (userId) => `chat:history:${userId}`,
  subscription: (userId) => `subscription:${userId}`,
  plan: (planId) => `plan:${planId}`,
  apiResponse: (endpoint, params) => `api:${endpoint}:${Buffer.from(JSON.stringify(params)).toString('base64')}`,
  rateLimit: (ip, endpoint) => `ratelimit:${ip}:${endpoint}`
};

/**
 * Save a value to Redis with an optional TTL (default 1 hour)
 * @param {string} key - Redis key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time-to-live in seconds
 */
const setCache = async (key, value, ttl = 3600) => {
  try {
    const startTime = Date.now();
    await redisClient.set(key, JSON.stringify(value), "EX", ttl);
    
    const duration = Date.now() - startTime;
    if (duration > 100) { // Log slow cache operations
      logger.warn(`Slow cache set operation: ${key} took ${duration}ms`);
    }
    
    return true;
  } catch (err) {
    cacheStats.errors++;
    logger.error("Redis set error:", err);
    sentryErrorTracker.captureException(err, {
      tags: { service: 'cache', operation: 'set' },
      extra: { key, ttl }
    });
    return false;
  }
};

/**
 * Retrieve a value from Redis
 * @param {string} key - Redis key
 * @returns {any|null} - Parsed cached value or null
 */
const getCache = async (key) => {
  try {
    cacheStats.totalRequests++;
    const startTime = Date.now();
    
    const data = await redisClient.get(key);
    
    const duration = Date.now() - startTime;
    if (duration > 50) { // Log slow cache operations
      logger.warn(`Slow cache get operation: ${key} took ${duration}ms`);
    }
    
    if (data) {
      cacheStats.hits++;
      return JSON.parse(data);
    } else {
      cacheStats.misses++;
      return null;
    }
  } catch (err) {
    cacheStats.errors++;
    cacheStats.misses++;
    logger.error("Redis get error:", err);
    sentryErrorTracker.captureException(err, {
      tags: { service: 'cache', operation: 'get' },
      extra: { key }
    });
    return null;
  }
};

/**
 * Cache chat history for a user
 * @param {string} userId - User ID
 * @param {Array} history - Chat history to cache
 * @param {number} ttl - Time-to-live in seconds (default: 1 hour)
 */
const cacheChatHistory = async (userId, history, ttl = 3600) => {
  const key = `chat:history:${userId}`;
  await setCache(key, history, ttl);
};

/**
 * Retrieve cached chat history for a user
 * @param {string} userId - User ID
 * @returns {Array|null} - Cached chat history or null
 */
const getCachedChatHistory = async (userId) => {
  const key = `chat:history:${userId}`;
  return await getCache(key);
};

/**
 * Cache user profile
 * @param {string} userId - User ID
 * @param {Object} profile - User profile to cache
 * @param {number} ttl - Time-to-live in seconds (default: 1 hour)
 */
const cacheUserProfile = async (userId, profile, ttl = 3600) => {
  const key = `user:profile:${userId}`;
  await setCache(key, profile, ttl);
};

/**
 * Retrieve cached user profile
 * @param {string} userId - User ID
 * @returns {Object|null} - Cached user profile or null
 */
const getCachedUserProfile = async (userId) => {
  const key = `user:profile:${userId}`;
  return await getCache(key);
};

/**
 * Delete a key from cache
 * @param {string} key - Redis key to delete
 */
const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    cacheStats.errors++;
    logger.error("Redis delete error:", err);
    sentryErrorTracker.captureException(err, {
      tags: { service: 'cache', operation: 'delete' },
      extra: { key }
    });
    return false;
  }
};

/**
 * Cache wrapper function - caches the result of a function call
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time-to-live in seconds
 */
const cacheWrap = async (key, fn, ttl = 3600) => {
  try {
    // Try to get from cache first
    const cached = await getCache(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await setCache(key, result, ttl);
    return result;
  } catch (err) {
    logger.error("Cache wrap error:", err);
    // Return function result without caching on error
    return await fn();
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
  const hitRate = cacheStats.totalRequests > 0 
    ? (cacheStats.hits / cacheStats.totalRequests * 100).toFixed(2)
    : 0;
    
  return {
    ...cacheStats,
    hitRate: `${hitRate}%`,
    missRate: `${(100 - hitRate).toFixed(2)}%`
  };
};

/**
 * Reset cache statistics
 */
const resetCacheStats = () => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.errors = 0;
  cacheStats.totalRequests = 0;
};

/**
 * Cache user subscription data
 * @param {string} userId - User ID
 * @param {Object} subscription - Subscription data
 * @param {number} ttl - Time-to-live in seconds
 */
const cacheUserSubscription = async (userId, subscription, ttl = 1800) => {
  const key = CacheKeys.subscription(userId);
  return await setCache(key, subscription, ttl);
};

/**
 * Get cached user subscription
 * @param {string} userId - User ID
 */
const getCachedUserSubscription = async (userId) => {
  const key = CacheKeys.subscription(userId);
  return await getCache(key);
};

/**
 * Cache API response
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 * @param {Object} response - Response data
 * @param {number} ttl - Time-to-live in seconds
 */
const cacheApiResponse = async (endpoint, params, response, ttl = 300) => {
  const key = CacheKeys.apiResponse(endpoint, params);
  return await setCache(key, response, ttl);
};

/**
 * Get cached API response
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 */
const getCachedApiResponse = async (endpoint, params) => {
  const key = CacheKeys.apiResponse(endpoint, params);
  return await getCache(key);
};

module.exports = {
  setCache,
  getCache,
  deleteCache,
  cacheWrap,
  cacheChatHistory,
  getCachedChatHistory,
  cacheUserProfile,
  getCachedUserProfile,
  cacheUserSubscription,
  getCachedUserSubscription,
  cacheApiResponse,
  getCachedApiResponse,
  getCacheStats,
  resetCacheStats,
  CacheKeys
};
