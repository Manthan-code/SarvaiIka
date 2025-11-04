const redisClient = require('./unifiedRedisClient.js');
const logger = require('../config/logger.js');

/**
 * Rate limiting helper
 * Allows 1 request per 10 seconds per user (adjustable)
 */
async function checkRateLimit(userId, windowSeconds = 10) {
  const key = `rate_limit:${userId}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    // Get current timestamp from Redis
    const current = await redisClient.get(key);
    
    if (!current) {
      // First request, set the timestamp
      await redisClient.setex(key, windowSeconds, now.toString());
      return { allowed: true, retryAfter: 0 };
    }

    const lastRequest = parseInt(current);
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < windowMs) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((windowMs - timeSinceLastRequest) / 1000);
      return { allowed: false, retryAfter };
    } else {
      // Reset the timestamp
      await redisClient.setex(key, windowSeconds, now.toString());
      return { allowed: true, retryAfter: 0 };
    }
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    // Fail open - allow request if Redis is down
    return { allowed: true, retryAfter: 0 };
  }
}

/**
 * Cache response for repeated inputs
 */
async function cacheResponse(userId, input, output, expirationSeconds = 3600) {
  const key = `cache:${userId}:${Buffer.from(input).toString('base64')}`;
  
  try {
    const cacheData = {
      input,
      output,
      timestamp: Date.now(),
      userId
    };

    await redisClient.setex(key, expirationSeconds, JSON.stringify(cacheData));
    logger.info(`✅ Cached response for user ${userId}`);
  } catch (error) {
    logger.error('Failed to cache response:', error);
  }
}

/**
 * Get cached response if available
 */
async function getCachedResponse(userId, input) {
  const key = `cache:${userId}:${Buffer.from(input).toString('base64')}`;
  
  try {
    const cached = await redisClient.get(key);
    
    if (cached) {
      const cacheData = JSON.parse(cached);
      logger.info(`✅ Retrieved cached response for user ${userId}`);
      return cacheData;
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to get cached response:', error);
    return null;
  }
}

/**
 * Invalidate cache by pattern (supports wildcards)
 */
async function invalidateCache(pattern) {
  try {
    // If using Redis with SCAN support (Redis 2.8+)
    let cursor = '0';
    let keys = [];
    
    do {
      // Use SCAN to find keys matching pattern
      const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = reply[0];
      keys = keys.concat(reply[1]);
    } while (cursor !== '0');

    // Delete all matching keys
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`🗑️ Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
    }

    return keys.length;
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
    
    // Fallback: if SCAN isn't available, try direct pattern matching
    try {
      // This is a simple approach for development
      // Note: KEYS command is not recommended for production due to performance issues
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`🗑️ Invalidated ${keys.length} cache keys (fallback): ${pattern}`);
      }
      return keys.length;
    } catch (fallbackError) {
      logger.error('Fallback cache invalidation also failed:', fallbackError);
      return 0;
    }
  }
}

/**
 * Invalidate all cache for a specific user
 */
async function invalidateUserCache(userId) {
  const pattern = `*:${userId}:*`;
  return await invalidateCache(pattern);
}

/**
 * Invalidate specific cache key
 */
async function invalidateKey(exactKey) {
  try {
    const result = await redisClient.del(exactKey);
    if (result > 0) {
      logger.info(`🗑️ Invalidated cache key: ${exactKey}`);
    }
    return result;
  } catch (error) {
    logger.error('Failed to invalidate specific key:', error);
    return 0;
  }
}

/**
 * Clear entire cache (use with caution!)
 */
async function clearAllCache() {
  try {
    // This is dangerous - only use in development or specific scenarios
    const result = await redisClient.flushall();
    logger.warn('🧹 Cleared ALL cache data');
    return result;
  } catch (error) {
    logger.error('Failed to clear all cache:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  try {
    const info = await redisClient.info();
    const keys = await redisClient.dbsize();
    
    return {
      totalKeys: keys,
      redisInfo: info
    };
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    return null;
  }
}

module.exports = {
  checkRateLimit,
  cacheResponse,
  getCachedResponse,
  invalidateCache,
  invalidateUserCache,
  invalidateKey,
  clearAllCache,
  getCacheStats
};