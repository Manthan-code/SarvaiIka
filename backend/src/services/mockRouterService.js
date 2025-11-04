/**
 * Mock Router Service for Testing
 * Provides deterministic routing responses without API calls
 */

class MockRouterService {
  constructor() {
    this.cache = new Map();
    this.callCount = 0;
  }

  /**
   * Mock query analysis that returns predictable results
   * @param {string} userMessage - The user's input message
   * @returns {Promise<{intent: string, complexity: string, confidence: number}>}
   */
  async analyzeQuery(userMessage) {
    this.callCount++;
    
    // Validate input - default to text type for invalid inputs
    if (!userMessage || typeof userMessage !== 'string') {
      return {
        intent: 'general',
        complexity: 'low',
        confidence: 0.1,
        type: 'text',
        reasoning: 'Invalid or empty message, defaulting to text type'
      };
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const message = userMessage.toLowerCase();
    
    // Determine type based on keywords
    let type = 'text';
    if (message.includes('image') || message.includes('picture') || message.includes('draw') || message.includes('generate an image') || message.includes('create a picture') || message.includes('make an illustration')) {
      type = 'image';
    } else if (message.includes('code') || message.includes('function') || message.includes('programming') || message.includes('debug') || message.includes('implement') || message.includes('component') || message.includes('javascript') || message.includes('python') || message.includes('sql') || message.includes('react')) {
      type = 'coding';
    } else if (message.includes('video')) {
      type = 'video';
    }
    
    // Determine difficulty based on complexity indicators
    let difficulty = 'normal';
    if (message.includes('complex') || message.includes('advanced') || message.includes('algorithm') || 
        message.includes('architecture') || message.includes('optimization') || message.length > 100) {
      difficulty = 'hard';
    }
    
    // Suggest models based on difficulty and type
    let suggestedModels = ['gpt-3.5-turbo'];
    if (type === 'image') {
      suggestedModels = ['dall-e-3'];
    } else if (type === 'coding') {
      suggestedModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'];
    } else if (difficulty === 'hard') {
      suggestedModels = ['gpt-4', 'gpt-3.5-turbo'];
    }
    
    const result = {
      type,
      difficulty,
      confidence: 0.95,
      reasoning: `Mock analysis: detected ${type} query with ${difficulty} difficulty`,
      cached: false,
      suggestedModels
    };
    
    return result;
  }

  /**
   * Mock route query with subscription plan consideration
   * @param {string} userMessage - The user's input message
   * @param {string} subscriptionPlan - User's subscription plan
   * @returns {Promise<{model: string, type: string, difficulty: string, reasoning: string}>}
   */
  async routeQuery(userMessage, subscriptionPlan = 'free') {
    const analysis = await this.analyzeQuery(userMessage);
    
    // Determine model based on subscription and difficulty
    let model = 'gpt-3.5-turbo';
    if (subscriptionPlan === 'pro' || subscriptionPlan === 'enterprise') {
      if (analysis.difficulty === 'hard') {
        model = 'gpt-4';
      }
    }
    
    // Override model for specific types
    if (analysis.type === 'image') {
      model = 'dall-e-3';
    }
    
    return {
      model,
      type: analysis.type,
      difficulty: analysis.difficulty,
      reasoning: `Mock routing: ${subscriptionPlan} user with ${analysis.type} query (${analysis.difficulty}) -> ${model}`,
      subscriptionPlan,
      cached: false
    };
  }

  /**
   * Get cached routing result (mock implementation)
   * @param {string} userMessage - The user's input message
   * @returns {Promise<Object|null>}
   */
  async getCachedRouting(userMessage) {
    const key = this.generateCacheKey(userMessage);
    return this.cache.get(key) || null;
  }

  /**
   * Clear routing cache for a specific message
   * @param {string} userMessage - The user's input message
   * @returns {Promise<boolean>}
   */
  async clearRoutingCache(userMessage) {
    const key = this.generateCacheKey(userMessage);
    return this.cache.delete(key);
  }

  /**
   * Get routing statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalCalls: this.callCount,
      cacheSize: this.cache.size,
      cacheHitRate: 0.1, // Mock cache hit rate
      averageResponseTime: 15 // Mock response time in ms
    };
  }

  /**
   * Reset the mock service state
   */
  reset() {
    this.cache.clear();
    this.callCount = 0;
  }

  /**
   * Generate cache key for a message
   * @param {string} message - The message to generate key for
   * @returns {string}
   */
  generateCacheKey(message) {
    return `mock_${message.toLowerCase().replace(/\s+/g, '_').substring(0, 50)}`;
  }

  /**
   * Simulate cache warming with common queries
   */
  async warmCache() {
    const commonQueries = [
      'What is artificial intelligence?',
      'How do I write a Python function?',
      'Generate an image of a sunset',
      'Debug this JavaScript code',
      'Explain quantum computing'
    ];
    
    for (const query of commonQueries) {
      const result = await this.analyzeQuery(query);
      const key = this.generateCacheKey(query);
      this.cache.set(key, result);
    }
  }
}

module.exports = MockRouterService;