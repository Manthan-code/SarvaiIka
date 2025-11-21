const enhancedRouterService = require('./enhancedRouterService');
const logger = require('../utils/logger');

class EnhancedModelRouter {
  constructor() {
    this.enhancedRouter = enhancedRouterService;
  }

  async routeQuery(userMessage, subscriptionPlan = 'free') {
    try {
      // Use enhanced routing service (LLM) for intelligent analysis and selection
      const enhancedRouting = await this.enhancedRouter.routeQuery(userMessage, {
        sessionId: `session_${Date.now()}`,
        subscriptionPlan
      });

      // The LLM has already made the final decision based on the plan
      const primaryModel = enhancedRouting.primaryModel;

      // Build routing result
      const route = {
        type: enhancedRouting.type,
        difficulty: enhancedRouting.difficulty, // 'dynamic'
        intent: enhancedRouting.type === 'coding' ? 'coding' : 'general',
        subscriptionPlan,
        primaryModel: primaryModel,
        fallbackModels: [], // LLM selection is definitive; could add generic fallbacks if needed
        restricted: false,
        downgraded: false, // Logic is internal to LLM
        allowed: true,
        confidence: 1.0,
        systemPrompt: enhancedRouting.systemPrompt, // Pass through for debugging
        reasoning: {
          primary: `AI Router selected ${primaryModel}`,
          subscriptionLogic: `Router respected ${subscriptionPlan} plan constraints`
        }
      };

      logger.info(`🛣️ AI Router Decision: ${subscriptionPlan} user -> ${primaryModel}`);
      return route;

    } catch (error) {
      logger.error('Enhanced routing failed:', error);
      return this.getDefaultRoute(subscriptionPlan);
    }
  }

  getDefaultRoute(subscriptionPlan) {
    return {
      type: 'text',
      difficulty: 'easy',
      intent: 'general',
      subscriptionPlan,
      primaryModel: 'gemini-2.5-flash-lite', // Safe default
      fallbackModels: ['gemini-2.5-flash-lite'],
      restricted: false,
      downgraded: false,
      allowed: true,
      reasoning: {
        primary: 'Default routing due to error',
        subscriptionLogic: 'Fallback to safe default'
      }
    };
  }
}

const modelRouter = new EnhancedModelRouter();

module.exports = {
  EnhancedModelRouter,
  modelRouter
};