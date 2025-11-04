const Redis = require('ioredis');
const dotenv = require('dotenv');
const logger = require('../config/logger.js');

dotenv.config();

// Redis client configuration
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Handle connection events
redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis client error:', err);
});

redisClient.on('close', () => {
  logger.warn('🔌 Redis client disconnected');
});

module.exports = redisClient;