const OpenAI = require('openai');
const config = require('../config/config');
const logger = require('../utils/logger');

class EnhancedRouterService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    // Define available models based on StreamingService capabilities
    this.FREE_MODELS = [
      'gpt-4o-mini',
      'gemini-2.5-flash-lite'
    ];

    this.PAID_MODELS = [
      'gpt-4o',
      'gpt-4-turbo',
      'gemini-2.5-flash',
      ...this.FREE_MODELS
    ];

    // The model used to make routing decisions (fast & cheap)
    this.ROUTER_MODEL = 'gpt-4o-mini';
  }

  /**
   * Routes the query using an LLM to decide the best model.
   * @param {string} query - The user's message.
   * @param {Object} context - Context including subscription plan.
   * @returns {Promise<Object>} Routing decision.
   */
  async routeQuery(query, context = {}) {
    const { subscriptionPlan = 'free' } = context;
    const isPaid = ['plus', 'pro'].includes(subscriptionPlan);

    const availableModels = isPaid ? this.PAID_MODELS : this.FREE_MODELS;
    const modelListString = availableModels.join(', ');

    let systemPrompt = '';

    if (isPaid) {
      // Paid User Prompt: Optimize for cost if easy, quality if hard
      systemPrompt = `Select best model from: [${modelListString}].
Rules:
- Simple/Easy -> Cheap model (gpt-4o-mini, gemini-2.5-flash-lite)
- Complex/Hard -> Capable model (gpt-4o, gemini-2.5-flash)
Return ONLY model name.`;
    } else {
      // Free User Prompt: Best fit from free list
      systemPrompt = `Select best model for query from: [${modelListString}]. Return ONLY model name.`;
    }

    try {
      const start = Date.now();

      // Log the prompt being sent to Router AI (for testing/debugging)
      console.log('--- ROUTER AI PROMPT START ---');
      console.log('System Prompt:', systemPrompt);
      console.log('User Query:', query);
      console.log('--- ROUTER AI PROMPT END ---');

      logger.info('[EnhancedRouterService] Sending prompt to Router AI', {
        systemPrompt,
        userQuery: query
      });

      const completion = await this.openai.chat.completions.create({
        model: this.ROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0, // Deterministic
        max_tokens: 20,
      });

      const selectedModel = completion.choices[0].message.content.trim();
      const duration = Date.now() - start;

      // Validate selection
      const finalModel = availableModels.includes(selectedModel) ? selectedModel : availableModels[0];

      logger.info('[EnhancedRouterService] Routing decision', {
        query: query.substring(0, 50) + '...',
        plan: subscriptionPlan,
        selectedModel: finalModel,
        rawOutput: selectedModel,
        duration
      });

      return {
        primaryModel: finalModel,
        type: this.detectType(query), // Helper for legacy compatibility
        difficulty: 'dynamic', // Handled by LLM
        allowed: true,
        systemPrompt // Return prompt for frontend debugging
      };

    } catch (error) {
      logger.error('[EnhancedRouterService] Routing failed, falling back to default', error);
      return {
        primaryModel: this.FREE_MODELS[0],
        type: 'text',
        difficulty: 'easy',
        allowed: true,
        systemPrompt: 'Error in routing, fallback used'
      };
    }
  }

  /**
   * Simple regex-based type detection for compatibility with other parts of the system
   * that might expect a 'type' field (e.g. for UI hints).
   */
  detectType(query) {
    const lower = query.toLowerCase();
    if (lower.includes('image') || lower.includes('draw') || lower.includes('picture')) return 'image';
    if (lower.includes('code') || lower.includes('function') || lower.includes('bug')) return 'coding';
    if (lower.includes('diagram') || lower.includes('chart')) return 'diagram';
    return 'text';
  }
}

module.exports = new EnhancedRouterService();