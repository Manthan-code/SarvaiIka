const Redis = require('ioredis');
const logger = require('../config/logger.js');

class UnifiedRedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.fallbackStore = {};
    this.useFallback = false;
  }

  async initialize() {
    try {
      // Prefer REDIS_URL if provided (typical in Render/managed Redis providers)
      const redisUrl = process.env.REDIS_URL;
      const commonOptions = {
        lazyConnect: true,
        connectTimeout: 5000,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        keepAlive: 30000,
      };

      if (redisUrl) {
        // Enable TLS automatically for rediss:// URLs (managed Redis providers often require TLS)
        const usesTls = redisUrl.startsWith('rediss://');
        const urlOptions = usesTls
          ? { ...commonOptions, tls: { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' } }
          : commonOptions;

        this.client = new Redis(redisUrl, urlOptions);
        logger.info('🔌 Unified Redis client: initializing via REDIS_URL');
      } else {
        // Fallback to discrete host/port/password envs
        this.client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          ...commonOptions,
        });
        logger.info('🔌 Unified Redis client: initializing via host/port/password');
      }

      // Handle connection events
      this.client.on('connect', () => {
        this.isConnected = true;
        this.useFallback = false;
        logger.info('✅ Unified Redis client connected');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error('❌ Unified Redis client error:', err);
        this.enableFallback();
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('🔌 Unified Redis client disconnected');
        this.enableFallback();
      });

      // Test connection
      await this.client.ping();
      logger.info('✅ Redis connection test successful');
      
    } catch (error) {
      logger.warn('⚠️ Redis not available. Using fallback in-memory cache.', error.message);
      this.enableFallback();
    }

    return this;
  }

  enableFallback() {
    this.useFallback = true;
    logger.info('🔄 Switched to in-memory fallback cache');
  }

  // Unified get method
  async get(key) {
    if (this.useFallback || !this.isConnected) {
      return this.fallbackStore[key] || null;
    }
    
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis get error:', error);
      this.enableFallback();
      return this.fallbackStore[key] || null;
    }
  }

  // Unified set method (supports both redis and ioredis patterns)
  async set(key, value, ...args) {
    if (this.useFallback || !this.isConnected) {
      this.fallbackStore[key] = value;
      
      // Handle TTL for fallback
      if (args.length >= 2 && (args[0] === 'EX' || args[0] === 'ex')) {
        const ttl = parseInt(args[1]);
        setTimeout(() => delete this.fallbackStore[key], ttl * 1000);
      }
      return 'OK';
    }

    try {
      if (args.length === 0) {
        return await this.client.set(key, value);
      } else {
        return await this.client.set(key, value, ...args);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
      this.enableFallback();
      this.fallbackStore[key] = value;
      return 'OK';
    }
  }

  // setex method for compatibility
  async setex(key, seconds, value) {
    return await this.set(key, value, 'EX', seconds);
  }

  // del method
  async del(keys) {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    
    if (this.useFallback || !this.isConnected) {
      let deletedCount = 0;
      keysArray.forEach(key => {
        if (this.fallbackStore[key] !== undefined) {
          delete this.fallbackStore[key];
          deletedCount++;
        }
      });
      return deletedCount;
    }

    try {
      return await this.client.del(...keysArray);
    } catch (error) {
      logger.error('Redis del error:', error);
      this.enableFallback();
      let deletedCount = 0;
      keysArray.forEach(key => {
        if (this.fallbackStore[key] !== undefined) {
          delete this.fallbackStore[key];
          deletedCount++;
        }
      });
      return deletedCount;
    }
  }

  // scan method
  async scan(cursor, ...args) {
    if (this.useFallback || !this.isConnected) {
      const keys = Object.keys(this.fallbackStore);
      return ['0', keys];
    }

    try {
      return await this.client.scan(cursor, ...args);
    } catch (error) {
      logger.error('Redis scan error:', error);
      this.enableFallback();
      const keys = Object.keys(this.fallbackStore);
      return ['0', keys];
    }
  }

  // keys method (for compatibility)
  async keys(pattern) {
    if (this.useFallback || !this.isConnected) {
      const keys = Object.keys(this.fallbackStore);
      if (pattern === '*') return keys;
      // Simple pattern matching for fallback
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error:', error);
      this.enableFallback();
      const keys = Object.keys(this.fallbackStore);
      if (pattern === '*') return keys;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    }
  }

  // flushall method
  async flushall() {
    if (this.useFallback || !this.isConnected) {
      this.fallbackStore = {};
      return 'OK';
    }

    try {
      return await this.client.flushall();
    } catch (error) {
      logger.error('Redis flushall error:', error);
      this.enableFallback();
      this.fallbackStore = {};
      return 'OK';
    }
  }

  // info method
  async info(section) {
    if (this.useFallback || !this.isConnected) {
      return 'redis_version:fallback\r\nused_memory:0\r\n';
    }

    try {
      return await this.client.info(section);
    } catch (error) {
      logger.error('Redis info error:', error);
      return 'redis_version:fallback\r\nused_memory:0\r\n';
    }
  }

  // dbsize method
  async dbsize() {
    if (this.useFallback || !this.isConnected) {
      return Object.keys(this.fallbackStore).length;
    }

    try {
      return await this.client.dbsize();
    } catch (error) {
      logger.error('Redis dbsize error:', error);
      return Object.keys(this.fallbackStore).length;
    }
  }

  // ping method
  async ping() {
    if (this.useFallback || !this.isConnected) {
      return 'PONG';
    }

    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis ping error:', error);
      return 'PONG';
    }
  }

  // quit method for graceful shutdown
  async quit() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        logger.info('✅ Redis client disconnected gracefully');
      } catch (error) {
        logger.error('Error during Redis quit:', error);
      }
    }
  }

  // connect method for compatibility
  async connect() {
    if (!this.client) {
      await this.initialize();
    }
    return this;
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      useFallback: this.useFallback,
      fallbackKeys: Object.keys(this.fallbackStore).length
    };
  }
}

// Create and export singleton instance
const unifiedRedisClient = new UnifiedRedisClient();

module.exports = unifiedRedisClient;