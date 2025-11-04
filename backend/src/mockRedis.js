// mockRedis.js
const redisClient = {
  status: 'ready',

  // Simulate a ping command
  ping: async () => {
    console.log('Mock Redis ping called');
    return 'PONG';
  },

  // Simulate a quit/close connection
  quit: async () => {
    console.log('Mock Redis connection closed');
    return 'OK';
  },

  // Optional: simulate get/set for testing
  get: async (key) => {
    console.log(`Mock Redis GET called for key: ${key}`);
    return null; // return null by default
  },

  set: async (key, value) => {
    console.log(`Mock Redis SET called for key: ${key}, value: ${value}`);
    return 'OK';
  },

  // Optional: simulate delete
  del: async (key) => {
    console.log(`Mock Redis DEL called for key: ${key}`);
    return 1;
  }
};

module.exports = { redisClient };
