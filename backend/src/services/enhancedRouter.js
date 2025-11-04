const EnhancedRouterService = require('./enhancedRouterService.js');
const logger = require('../config/logger.js');

class EnhancedModelRouter {
  constructor() {
    this.enhancedRouter = new EnhancedRouterService();
    // Simplified two-tier routing: easy (cheap) and hard (expensive)
    // Free users always get easy/cheap models
    // Plus/Pro users get appropriate model based on difficulty
    this.routingConfig = {
      // Easy/Cheap models for simple queries (Gemini-only)
      easy: {
        free: { primary: 'gemini-2.5-flash-lite', fallback: ['gemini-2.5-flash'] },
        plus: { primary: 'gemini-2.5-flash-lite', fallback: ['gemini-2.5-flash'] },
        pro: { primary: 'gemini-2.5-flash-lite', fallback: ['gemini-2.5-flash'] }
      },
      // Hard/Expensive models for complex queries (Plus/Pro only)
      hard: {
        free: { 
          primary: 'gemini-2.5-flash', 
          fallback: ['gemini-2.5-flash-lite'], 
          downgraded: true,
          originalDifficulty: 'hard'
        },
        plus: { primary: 'gemini-2.5-flash', fallback: ['gemini-2.5-flash-lite'] },
        pro: { primary: 'gemini-2.5-flash', fallback: ['gemini-2.5-flash-lite'] }
      }
    };
  }

  async routeQuery(userMessage, subscriptionPlan = 'free') {
    try {
      // Use enhanced routing service for intelligent analysis
      const enhancedRouting = await this.enhancedRouter.routeQuery(userMessage, {
        sessionId: `session_${Date.now()}`,
        subscriptionPlan
      });
      
      // Backward compatibility intent derived from enhanced routing
      const intent = enhancedRouting.type === 'coding'
        ? (userMessage && /```|code|function|class|debug/i.test(userMessage) ? 'code_generation' : 'general')
        : (enhancedRouting.type === 'text' ? 'general' : 'general');
      
      // Determine difficulty: only 'easy' or 'hard'
      const aiDifficulty = enhancedRouting.difficulty === 'hard' ? 'hard' : 'easy';
      
      // Apply subscription-based routing logic
      let routingDifficulty;
      if (subscriptionPlan === 'free') {
        // Free users ALWAYS get easy/cheap models regardless of query difficulty
        routingDifficulty = 'easy';
      } else if (['plus', 'pro'].includes(subscriptionPlan)) {
        // Plus/Pro users get appropriate model based on AI analysis
        routingDifficulty = aiDifficulty;
      } else {
        // Default to easy for unknown plans
        routingDifficulty = 'easy';
      }
      
      // Get routing configuration
      const config = this.routingConfig[routingDifficulty]?.[subscriptionPlan];
      
      if (!config) {
        logger.warn(`No routing config found for ${routingDifficulty}/${subscriptionPlan}`);
        return this.getDefaultRoute(subscriptionPlan);
      }
      
      // Determine if user was downgraded
      const wasDowngraded = subscriptionPlan === 'free' && aiDifficulty === 'hard';
      
      // Build routing result
      const route = {
        type: enhancedRouting.type,
        difficulty: routingDifficulty,
        aiAnalyzedDifficulty: aiDifficulty, // What AI determined
        intent,
        subscriptionPlan,
        primaryModel: config.primary,
        fallbackModels: config.fallback || [],
        restricted: false, // No restrictions in this simplified model
        downgraded: wasDowngraded,
        allowed: true,
        // Enhanced routing metadata
        confidence: enhancedRouting.confidence,
        reasoning: {
          ...enhancedRouting.reasoning,
          subscriptionLogic: wasDowngraded 
            ? `Query difficulty: ${aiDifficulty}, but free users redirected to easy/cheap model`
            : `Query difficulty: ${aiDifficulty}, ${subscriptionPlan} user gets ${routingDifficulty} model`
        },
        enhancedAnalysis: {
          originalPrimaryModel: enhancedRouting.primaryModel,
          originalFallbackModel: enhancedRouting.fallbackModel,
          routingMetadata: enhancedRouting.metadata
        }
      };
      
      const logMessage = wasDowngraded 
        ? `🛣️ Route: ${aiDifficulty}→easy/${subscriptionPlan} → ${config.primary} (downgraded)`
        : `🛣️ Route: ${aiDifficulty}/${subscriptionPlan} → ${config.primary}`;
      
      logger.info(`${logMessage} (confidence: ${(enhancedRouting.confidence * 100).toFixed(1)}%)`);
      return route;
      
    } catch (error) {
      logger.error('Enhanced routing failed:', error);
      return this.getDefaultRoute(subscriptionPlan);
    }
  }
  
  getDefaultRoute(subscriptionPlan) {
    return {
      type: 'text',
      difficulty: 'easy', // Always default to easy
      aiAnalyzedDifficulty: 'easy',
      intent: 'general',
      subscriptionPlan,
      primaryModel: 'gemini-2.5-flash-lite', // Default to 2.5 family
      fallbackModels: ['gemini-2.5-flash'],
      restricted: false,
      downgraded: false,
      allowed: true,
      reasoning: {
        primary: 'Default routing due to analysis error',
        subscriptionLogic: 'Fallback to safe easy/cheap model (Gemini)'
      }
    };
  }
}

const modelRouter = new EnhancedModelRouter();

module.exports = {
  EnhancedModelRouter,
  modelRouter
};