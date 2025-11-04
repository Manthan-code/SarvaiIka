/**
 * Mock Redis client for backend testing
 * Prevents actual Redis connections and provides in-memory storage
 */

class MockRedis {
  constructor() {
    this.data = new Map();
    this.connected = true;
  }

  async get(key) {
    const value = this.data.get(key);
    return value || null;
  }

  async set(key, value, ...args) {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key, seconds, value) {
    this.data.set(key, value);
    // In a real implementation, we'd set expiration
    return 'OK';
  }

  async del(key) {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key, seconds) {
    // Mock expiration - in real implementation would set timer
    return this.data.has(key) ? 1 : 0;
  }

  async ttl(key) {
    // Mock TTL - return -1 for no expiration
    return this.data.has(key) ? -1 : -2;
  }

  async keys(pattern) {
    const allKeys = Array.from(this.data.keys());
    if (pattern === '*') {
      return allKeys;
    }
    // Simple pattern matching for testing
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async flushall() {
    this.data.clear();
    return 'OK';
  }

  async hget(key, field) {
    const hash = this.data.get(key);
    if (hash && typeof hash === 'object') {
      return hash[field] || null;
    }
    return null;
  }

  async hset(key, field, value) {
    let hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
    }
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }

  async hgetall(key) {
    const hash = this.data.get(key);
    return (hash && typeof hash === 'object') ? hash : {};
  }

  async hdel(key, field) {
    const hash = this.data.get(key);
    if (hash && typeof hash === 'object' && hash[field] !== undefined) {
      delete hash[field];
      return 1;
    }
    return 0;
  }

  async incr(key) {
    const current = parseInt(this.data.get(key) || '0');
    const newValue = current + 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  async decr(key) {
    const current = parseInt(this.data.get(key) || '0');
    const newValue = current - 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  // Connection methods
  async connect() {
    this.connected = true;
    return 'OK';
  }

  async disconnect() {
    this.connected = false;
    return 'OK';
  }

  async quit() {
    this.connected = false;
    return 'OK';
  }

  // Event emitter methods for compatibility
  on(event, callback) {
    return this;
  }

  off(event, callback) {
    return this;
  }

  emit(event, ...args) {
    return this;
  }

  // Mock reset for tests
  static mockReset() {
    jest.clearAllMocks();
  }

  mockClear() {
    this.data.clear();
  }
}

module.exports = MockRedis;
module.exports.default = MockRedis;