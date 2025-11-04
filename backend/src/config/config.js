const dotenv = require('dotenv');
dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD || '',
  },
  qdrant: {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceFree: process.env.STRIPE_PRICE_FREE,
    pricePlus: process.env.STRIPE_PRICE_PLUS,
    pricePro: process.env.STRIPE_PRICE_PRO,
  },
  // JWT removed - using Supabase Auth exclusively
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
