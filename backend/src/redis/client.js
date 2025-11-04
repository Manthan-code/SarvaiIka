// backend/src/redis/client.js
const { createClient } = require("redis");

let redisClient;

async function initializeRedis() {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://127.0.0.1:6379", // or ::1
    });

    redisClient.on("error", (err) => console.error("Redis Client Error", err));

    await redisClient.connect();
    console.log("✅ Connected to Redis");
  } catch (err) {
    console.warn("⚠️ Redis not available. Using fallback in-memory cache.", err.message);

    // In-memory fallback
    redisClient = {
      store: {},
      async get(key) {
        return this.store[key] || null;
      },
      async set(key, value, mode, ttl) {
        this.store[key] = value;
        if (ttl && mode === "EX") setTimeout(() => delete this.store[key], ttl * 1000);
      },
      async scan(cursor, ...args) {
        // Simple implementation for fallback
        const keys = Object.keys(this.store);
        return ['0', keys]; // Return cursor '0' and all keys
      },
      async del(keys) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        let deletedCount = 0;
        keysArray.forEach(key => {
          if (this.store[key] !== undefined) {
            delete this.store[key];
            deletedCount++;
          }
        });
        return deletedCount;
      },
    };
  }

  return redisClient;
}

module.exports = initializeRedis();
