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

      // Determine fallback models based on primary selection
      let fallbackModels = [];

      if (primaryModel.includes('deepseek') || primaryModel.includes('qwen')) {
        // DeepSeek/Qwen -> Fallback to GPT-4o-mini or Gemini Flash
        fallbackModels = ['gpt-4o-mini', 'gemini-2.5-flash'];
      } else if (primaryModel === 'gpt-4o') {
        // GPT-4o -> Fallback to GPT-4o-mini
        fallbackModels = ['gpt-4o-mini'];
      } else if (primaryModel === 'gemini-pro') {
        // Gemini Pro -> Fallback to Gemini Flash
        fallbackModels = ['gemini-2.5-flash'];
      } else {
        // Default fallback
        fallbackModels = ['gpt-4o-mini'];
      }

      // Build routing result
      const route = {
        type: enhancedRouting.type,
        difficulty: enhancedRouting.difficulty, // 'dynamic'
        intent: enhancedRouting.type === 'coding' ? 'coding' : 'general',
        subscriptionPlan,
        primaryModel: primaryModel,
        fallbackModels: fallbackModels,
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