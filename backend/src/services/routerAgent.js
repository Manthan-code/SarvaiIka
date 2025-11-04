/**
 * Router agent that classifies queries based on intent and complexity.
 * If no API key is provided, it returns a mocked response.
 */

const redisClient = require('../redis/unifiedRedisClient.js');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// No external LLM dependency: use local heuristics only

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'router:';

/**
 * Analyze user query for intent and complexity
 * @param {string} userMessage - The user's input message
 * @returns {Promise<{intent: string, complexity: string}>}
 */
async function analyzeQuery(userMessage) {
  try {
    const input = (userMessage || '').toString();
    // Generate cache key
    const messageHash = crypto.createHash('md5').update(input).digest('hex');
    const cacheKey = `${CACHE_PREFIX}${messageHash}`;

    // Check Redis cache first
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log('💾 Returning cached routing result');
      return JSON.parse(cachedResult);
    }

    // Local heuristics: simple keyword/pattern checks
    const cleaned = input.toLowerCase();
    const hasCodeBlock = /```[\s\S]*```/.test(input);
    const isQuestion = /(what|how|why|when|where)\b|\?$/.test(cleaned);
    const codingHints = /(code|function|class|debug|error|bug|typescript|javascript|python|react|node|express|sql|api)\b/i.test(input) || hasCodeBlock;
    const imageHints = /(image|picture|illustration|draw|generate|art|logo)\b/i.test(input);

    let type = 'text';
    if (codingHints) type = 'coding';
    else if (imageHints) type = 'image';

    // Difficulty: simple heuristic based on length and technical signals
    const length = input.length;
    const technicalTerms = (input.match(/\b(API|REST|GraphQL|SQL|OAuth|JWT|Microservices|Architecture|Performance|Optimization)\b/gi) || []).length;
    const difficulty = (length > 160 || technicalTerms >= 2) ? 'hard' : 'easy';

    const intent = codingHints
      ? (hasCodeBlock ? 'code_debugging' : 'code_generation')
      : (imageHints ? 'image_request' : (isQuestion ? 'information_request' : 'general'));

    const result = { type, difficulty, intent };

    // Cache the result
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

    console.log(`🔄 Routing → intent=${intent} difficulty=${difficulty} type=${type}`);
    return result;
  } catch (error) {
    console.error('Router analysis failed:', error);
    // Return default values on any error
    return { intent: 'general', difficulty: 'easy', type: 'text' };
  }
}

/**
 * Get cached routing result if available
 * @param {string} userMessage - The user's input message
 * @returns {Promise<{intent: string, complexity: string} | null>}
 */
async function getCachedRouting(userMessage) {
  try {
    const messageHash = crypto.createHash('md5').update(userMessage).digest('hex');
    const cacheKey = `${CACHE_PREFIX}${messageHash}`;
    
    const cachedResult = await redisClient.get(cacheKey);
    return cachedResult ? JSON.parse(cachedResult) : null;
  } catch (error) {
    console.error('Failed to get cached routing:', error);
    return null;
  }
}

/**
 * Clear routing cache for a specific message
 * @param {string} userMessage - The user's input message
 */
async function clearRoutingCache(userMessage) {
  try {
    const messageHash = crypto.createHash('md5').update(userMessage).digest('hex');
    const cacheKey = `${CACHE_PREFIX}${messageHash}`;
    
    await redisClient.del(cacheKey);
    console.log('🗑️  Cleared routing cache');
  } catch (error) {
    console.error('Failed to clear routing cache:', error);
  }
}

/**
 * Route user queries dynamically based on intent, complexity, and subscription level
 * @param {string} userMessage - The user's input message
 * @param {string} subscriptionPlan - The user's subscription plan (free, basic, pro)
 * @returns {Promise<{model: string, endpoint: string}>}
 */
async function routeQuery(userMessage, subscriptionPlan) {
  try {
    const plan = (subscriptionPlan || 'free').toLowerCase();

    // Analyze query
    const { intent, complexity, content_type } = await analyzeQuery(userMessage);

    // Normalize to required difficulty labels
    const difficulty =
      complexity === 'low' ? 'simple' : complexity === 'high' ? 'complex' : 'moderate';

    // Defaults (Gemini-only)
    let model = 'gemini-1.5-flash';
    let endpoint = plan === 'pro' ? '/api/pro' : '/api/free';
    let contentType = (content_type || 'text').toLowerCase();
    let allowed = true;
    let downgraded = false;

    if (contentType === 'image') {
      model = 'dall-e-3';
      endpoint = 'dall-e-3';
      if (plan !== 'pro') {
        allowed = false;
      }
    } else if (contentType === 'diagram' || contentType === 'flowchart') {
      model = 'lucidchart-api';
      endpoint = 'lucidchart-api';
      if (plan !== 'pro') {
        allowed = false;
      }
    } else {
      // Text routing by difficulty
      if (difficulty === 'simple') {
        model = process.env.TEXT_SIMPLE_MODEL || process.env.FREE_MODEL || 'gemini-1.5-flash';
        endpoint = plan === 'pro' ? '/api/pro' : '/api/free';
      } else if (difficulty === 'moderate') {
        model = plan === 'pro'
          ? (process.env.TEXT_PREMIUM_MODEL || 'gemini-1.0-pro')
          : (process.env.TEXT_MODERATE_MODEL || 'gemini-1.5-flash');
        endpoint = plan === 'pro' ? '/api/pro' : '/api/free';
      } else {
        // complex
        if (plan === 'pro') {
          model = process.env.TEXT_COMPLEX_MODEL || 'gemini-1.0-pro';
          endpoint = '/api/pro';
        } else {
          // Free/basic cannot use premium; downgrade to mid-tier
          model = process.env.TEXT_MODERATE_MODEL || 'gemini-1.5-flash';
          endpoint = '/api/free';
          downgraded = true;
        }
      }
    }

    const route = {
      intent,
      contentType,
      difficulty,
      model,
      endpoint,
      allowed,
      downgraded,
      plan,
    };

    console.log(
      `🛣️ routeQuery → plan=${plan} type=${contentType} diff=${difficulty} model=${model} allowed=${allowed} downgraded=${downgraded}`
    );

    return route;
  } catch (error) {
    console.error('Failed to route query:', error);
    return {
      intent: 'general',
      contentType: 'text',
      difficulty: 'moderate',
      model: process.env.TEXT_MODERATE_MODEL || 'gemini-1.5-flash',
      endpoint: '/api/free',
      allowed: true,
      downgraded: false,
      plan: (subscriptionPlan || 'free').toLowerCase(),
    };
  }
}

module.exports = {
  analyzeQuery,
  getCachedRouting,
  clearRoutingCache,
  routeQuery
};