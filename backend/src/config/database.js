const { Pool } = require('pg');
const redis = require('redis');

// Database connection pool configuration
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'aiagent',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.DB_PORT || 5432,
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum number of connections
  min: parseInt(process.env.DB_POOL_MIN) || 5,  // Minimum number of connections
  idle: parseInt(process.env.DB_POOL_IDLE) || 10000, // Close connections after 10 seconds of inactivity
  acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000, // Maximum time to get connection
  evict: parseInt(process.env.DB_POOL_EVICT) || 1000, // Check for idle connections every second
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  
  // Connection timeout
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  query_timeout: 60000,
  
  // Application name for monitoring
  application_name: 'ai-agent-platform'
};

// Create PostgreSQL connection pool
const pool = new Pool(dbConfig);

// Pool event handlers
pool.on('connect', (client) => {
  console.log('New database client connected');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('release', (client) => {
  console.log('Client released back to pool');
});

// Redis connection configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
  socket: {
    connectTimeout: 60000,
    lazyConnect: true,
    keepAlive: true
  }
};

// Create Redis client
const redisClient = redis.createClient(redisConfig);

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('ready', () => {
  console.log('Redis client ready');
});

redisClient.on('end', () => {
  console.log('Redis client disconnected');
});

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Redis health check
const checkRedisHealth = async () => {
  try {
    await redisClient.ping();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Redis health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Closing database connections...');
  try {
    await pool.end();
    await redisClient.quit();
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
  }
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('beforeExit', gracefulShutdown);

module.exports = {
  pool,
  redisClient,
  checkDatabaseHealth,
  checkRedisHealth,
  gracefulShutdown
};