/**
 * Mock AI Service - Simulates AI model responses without API costs
 * Provides realistic streaming responses for testing the intelligent router
 */

class MockAiService {
  constructor() {
    this.models = {
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo (Mock)',
        maxTokens: 4096,
        costPerToken: 0.0015,
        responseTime: 100, // ms per token
        specialty: 'general'
      },
      'gpt-4': {
        name: 'GPT-4 (Mock)',
        maxTokens: 8192,
        costPerToken: 0.03,
        responseTime: 150,
        specialty: 'complex reasoning'
      },
      'claude-3-sonnet': {
        name: 'Claude-3 Sonnet (Mock)',
        maxTokens: 200000,
        costPerToken: 0.003,
        responseTime: 120,
        specialty: 'analysis'
      },
      'codellama-34b': {
        name: 'CodeLlama 34B (Mock)',
        maxTokens: 16384,
        costPerToken: 0.0008,
        responseTime: 80,
        specialty: 'coding'
      },
      'dall-e-3': {
        name: 'DALL-E 3 (Mock)',
        maxTokens: 1024,
        costPerToken: 0.04,
        responseTime: 200,
        specialty: 'image generation'
      }
    };

    // Pre-defined responses for different query types
    this.responseTemplates = {
      text: {
        easy: [
          "I understand your question about {topic}. Let me provide a comprehensive answer.",
          "That's an interesting point about {topic}. Here's what I think:",
          "Based on your question regarding {topic}, I can explain that:"
        ],
        hard: [
          "This is a complex question about {topic} that requires careful analysis.",
          "The topic of {topic} involves multiple interconnected concepts that I'll break down:",
          "Your question about {topic} touches on several advanced principles:"
        ]
      },
      coding: {
        easy: [
          "Here's a solution for your {topic} problem:\n\n```javascript\n// Mock code implementation\nfunction solve{Topic}() {\n  // Implementation details\n  return 'Mock solution';\n}\n```",
          "I'll help you with {topic}. Here's the approach:\n\n```python\n# Mock Python solution\ndef handle_{topic}():\n    # Mock implementation\n    pass\n```"
        ],
        hard: [
          "This is an advanced {topic} problem. Let me break it down:\n\n```typescript\n// Complex mock implementation\ninterface {Topic}Solution {\n  // Mock interface\n}\n\nclass Advanced{Topic} implements {Topic}Solution {\n  // Mock complex logic\n}\n```",
          "For this complex {topic} challenge, we need a sophisticated approach:\n\n```java\n// Mock enterprise-level solution\npublic class {Topic}Handler {\n    // Mock advanced implementation\n}\n```"
        ]
      },
      image: {
        easy: [
          "I would generate an image of {topic} with the following characteristics: [Mock image description - a vibrant, detailed illustration showing {topic} in a realistic style]",
          "Here's what the {topic} image would look like: [Mock image description - a creative visualization of {topic} with modern artistic elements]"
        ],
        hard: [
          "For this complex {topic} image request, I would create: [Mock image description - a highly detailed, technically accurate representation of {topic} with professional quality]",
          "This advanced {topic} visualization would include: [Mock image description - a sophisticated artistic interpretation of {topic} with multiple layers and complex details]"
        ]
      },
      video: {
        easy: [
          "I would create a video about {topic} with the following script and scenes: [Mock video description - a 2-3 minute educational video explaining {topic} with clear visuals]",
          "Here's the concept for your {topic} video: [Mock video description - an engaging presentation covering key aspects of {topic}]"
        ],
        hard: [
          "For this complex {topic} video project, I would produce: [Mock video description - a comprehensive documentary-style video exploring {topic} in depth]",
          "This advanced {topic} video would feature: [Mock video description - a professional-grade production with multiple segments covering {topic}]"
        ]
      }
    };
  }

  /**
   * Analyze query and determine routing parameters
   * @param {string} query - User input
   * @returns {Object} Analysis result
   */
  async analyzeQuery(query) {
    // Simulate analysis delay
    await this.delay(200);

    const analysis = {
      type: this.detectQueryType(query),
      difficulty: this.detectDifficulty(query),
      topic: this.extractTopic(query),
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      estimatedTokens: this.estimateTokens(query),
      suggestedModel: null
    };

    // Suggest best model based on analysis
    analysis.suggestedModel = this.suggestModel(analysis);

    return analysis;
  }

  /**
   * Generate streaming response
   * @param {string} query - User input
   * @param {string} modelId - Model to use
   * @param {Object} options - Generation options
   * @returns {AsyncGenerator} Token stream
   */
  async* generateResponse(query, modelId = 'gpt-3.5-turbo', options = {}) {
    const model = this.models[modelId] || this.models['gpt-3.5-turbo'];
    const analysis = await this.analyzeQuery(query);
    
    // Get appropriate response template
    const templates = this.responseTemplates[analysis.type] || this.responseTemplates.text;
    const difficultyTemplates = templates[analysis.difficulty] || templates.easy;
    const template = difficultyTemplates[Math.floor(Math.random() * difficultyTemplates.length)];
    
    // Generate response content
    let response = template.replace(/{topic}/g, analysis.topic.toLowerCase())
                          .replace(/{Topic}/g, this.capitalize(analysis.topic));
    
    // Add additional content based on difficulty
    if (analysis.difficulty === 'hard') {
      response += this.generateAdditionalContent(analysis.type, analysis.topic);
    }

    // Simulate token-wise streaming
    const tokens = this.tokenize(response);
    const delay = model.responseTime;

    for (let i = 0; i < tokens.length; i++) {
      await this.delay(delay + Math.random() * 50); // Add some variance
      
      yield {
        token: tokens[i],
        index: i,
        total: tokens.length,
        model: model.name,
        type: analysis.type,
        difficulty: analysis.difficulty,
        metadata: {
          confidence: analysis.confidence,
          estimatedCost: (i + 1) * model.costPerToken,
          progress: ((i + 1) / tokens.length) * 100
        }
      };
    }

    // Final completion signal
    yield {
      token: '',
      index: tokens.length,
      total: tokens.length,
      model: model.name,
      completed: true,
      metadata: {
        totalTokens: tokens.length,
        totalCost: tokens.length * model.costPerToken,
        duration: tokens.length * delay
      }
    };
  }

  /**
   * Detect query type from content
   */
  detectQueryType(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('code') || lowerQuery.includes('function') || 
        lowerQuery.includes('algorithm') || lowerQuery.includes('programming') ||
        lowerQuery.includes('debug') || lowerQuery.includes('implement')) {
      return 'coding';
    }
    
    if (lowerQuery.includes('image') || lowerQuery.includes('picture') || 
        lowerQuery.includes('draw') || lowerQuery.includes('generate') ||
        lowerQuery.includes('visual') || lowerQuery.includes('illustration')) {
      return 'image';
    }
    
    if (lowerQuery.includes('video') || lowerQuery.includes('animation') || 
        lowerQuery.includes('movie') || lowerQuery.includes('clip')) {
      return 'video';
    }
    
    return 'text';
  }

  /**
   * Detect difficulty level
   */
  detectDifficulty(query) {
    const complexIndicators = [
      'complex', 'advanced', 'sophisticated', 'enterprise', 'production',
      'scalable', 'optimization', 'architecture', 'design pattern',
      'algorithm', 'performance', 'security', 'distributed'
    ];
    
    const lowerQuery = query.toLowerCase();
    const hasComplexIndicators = complexIndicators.some(indicator => 
      lowerQuery.includes(indicator)
    );
    
    return hasComplexIndicators || query.length > 200 ? 'hard' : 'easy';
  }

  /**
   * Extract main topic from query
   */
  extractTopic(query) {
    // Simple topic extraction - in real implementation, use NLP
    const words = query.split(' ').filter(word => word.length > 3);
    return words[0] || 'general topic';
  }

  /**
   * Estimate token count
   */
  estimateTokens(query) {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(query.length / 4) * 3; // Response is typically 3x input
  }

  /**
   * Suggest best model for query
   */
  suggestModel(analysis) {
    if (analysis.type === 'coding') {
      return analysis.difficulty === 'hard' ? 'gpt-4' : 'codellama-34b';
    }
    if (analysis.type === 'image') {
      return 'dall-e-3';
    }
    if (analysis.difficulty === 'hard') {
      return 'claude-3-sonnet';
    }
    return 'gpt-3.5-turbo';
  }

  /**
   * Generate additional content for complex queries
   */
  generateAdditionalContent(type, topic) {
    const additions = {
      text: `\n\nThis involves several key considerations:\n1. Theoretical foundations\n2. Practical applications\n3. Best practices\n4. Common pitfalls to avoid`,
      coding: `\n\n// Additional considerations:\n// - Error handling\n// - Performance optimization\n// - Testing strategies\n// - Documentation`,
      image: `\n\nAdditional visual elements would include:\n- Color theory application\n- Composition principles\n- Technical specifications\n- Style variations`,
      video: `\n\nProduction details:\n- Storyboard development\n- Technical requirements\n- Post-production workflow\n- Distribution strategy`
    };
    
    return additions[type] || additions.text;
  }

  /**
   * Simple tokenization
   */
  tokenize(text) {
    // Simple word-based tokenization for demo
    return text.split(/\s+/).filter(token => token.length > 0);
  }

  /**
   * Utility: Add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return Object.keys(this.models).map(id => ({
      id,
      ...this.models[id]
    }));
  }

  /**
   * Get model info
   */
  getModelInfo(modelId) {
    return this.models[modelId] || null;
  }
}

module.exports = MockAiService;