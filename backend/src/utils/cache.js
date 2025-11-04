// Simple cache utility for invalidating cached data

// In-memory cache store
const cache = new Map();

/**
 * Set a value in the cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in milliseconds (optional)
 */
function setCache(key, value, ttl = null) {
  const item = {
    value,
    timestamp: Date.now(),
    ttl
  };
  cache.set(key, item);
}

/**
 * Get a value from the cache
 * @param {string} key - Cache key
 * @returns {any} Cached value or null if not found/expired
 */
function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  // Check if item has expired
  if (item.ttl && Date.now() - item.timestamp > item.ttl) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}

/**
 * Invalidate (remove) a cache entry
 * @param {string} key - Cache key to invalidate
 */
function invalidateCache(key) {
  cache.delete(key);
  console.log(`Cache invalidated for key: ${key}`);
}

/**
 * Clear all cache entries
 */
function clearCache() {
  cache.clear();
  console.log('All cache entries cleared');
}

/**
 * Get cache statistics
 * @returns {object} Cache statistics
 */
function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

module.exports = {
  setCache,
  getCache,
  invalidateCache,
  clearCache,
  getCacheStats
};