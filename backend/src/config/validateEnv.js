const logger = require('../utils/logger');

const requiredEnvVars = {
  SUPABASE_URL: { pattern: /^https:\/\/.*\.supabase\.co$/, description: 'Supabase project URL' },
  SUPABASE_ANON_KEY: { pattern: /^eyJ/, description: 'Supabase anonymous key' },
  SUPABASE_SERVICE_ROLE_KEY: { pattern: /^eyJ/, description: 'Supabase service role key' },
  REDIS_URL: { pattern: /^redis(s)?:\/\//, description: 'Redis connection URL' },
  // AI keys: allow either OpenAI or Gemini
  OPENAI_API_KEY: { pattern: /^(sk-|AIza)/, description: 'OpenAI API key or Gemini API key (if set here)' , required: false },
  FREE_MODEL_API_KEY: { pattern: /^AIza/, description: 'Gemini API key for free/primary models', required: false },
  QDRANT_URL: { pattern: /^https?:\/\//, description: 'Qdrant vector database URL' },
  STRIPE_SECRET_KEY: { pattern: /^sk_(test_|live_)/, description: 'Stripe secret key' },
  STRIPE_WEBHOOK_SECRET: { pattern: /^whsec_/, description: 'Stripe webhook secret' },
  JWT_SECRET: { minLength: 32, description: 'JWT signing secret (32+ chars)' },
  ENCRYPTION_KEY: { minLength: 32, description: 'Data encryption key (32+ chars)' },
  NODE_ENV: { enum: ['development', 'production', 'test'], description: 'Node environment' },
  PORT: { pattern: /^\d+$/, description: 'Server port number' },
  FRONTEND_URL: { pattern: /^https?:\/\//, description: 'Frontend application URL' }
};

const validateEnvironment = () => {
  // Skip validation if explicitly disabled (e.g., during tests)
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }
  
  const errors = [];
  const warnings = [];
  
  // Special case: require at least one AI key (OpenAI or Gemini)
  const hasAnyAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.FREE_MODEL_API_KEY);
  if (!hasAnyAiKey) {
    errors.push('Missing AI API key: set FREE_MODEL_API_KEY for Gemini-only or OPENAI_API_KEY');
  }

  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    
    if (!value && config.required !== false) {
      errors.push(`Missing required environment variable: ${key} - ${config.description}`);
      continue;
    }
    
    if (!value) continue;
    
    if (config.pattern && !config.pattern.test(value)) {
      errors.push(`Invalid format for ${key}: ${config.description}`);
    }
    
    if (config.enum && !config.enum.includes(value)) {
      errors.push(`Invalid value for ${key}. Must be one of: ${config.enum.join(', ')}`);
    }
    
    if (config.minLength && value.length < config.minLength) {
      errors.push(`${key} must be at least ${config.minLength} characters long`);
    }
  }
  
  if (process.env.NODE_ENV === 'production') {
    if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      warnings.push('Using Stripe test key in production environment');
    }
    
    if (!process.env.FRONTEND_URL?.startsWith('https://')) {
      errors.push('FRONTEND_URL must use HTTPS in production');
    }
  }
  
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings:', warnings);
  }
  
  if (errors.length > 0) {
    logger.error('Environment validation failed:', errors);
    console.error('\n❌ Environment Validation Failed:');
    errors.forEach(error => console.error(`  • ${error}`));
    console.error('\nPlease check your .env file and fix the above issues.\n');
    process.exit(1);
  }
  
  logger.info('✅ Environment validation passed');
};

module.exports = { validateEnvironment };


