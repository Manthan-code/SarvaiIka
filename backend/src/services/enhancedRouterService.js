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
      'gemini-2.5-flash',   // Strong factual/multilingual
      'gpt-4o-mini',        // General purpose/stable
      'deepseek-v3.2',      // Reasoning/Math
      'qwen',               // Code/Reasoning
      'mistral-small',      // Fast/Efficient
      'codestral',          // Heavy Coding
      'llama-3.1-8b'        // Fast/Open Source (via Groq)
    ];

    this.PAID_MODELS = [
      'gpt-4o',             // Premium general
      'gemini-pro',         // Premium reasoning
      'grok-4',             // Real-time/Reasoning
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

    // Ultra-Lightweight Router Prompt (Optimized for Cost & Nuance)
    const systemPrompt = `Role:Smart Router.Goal:Select best model from:[${modelListString}].Task:Analyze query vs model strengths.Pick best fit.Constraints:No fixed rules/tags.No difficulty scoring.Output:JSON {"model":"name"}`;

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
        temperature: 0.3, // Slight creativity for anti-bias
        max_tokens: 12,   // Strict token limit
        response_format: { type: "json_object" }
      });

      const rawOutput = completion.choices[0].message.content.trim();
      let selectedModel = this.FREE_MODELS[0]; // Default

      try {
        const parsed = JSON.parse(rawOutput);
        if (parsed.model && availableModels.includes(parsed.model)) {
          selectedModel = parsed.model;
        } else {
          logger.warn('[EnhancedRouterService] Invalid model in JSON, using default', parsed);
        }
      } catch (e) {
        logger.warn('[EnhancedRouterService] Failed to parse JSON output', rawOutput);
      }

      const duration = Date.now() - start;

      logger.info('[EnhancedRouterService] Routing decision', {
        query: query.substring(0, 50) + '...',
        plan: subscriptionPlan,
        selectedModel,
        rawOutput,
        duration
      });

      return {
        primaryModel: selectedModel,
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