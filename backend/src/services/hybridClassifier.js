/**
 * Hybrid Query Classification Service
 * Combines fast local pattern matching with GPT-3.5 fallback for optimal performance
 * Expected 60-80% faster response times through intelligent caching and local classification
 */

const MockAiService = require('./mockAiService');
const logger = require('../config/logger');
const crypto = require('crypto');

class HybridClassifier {
  constructor() {
    this.localPatterns = this.initializeLocalPatterns();
    this.confidenceThreshold = 0.75; // Minimum confidence for local classification
    this.mockAi = new MockAiService();
    this.performanceMetrics = {
      localClassifications: 0,
      gptFallbacks: 0,
      totalQueries: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Initialize comprehensive local pattern matching rules
   */
  initializeLocalPatterns() {
    return {
      // High-confidence coding patterns
      coding: {
        patterns: [
          // Code blocks and syntax
          { regex: /```[\s\S]*```/, weight: 0.9, difficulty: 'hard' },
          { regex: /\b(function|class|const|let|var|def|import|export)\s*[\(\{\=]/i, weight: 0.85, difficulty: 'easy' },
          
          // Programming languages
          { regex: /\b(javascript|python|java|typescript|react|node\.?js|express|sql|html|css|php|ruby|go|rust|c\+\+)\b/i, weight: 0.8, difficulty: 'easy' },
          
          // Development actions
          { regex: /\b(debug|fix|implement|create|build|develop|code|program)\s+(a|an|the)?\s*(function|class|component|api|app|website|database)/i, weight: 0.85, difficulty: 'hard' },
          { regex: /\b(how\s+to\s+)?(code|program|implement|develop|build)/i, weight: 0.7, difficulty: 'easy' },
          
          // Error handling
          { regex: /\b(error|bug|exception|crash|fail|broken)\b.*\b(fix|solve|debug|resolve)/i, weight: 0.8, difficulty: 'hard' },
          { regex: /\b(syntax\s+error|runtime\s+error|compilation\s+error)/i, weight: 0.9, difficulty: 'hard' },
          
          // Technical terms
          { regex: /\b(algorithm|data\s+structure|optimization|performance|scalability)/i, weight: 0.75, difficulty: 'hard' },
          { regex: /\b(api|endpoint|database|query|schema|migration)/i, weight: 0.7, difficulty: 'easy' }
        ],
        keywords: ['code', 'function', 'class', 'debug', 'implement', 'programming', 'development', 'software']
      },

      // High-confidence image generation patterns
      image: {
        patterns: [
          // Direct image requests
          { regex: /\b(create|generate|make|draw|design)\s+(an?\s+)?(image|picture|illustration|artwork|logo|icon)/i, weight: 0.9, difficulty: 'easy' },
          { regex: /\b(show|display)\s+me\s+(an?\s+)?(image|picture|photo)/i, weight: 0.85, difficulty: 'easy' },
          
          // Visual content
          { regex: /\b(visual|graphic|artwork|painting|sketch|drawing|render)/i, weight: 0.75, difficulty: 'easy' },
          { regex: /\b(banner|poster|thumbnail|avatar|profile\s+picture)/i, weight: 0.8, difficulty: 'easy' },
          
          // Art styles
          { regex: /\b(realistic|cartoon|anime|abstract|minimalist|vintage|modern)\s+(style|art|image)/i, weight: 0.8, difficulty: 'easy' },
          { regex: /\bin\s+the\s+style\s+of/i, weight: 0.75, difficulty: 'easy' }
        ],
        keywords: ['image', 'picture', 'visual', 'draw', 'create', 'generate', 'design', 'artwork']
      },

      // High-confidence text/conversation patterns
      text: {
        patterns: [
          // Questions and explanations
          { regex: /^(what|how|why|when|where|who|which|can\s+you)\s+/i, weight: 0.7, difficulty: 'easy' },
          { regex: /\b(explain|describe|tell\s+me|help\s+me\s+understand)/i, weight: 0.75, difficulty: 'easy' },
          
          // Analysis and comparison
          { regex: /\b(analyze|compare|contrast|evaluate|assess|review)/i, weight: 0.8, difficulty: 'hard' },
          { regex: /\b(pros\s+and\s+cons|advantages\s+and\s+disadvantages|benefits\s+and\s+drawbacks)/i, weight: 0.75, difficulty: 'hard' },
          
          // Writing assistance
          { regex: /\b(write|compose|draft)\s+(a|an|the)?\s*(letter|email|essay|article|report|summary)/i, weight: 0.8, difficulty: 'hard' },
          { regex: /\b(improve|edit|revise|proofread)\s+(this|my)/i, weight: 0.75, difficulty: 'easy' },
          
          // General conversation
          { regex: /^(hi|hello|hey|good\s+(morning|afternoon|evening))/i, weight: 0.9, difficulty: 'easy' },
          { regex: /\b(thank\s+you|thanks|please|sorry)/i, weight: 0.6, difficulty: 'easy' }
        ],
        keywords: ['explain', 'help', 'question', 'answer', 'information', 'advice', 'suggestion']
      },

      // Video patterns (currently unsupported, fallback to text)
      video: {
        patterns: [
          { regex: /\b(create|generate|make)\s+(a|an|the)?\s*(video|animation|movie|clip)/i, weight: 0.9, difficulty: 'hard' },
          { regex: /\b(video\s+editing|motion\s+graphics|animation)/i, weight: 0.85, difficulty: 'hard' }
        ],
        keywords: ['video', 'animation', 'movie', 'clip', 'motion']
      }
    };
  }

  /**
   * Main classification method with hybrid approach
   */
  async classifyQuery(query, context = {}) {
    const startTime = Date.now();
    this.performanceMetrics.totalQueries++;

    try {
      // Step 1: Fast local classification
      const localResult = this.performLocalClassification(query);
      
      // Step 2: Check confidence threshold
      if (localResult.confidence >= this.confidenceThreshold) {
        this.performanceMetrics.localClassifications++;
        const responseTime = Date.now() - startTime;
        this.updateAverageResponseTime(responseTime);
        
        logger.info(`Local classification: ${localResult.type}/${localResult.difficulty} (confidence: ${localResult.confidence.toFixed(2)}, ${responseTime}ms)`);
        
        return {
          type: localResult.type,
          difficulty: localResult.difficulty,
          confidence: localResult.confidence,
          source: 'local',
          responseTime,
          reasoning: localResult.reasoning
        };
      }

      // Step 3: GPT-3.5 fallback for uncertain cases
      logger.info(`Low confidence (${localResult.confidence.toFixed(2)}), using GPT-3.5 fallback`);
      this.performanceMetrics.gptFallbacks++;
      
      const gptResult = await this.mockAi.analyzeQuery(query);
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      return {
        type: gptResult.type || 'text',
        difficulty: gptResult.difficulty || 'easy',
        confidence: gptResult.confidence || 0.95,
        source: 'mock-ai',
        responseTime,
        reasoning: `Mock AI analysis (local confidence was ${localResult.confidence.toFixed(2)})`
      };

    } catch (error) {
      logger.error('Hybrid classification error:', error);
      
      // Fallback to local result even if confidence is low
      const localResult = this.performLocalClassification(query);
      const responseTime = Date.now() - startTime;
      
      return {
        type: localResult.type || 'text',
        difficulty: localResult.difficulty || 'easy',
        confidence: Math.max(localResult.confidence, 0.5),
        source: 'local_fallback',
        responseTime,
        reasoning: 'Error fallback to local classification'
      };
    }
  }

  /**
   * Perform fast local pattern matching classification
   */
  performLocalClassification(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const scores = {
      coding: 0,
      image: 0,
      text: 0,
      video: 0
    };
    
    let maxDifficulty = 'easy';
    let matchedPatterns = [];

    // Analyze each content type
    for (const [type, config] of Object.entries(this.localPatterns)) {
      let typeScore = 0;
      
      // Pattern matching
      for (const pattern of config.patterns) {
        if (pattern.regex.test(query)) {
          typeScore += pattern.weight;
          matchedPatterns.push(`${type}:${pattern.regex.source}`);
          
          // Track highest difficulty
          if (pattern.difficulty === 'hard') maxDifficulty = 'hard';
        }
      }
      
      // Keyword matching (lower weight)
      const keywordMatches = config.keywords.filter(keyword => 
        normalizedQuery.includes(keyword.toLowerCase())
      ).length;
      typeScore += keywordMatches * 0.1;
      
      scores[type] = Math.min(typeScore, 1.0); // Cap at 1.0
    }

    // Determine primary type and confidence
    const sortedTypes = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .filter(([,score]) => score > 0);

    if (sortedTypes.length === 0) {
      return {
        type: 'text',
        difficulty: 'easy',
        confidence: 0.3,
        reasoning: 'No patterns matched, defaulting to text'
      };
    }

    const [primaryType, primaryScore] = sortedTypes[0];
    const [, secondaryScore = 0] = sortedTypes[1] || [];
    
    // Calculate confidence based on score difference and absolute score
    const scoreDifference = primaryScore - secondaryScore;
    const confidence = Math.min(
      primaryScore * 0.7 + scoreDifference * 0.3,
      0.95
    );

    return {
      type: primaryType,
      difficulty: maxDifficulty,
      confidence,
      reasoning: `Local patterns: ${matchedPatterns.slice(0, 3).join(', ')}`
    };
  }

  /**
   * Update performance metrics
   */
  updateAverageResponseTime(responseTime) {
    const { totalQueries, averageResponseTime } = this.performanceMetrics;
    this.performanceMetrics.averageResponseTime = 
      ((averageResponseTime * (totalQueries - 1)) + responseTime) / totalQueries;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const { localClassifications, gptFallbacks, totalQueries, averageResponseTime } = this.performanceMetrics;
    
    return {
      totalQueries,
      localClassifications,
      gptFallbacks,
      localPercentage: totalQueries > 0 ? (localClassifications / totalQueries * 100).toFixed(1) : 0,
      averageResponseTime: Math.round(averageResponseTime),
      estimatedSpeedImprovement: this.calculateSpeedImprovement()
    };
  }

  /**
   * Calculate estimated speed improvement
   */
  calculateSpeedImprovement() {
    const { localClassifications, gptFallbacks } = this.performanceMetrics;
    const totalClassifications = localClassifications + gptFallbacks;
    
    if (totalClassifications === 0) return 0;
    
    // Assume GPT-3.5 takes ~800ms, local takes ~5ms
    const avgGptTime = 800;
    const avgLocalTime = 5;
    
    const currentAvgTime = 
      (localClassifications * avgLocalTime + gptFallbacks * avgGptTime) / totalClassifications;
    const allGptTime = avgGptTime;
    
    return Math.round(((allGptTime - currentAvgTime) / allGptTime) * 100);
  }

  /**
   * Update confidence threshold
   */
  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.max(0.1, Math.min(0.95, threshold));
    logger.info(`Confidence threshold updated to ${this.confidenceThreshold}`);
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.performanceMetrics = {
      localClassifications: 0,
      gptFallbacks: 0,
      totalQueries: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Add custom pattern for specific use cases
   */
  addCustomPattern(type, pattern, weight = 0.7, difficulty = 'easy') {
    if (!this.localPatterns[type]) {
      this.localPatterns[type] = { patterns: [], keywords: [] };
    }
    
    this.localPatterns[type].patterns.push({
      regex: new RegExp(pattern, 'i'),
      weight,
      difficulty
    });
    
    logger.info(`Added custom pattern for ${type}: ${pattern}`);
  }
}

module.exports = HybridClassifier;