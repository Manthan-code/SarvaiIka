// File: backend/testCache.js
import dotenv from "dotenv";

dotenv.config();

import { setCache, getCache } from "./src/services/cacheService.js";
import logger from './src/config/logger.js';

const runTest = async () => {
  const testKey = "myTestKey";
  const testValue = { message: "Hello from cache!" };

  // Save to cache
  await setCache(testKey, testValue, 10); // TTL 10 seconds
  logger.info('Saved to cache:', testValue);

  // Read from cache
  const cachedData = await getCache(testKey);
  logger.info('Read from cache:', cachedData);

  // Wait 12 seconds to verify TTL expiration
  setTimeout(async () => {
    const expiredData = await getCache(testKey);
    logger.info('After TTL, cache should be null:', expiredData);
    process.exit(0);
  }, 12000);
};

runTest();
