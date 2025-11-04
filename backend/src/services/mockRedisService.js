/**
 * Mock Redis Service - In-memory caching for development/testing
 * Provides Redis-like functionality without requiring external Redis server
 */

class MockRedisService {
  constructor() {
    this.cache = new Map();
    this.expirations = new Map();
    this.subscribers = new Map();
    this.config = {
      maxMemory: 100 * 1024 * 1024, // 100MB
      defaultTTL: 3600, // 1 hour
      cleanupInterval: 60000, // 1 minute
      maxKeys: 10000
    };
    
    // Start cleanup interval (but not during tests)
    this.cleanupIntervalId = null;
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }
    
    // Track memory usage
    this.memoryUsage = 0;
  }

  /**
   * Set a key-value pair with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<string>} 'OK' on success
   */
  async set(key, value, ttl = null) {
    try {
      // Check memory limits
      if (this.cache.size >= this.config.maxKeys) {
        this.evictOldestKeys(Math.floor(this.config.maxKeys * 0.1));
      }
      
      const serializedValue = JSON.stringify(value);
      const valueSize = Buffer.byteLength(serializedValue, 'utf8');
      
      // Check memory usage
      if (this.memoryUsage + valueSize > this.config.maxMemory) {
        this.evictByMemory(valueSize);
      }
      
      // Remove old value if exists
      if (this.cache.has(key)) {
        const oldValue = this.cache.get(key);
        this.memoryUsage -= Buffer.byteLength(JSON.stringify(oldValue), 'utf8');
      }
      
      // Set new value
      this.cache.set(key, value);
      this.memoryUsage += valueSize;
      
      // Set expiration
      if (ttl !== null) {
        const expirationTime = Date.now() + (ttl * 1000);
        this.expirations.set(key, expirationTime);
      } else if (this.config.defaultTTL) {
        const expirationTime = Date.now() + (this.config.defaultTTL * 1000);
        this.expirations.set(key, expirationTime);
      }
      
      return 'OK';
    } catch (error) {
      throw new Error(`Redis SET error: ${error.message}`);
    }
  }

  /**
   * Set key with expiration time in seconds (Redis SETEX command)
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @param {string} value - Value to store
   */
  async setex(key, ttl, value) {
    return await this.set(key, value, ttl);
  }

  /**
   * Get value by key
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      // Check if key exists and not expired
      if (!this.cache.has(key)) {
        return null;
      }
      
      // Check expiration
      if (this.isExpired(key)) {
        await this.del(key);
        return null;
      }
      
      return this.cache.get(key);
    } catch (error) {
      throw new Error(`Redis GET error: ${error.message}`);
    }
  }

  /**
   * Delete a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of keys deleted
   */
  async del(key) {
    try {
      if (this.cache.has(key)) {
        const value = this.cache.get(key);
        const valueSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
        
        this.cache.delete(key);
        this.expirations.delete(key);
        this.memoryUsage -= valueSize;
        
        return 1;
      }
      return 0;
    } catch (error) {
      throw new Error(`Redis DEL error: ${error.message}`);
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<number>} 1 if exists, 0 if not
   */
  async exists(key) {
    if (this.isExpired(key)) {
      this.delete(key);
      return 0;
    }
    return this.cache.has(key) ? 1 : 0;
  }

  /**
   * Set expiration for a key
   * @param {string} key - Cache key
   * @param {number} seconds - TTL in seconds
   * @returns {Promise<number>} 1 if successful, 0 if key doesn't exist
   */
  async expire(key, seconds) {
    if (!this.cache.has(key)) {
      return 0;
    }
    
    const expirationTime = Date.now() + (seconds * 1000);
    this.expirations.set(key, expirationTime);
    return 1;
  }

  /**
   * Get TTL for a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async ttl(key) {
    if (!this.cache.has(key)) {
      return -2;
    }
    
    if (!this.expirations.has(key)) {
      return -1;
    }
    
    const expirationTime = this.expirations.get(key);
    const remainingTime = Math.max(0, expirationTime - Date.now());
    return Math.ceil(remainingTime / 1000);
  }

  /**
   * Hash operations - Set field in hash
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<number>} 1 if new field, 0 if updated
   */
  async hset(key, field, value) {
    let hash = await this.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
    }
    
    const isNewField = !hash.hasOwnProperty(field);
    hash[field] = value;
    
    await this.set(key, hash);
    return isNewField ? 1 : 0;
  }

  /**
   * Hash operations - Get field from hash
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<any>} Field value or null
   */
  async hget(key, field) {
    const hash = await this.get(key);
    if (!hash || typeof hash !== 'object') {
      return null;
    }
    return hash[field] || null;
  }

  /**
   * Hash operations - Get all fields and values
   * @param {string} key - Hash key
   * @returns {Promise<Object>} Hash object or empty object
   */
  async hgetall(key) {
    const hash = await this.get(key);
    if (!hash || typeof hash !== 'object') {
      return {};
    }
    return hash;
  }

  /**
   * Hash operations - Delete field from hash
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<number>} Number of fields deleted
   */
  async hdel(key, field) {
    const hash = await this.get(key);
    if (!hash || typeof hash !== 'object' || !hash.hasOwnProperty(field)) {
      return 0;
    }
    
    delete hash[field];
    await this.set(key, hash);
    return 1;
  }

  /**
   * List operations - Push to left of list
   * @param {string} key - List key
   * @param {...any} values - Values to push
   * @returns {Promise<number>} New length of list
   */
  async lpush(key, ...values) {
    let list = await this.get(key);
    if (!Array.isArray(list)) {
      list = [];
    }
    
    list.unshift(...values);
    await this.set(key, list);
    return list.length;
  }

  /**
   * List operations - Push to right of list
   * @param {string} key - List key
   * @param {...any} values - Values to push
   * @returns {Promise<number>} New length of list
   */
  async rpush(key, ...values) {
    let list = await this.get(key);
    if (!Array.isArray(list)) {
      list = [];
    }
    
    list.push(...values);
    await this.set(key, list);
    return list.length;
  }

  /**
   * List operations - Pop from left of list
   * @param {string} key - List key
   * @returns {Promise<any>} Popped value or null
   */
  async lpop(key) {
    const list = await this.get(key);
    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }
    
    const value = list.shift();
    await this.set(key, list);
    return value;
  }

  /**
   * List operations - Get list length
   * @param {string} key - List key
   * @returns {Promise<number>} List length
   */
  async llen(key) {
    const list = await this.get(key);
    if (!Array.isArray(list)) {
      return 0;
    }
    return list.length;
  }

  /**
   * Get a range of elements from a list
   * @param {string} key - List key
   * @param {number} start - Start index
   * @param {number} stop - Stop index (-1 for end)
   * @returns {Promise<Array>} List elements
   */
  async lrange(key, start, stop) {
    if (this.isExpired(key)) {
      this.cache.delete(key);
      this.expirations.delete(key);
      return [];
    }
    
    if (!this.cache.has(key)) {
      return [];
    }
    
    const list = this.cache.get(key);
    if (!Array.isArray(list)) {
      return [];
    }
    
    if (stop === -1) {
      return list.slice(start);
    }
    return list.slice(start, stop + 1);
  }

  /**
   * Set operations - Add member to set
   * @param {string} key - Set key
   * @param {...any} members - Members to add
   * @returns {Promise<number>} Number of new members added
   */
  async sadd(key, ...members) {
    let set = await this.get(key);
    if (!Array.isArray(set)) {
      set = [];
    }
    
    let addedCount = 0;
    for (const member of members) {
      if (!set.includes(member)) {
        set.push(member);
        addedCount++;
      }
    }
    
    await this.set(key, set);
    return addedCount;
  }

  /**
   * Set operations - Get all members of set
   * @param {string} key - Set key
   * @returns {Promise<Array>} Set members
   */
  async smembers(key) {
    const set = await this.get(key);
    if (!Array.isArray(set)) {
      return [];
    }
    return [...set];
  }

  /**
   * Increment a numeric value
   * @param {string} key - Cache key
   * @param {number} increment - Increment amount (default: 1)
   * @returns {Promise<number>} New value
   */
  async incr(key, increment = 1) {
    const currentValue = await this.get(key);
    const numValue = parseInt(currentValue) || 0;
    const newValue = numValue + increment;
    
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Increment a key by a given amount
   * @param {string} key - Cache key
   * @param {number} increment - Increment amount
   * @returns {Promise<number>} New value
   */
  async incrby(key, increment) {
    const currentValue = await this.get(key);
    const numValue = parseInt(currentValue) || 0;
    const newValue = numValue + increment;
    
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Get keys matching pattern
   * @param {string} pattern - Pattern to match (supports * wildcard)
   * @returns {Promise<Array>} Matching keys
   */
  async keys(pattern = '*') {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const matchingKeys = [];
    
    for (const key of this.cache.keys()) {
      if (!this.isExpired(key) && regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    
    return matchingKeys;
  }

  /**
   * Flush all data
   * @returns {Promise<string>} 'OK'
   */
  async flushall() {
    this.cache.clear();
    this.expirations.clear();
    this.memoryUsage = 0;
    return 'OK';
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      keys: this.cache.size,
      memoryUsage: this.memoryUsage,
      memoryUsageFormatted: this.formatBytes(this.memoryUsage),
      maxMemory: this.config.maxMemory,
      maxMemoryFormatted: this.formatBytes(this.config.maxMemory),
      memoryUtilization: (this.memoryUsage / this.config.maxMemory * 100).toFixed(2) + '%',
      expiredKeys: this.expirations.size,
      uptime: process.uptime()
    };
  }

  /**
   * Check if key is expired
   * @param {string} key - Cache key
   * @returns {boolean} True if expired
   */
  isExpired(key) {
    if (!this.expirations.has(key)) {
      return false;
    }
    
    const expirationTime = this.expirations.get(key);
    return Date.now() > expirationTime;
  }

  /**
   * Start cleanup interval for expired keys
   */
  startCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredKeys();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Clean up expired keys
   */
  cleanupExpiredKeys() {
    const expiredKeys = [];
    
    for (const [key, expirationTime] of this.expirations.entries()) {
      if (Date.now() > expirationTime) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.del(key);
    }
    
    if (expiredKeys.length > 0) {
      console.log(`MockRedis: Cleaned up ${expiredKeys.length} expired keys`);
    }
  }

  /**
   * Evict oldest keys when limit reached
   * @param {number} count - Number of keys to evict
   */
  evictOldestKeys(count) {
    const keys = Array.from(this.cache.keys()).slice(0, count);
    for (const key of keys) {
      this.del(key);
    }
  }

  /**
   * Evict keys to free memory
   * @param {number} requiredSpace - Required space in bytes
   */
  evictByMemory(requiredSpace) {
    const keys = Array.from(this.cache.keys());
    let freedSpace = 0;
    
    for (const key of keys) {
      if (freedSpace >= requiredSpace) break;
      
      const value = this.cache.get(key);
      const valueSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
      
      this.del(key);
      freedSpace += valueSize;
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Simulate Redis connection
   * @returns {Promise<string>} Connection status
   */
  async connect() {
    return 'Connected to MockRedis';
  }

  /**
   * Simulate Redis disconnection
   * @returns {Promise<string>} Disconnection status
   */
  async disconnect() {
    this.stopCleanupInterval();
    return 'Disconnected from MockRedis';
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  healthCheck() {
    return {
      status: 'healthy',
      type: 'mock-redis',
      ...this.getStats()
    };
  }
}

module.exports = MockRedisService;