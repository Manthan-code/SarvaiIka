// Enhanced Router with more sophisticated routing
const { analyzeQuery } = require('./routerAgent.js');

class EnhancedRouter {
  constructor() {
    this.routingRules = {
      // Define routing rules by intent and complexity
      'code_generation': {
        simple: { model: 'gpt-4o-mini', provider: 'openai' },
        moderate: { model: 'gpt-4o', provider: 'openai' },
        complex: { model: 'gpt-4', provider: 'openai', requiresPro: true }
      },
      'data_analysis': {
        simple: { model: 'gpt-4o-mini', provider: 'openai' },
        moderate: { model: 'gpt-4o', provider: 'openai' },
        complex: { model: 'claude-3-opus', provider: 'anthropic', requiresPro: true }
      },
      'creative_writing': {
        simple: { model: 'gpt-3.5-turbo', provider: 'openai' },
        moderate: { model: 'gpt-4o', provider: 'openai' },
        complex: { model: 'claude-3-sonnet', provider: 'anthropic' }
      },
      'image_generation': {
        all: { model: 'dall-e-3', provider: 'openai', requiresPro: true }
      },
      'diagram_creation': {
        all: { model: 'lucidchart-api', provider: 'lucidchart', requiresPro: true }
      }
    };
  }

  async routeMessage(message, userPlan, context = {}) {
    // 1. Analyze the message
    const analysis = await analyzeQuery(message);
    
    // 2. Apply routing rules
    const route = this.applyRoutingRules(analysis, userPlan);
    
    // 3. Add context-aware routing
    const enhancedRoute = this.addContextualRouting(route, context);
    
    // 4. Apply fallback strategies
    return this.applyFallbackStrategies(enhancedRoute, userPlan);
  }

  applyRoutingRules(analysis, userPlan) {
    const { intent, complexity } = analysis;
    const rules = this.routingRules[intent] || this.routingRules['general'];
    
    let selectedRule = rules[complexity] || rules['moderate'] || rules['all'];
    
    // Check subscription requirements
    if (selectedRule.requiresPro && userPlan !== 'pro') {
      selectedRule = this.getDowngradedOption(intent, complexity);
    }
    
    return { ...analysis, ...selectedRule };
  }

  addContextualRouting(route, context) {
    // Add context-aware enhancements
    if (context.conversationLength > 10) {
      route.useMemoryOptimization = true;
    }
    
    if (context.userPreferences?.preferredModel) {
      route.model = context.userPreferences.preferredModel;
    }
    
    return route;
  }

  applyFallbackStrategies(route, userPlan) {
    // Implement fallback strategies for reliability
    route.fallbackModels = this.getFallbackModels(route.model, userPlan);
    return route;
  }
}

module.exports = { EnhancedRouter };