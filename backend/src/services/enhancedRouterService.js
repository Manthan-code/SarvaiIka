/**
 * Enhanced Router Service - Intelligent query routing without API costs
 * Uses pattern matching, keyword analysis, and rule-based classification
 */

const MockAiService = require('../services/mockAiService');
const HybridClassifier = require('../services/hybridClassifier');
const logger = require('../config/logger');

class EnhancedRouterService {
  constructor() {
    this.mockAi = new MockAiService();
    this.hybridClassifier = new HybridClassifier();
    this.routingRules = this.initializeRoutingRules();
    this.patterns = this.initializePatterns();
    this.contextCache = new Map(); // In-memory cache for session context
  }

  /**
   * Initialize routing rules for different scenarios
   */
  initializeRoutingRules() {
    return {
      // Content type rules
      contentType: {
        coding: {
          keywords: [
            'code', 'function', 'class', 'method', 'algorithm', 'programming',
            'debug', 'error', 'bug', 'implement', 'develop', 'script',
            'api', 'database', 'frontend', 'backend', 'javascript', 'python',
            'react', 'node', 'express', 'sql', 'html', 'css', 'typescript'
          ],
          patterns: [
            /\b(write|create|build|implement)\s+(a|an|the)?\s*(function|class|component|api)/i,
            /\b(fix|debug|solve)\s+(this|the)?\s*(error|bug|issue|problem)/i,
            /\b(how\s+to\s+)?(code|program|implement|develop)/i,
            /```[\s\S]*```/,
            /\b(var|let|const|function|class|def|import|export)\b/
          ],
          models: ['gemini-1.0-pro', 'gemini-1.5-flash'],
          priority: 'high'
        },
        image: {
          keywords: [
            'image', 'picture', 'photo', 'visual', 'draw', 'create', 'generate',
            'illustration', 'artwork', 'design', 'graphic', 'logo', 'icon',
            'banner', 'poster', 'sketch', 'painting', 'render'
          ],
          patterns: [
            /\b(create|generate|make|draw)\s+(an?\s+)?(image|picture|illustration)/i,
            /\b(show|display)\s+me\s+(an?\s+)?(image|picture)/i,
            /\bvisual(ly|ize|ization)?\b/i
          ],
          models: ['gemini-2.5-flash-lite'],
          priority: 'medium'
        },
        video: {
          keywords: [
            'video', 'animation', 'movie', 'clip', 'film', 'record',
            'motion', 'sequence', 'timeline', 'storyboard', 'script'
          ],
          patterns: [
            /\b(create|make|produce)\s+(a\s+)?video/i,
            /\b(animate|animation)\b/i,
            /\bmovie\s+(script|storyboard)/i
          ],
          models: ['gemini-flash-latest'],
          priority: 'low'
        },
        text: {
          keywords: [
            'explain', 'describe', 'tell', 'what', 'how', 'why', 'when',
            'where', 'define', 'meaning', 'concept', 'theory', 'principle'
          ],
          patterns: [
            /\b(what\s+is|explain|describe|tell\s+me\s+about)/i,
            /\b(how\s+does|how\s+to|why\s+does)/i,
            /\?\s*$/
          ],
          models: ['gemini-2.5-flash-lite', 'gemini-flash-latest'],
          priority: 'medium'
        }
      },

      // Simplified difficulty assessment: only 'easy' or 'hard'
      difficulty: {
        hard: {
          keywords: [
            'complex', 'advanced', 'sophisticated', 'enterprise', 'production',
            'scalable', 'optimization', 'performance', 'architecture', 'design pattern',
            'distributed', 'microservices', 'security', 'encryption', 'algorithm',
            'machine learning', 'ai', 'neural network', 'deep learning', 'detailed',
            'comprehensive', 'in-depth', 'thorough', 'extensive', 'professional'
          ],
          patterns: [
            /\b(enterprise|production)\s+(level|grade|ready)/i,
            /\b(scalable|distributed|microservices)/i,
            /\b(optimization|performance)\s+(tuning|improvement)/i,
            /\b(design\s+pattern|architectural\s+pattern)/i,
            /\b(detailed|comprehensive|in-depth|thorough)\s+(analysis|explanation|guide)/i,
            /\b(professional|enterprise|advanced)\s+(solution|implementation)/i
          ],
          indicators: {
            length: 150, // Characters (lowered threshold)
            technicalTerms: 2, // Minimum technical terms (lowered)
            complexity: 0.6 // Complexity score threshold (lowered)
          }
        },
        easy: {
          keywords: [
            'simple', 'basic', 'beginner', 'easy', 'quick', 'brief',
            'tutorial', 'guide', 'introduction', 'overview', 'explain',
            'what is', 'how to', 'summary', 'definition'
          ],
          patterns: [
            /\b(simple|basic|easy)\s+(example|tutorial|guide)/i,
            /\b(beginner|introduction|overview)/i,
            /\bhow\s+to\s+\w+/i,
            /\bwhat\s+is\b/i,
            /\bbrief\s+(explanation|summary)/i
          ]
        }
      },

      // Context-aware routing
      context: {
        followUp: {
          patterns: [
            /\b(also|additionally|furthermore|moreover)/i,
            /\b(can\s+you\s+)?(explain\s+more|tell\s+me\s+more|elaborate)/i,
            /\b(what\s+about|how\s+about)/i
          ]
        },
        correction: {
          patterns: [
            /\b(no|not\s+quite|actually|incorrect|wrong)/i,
            /\b(fix|correct|change|modify)/i,
            /\bthat's\s+(not|wrong)/i
          ]
        }
      }
    };
  }

  /**
   * Initialize regex patterns for advanced matching
   */
  initializePatterns() {
    return {
      codeBlocks: /```[\s\S]*?```/g,
      urls: /https?:\/\/[^\s]+/g,
      emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      numbers: /\b\d+(\.\d+)?\b/g,
      technicalTerms: /\b(API|REST|GraphQL|JSON|XML|HTTP|HTTPS|SQL|NoSQL|JWT|OAuth|CRUD|MVC|MVP|MVVM)\b/gi,
      programmingLanguages: /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin)\b/gi
    };
  }

  /**
   * Main routing function - analyzes query and determines best routing
   * @param {string} query - User input
   * @param {Object} context - Session context
   * @returns {Object} Routing decision
   */
  async routeQuery(query, context = {}) {
    try {
      logger.info('Starting hybrid query routing', { query: query.substring(0, 100) });

      // Use hybrid classifier for fast, intelligent classification
      const startTime = Date.now();
      const classification = await this.hybridClassifier.classifyQuery(query, context);
      const responseTime = Math.max(Date.now() - startTime, 1);
      
      // Build routing decision based on hybrid classification
      const routingDecision = {
        type: classification.type,
        difficulty: classification.difficulty,
        primaryModel: this.selectModelForClassification(classification),
        confidence: classification.confidence,
        reasoning: classification.reasoning || `Classified as ${classification.type} with ${classification.difficulty} difficulty`,
        responseTime,
        classificationMethod: classification.method // 'local' or 'gpt'
      };
      
      // Update context cache
      this.updateContextCache(context.sessionId, {
        lastQuery: query,
        lastRouting: routingDecision,
        timestamp: Date.now()
      });

      logger.info('Hybrid routing completed', { 
        type: routingDecision.type,
        difficulty: routingDecision.difficulty,
        primaryModel: routingDecision.primaryModel,
        method: routingDecision.classificationMethod,
        responseTime: `${responseTime}ms`
      });

      return routingDecision;
    } catch (error) {
      logger.error('Error in hybrid query routing', { error: error.message });
      return this.getDefaultRouting();
    }
  }

  /**
   * Preprocess query for analysis
   */
  preprocessQuery(query) {
    // Handle null, undefined, or non-string inputs
    if (query == null || typeof query !== 'string') {
      const safeQuery = String(query || '');
      return {
        original: query,
        cleaned: safeQuery.toLowerCase().trim(),
        tokens: this.tokenize(safeQuery),
        length: safeQuery.length,
        wordCount: safeQuery ? safeQuery.split(/\s+/).length : 0,
        hasCodeBlocks: this.patterns.codeBlocks.test(safeQuery),
        hasUrls: this.patterns.urls.test(safeQuery),
        technicalTerms: this.extractTechnicalTerms(safeQuery),
        programmingLanguages: this.extractProgrammingLanguages(safeQuery)
      };
    }

    return {
      original: query,
      cleaned: query.toLowerCase().trim(),
      tokens: this.tokenize(query),
      length: query.length,
      wordCount: query.split(/\s+/).length,
      hasCodeBlocks: this.patterns.codeBlocks.test(query),
      hasUrls: this.patterns.urls.test(query),
      technicalTerms: this.extractTechnicalTerms(query),
      programmingLanguages: this.extractProgrammingLanguages(query)
    };
  }

  /**
   * Analyze content type using keywords and patterns
   */
  analyzeContentType(preprocessed) {
    const scores = {};
    const rules = this.routingRules.contentType;

    for (const [type, rule] of Object.entries(rules)) {
      let score = 0;
      
      // Keyword matching
      const keywordMatches = rule.keywords.filter(keyword => 
        preprocessed.cleaned.includes(keyword)
      ).length;
      score += keywordMatches * 10;
      
      // Pattern matching
      const patternMatches = rule.patterns.filter(pattern => 
        pattern.test(preprocessed.original)
      ).length;
      score += patternMatches * 20;
      
      // Special bonuses
      if (type === 'coding' && preprocessed.hasCodeBlocks) score += 30;
      if (type === 'coding' && preprocessed.programmingLanguages.length > 0) score += 15;
      
      scores[type] = {
        score,
        keywordMatches,
        patternMatches,
        confidence: Math.min(score / 50, 1) // Normalize to 0-1
      };
    }

    // Find best match
    const bestMatch = Object.entries(scores).reduce((best, [type, data]) => 
      data.score > best.score ? { type, ...data } : best
    , { type: 'text', score: 0, confidence: 0 });

    return bestMatch;
  }

  /**
   * Assess query difficulty - simplified to easy/hard only
   */
  assessDifficulty(preprocessed) {
    const hardRules = this.routingRules.difficulty.hard;
    const easyRules = this.routingRules.difficulty.easy;
    let complexityScore = 0;
    let simplicityScore = 0;

    // Hard keyword analysis
    const hardKeywords = hardRules.keywords.filter(keyword => 
      preprocessed.cleaned.includes(keyword)
    ).length;
    complexityScore += hardKeywords * 15;

    // Easy keyword analysis
    const easyKeywords = easyRules.keywords.filter(keyword => 
      preprocessed.cleaned.includes(keyword)
    ).length;
    simplicityScore += easyKeywords * 10;

    // Hard pattern analysis
    const hardPatterns = hardRules.patterns.filter(pattern => 
      pattern.test(preprocessed.original)
    ).length;
    complexityScore += hardPatterns * 20;

    // Easy pattern analysis
    const easyPatterns = easyRules.patterns.filter(pattern => 
      pattern.test(preprocessed.original)
    ).length;
    simplicityScore += easyPatterns * 15;

    // Length analysis
    if (preprocessed.length > hardRules.indicators.length) {
      complexityScore += 10;
    } else if (preprocessed.length < 50) {
      simplicityScore += 5;
    }

    // Technical terms analysis
    if (preprocessed.technicalTerms.length >= hardRules.indicators.technicalTerms) {
      complexityScore += 15;
    }

    // Code complexity
    if (preprocessed.hasCodeBlocks) {
      complexityScore += 10;
    }

    // Determine difficulty based on scores
    const isHard = complexityScore >= 25 && complexityScore > simplicityScore;
    
    return {
      level: isHard ? 'hard' : 'easy',
      score: isHard ? complexityScore : simplicityScore,
      confidence: Math.min((isHard ? complexityScore : simplicityScore) / 50, 1),
      factors: {
        hardKeywords: hardKeywords,
        easyKeywords: easyKeywords,
        hardPatterns: hardPatterns,
        easyPatterns: easyPatterns,
        length: preprocessed.length,
        technicalTerms: preprocessed.technicalTerms.length,
        hasCodeBlocks: preprocessed.hasCodeBlocks,
        complexityScore: complexityScore,
        simplicityScore: simplicityScore
      }
    };
  }

  /**
   * Analyze context for follow-ups and corrections
   */
  analyzeContext(preprocessed, context) {
    const contextRules = this.routingRules.context;
    const sessionContext = this.contextCache.get(context.sessionId) || {};

    const isFollowUp = contextRules.followUp.patterns.some(pattern => 
      pattern.test(preprocessed.original)
    );

    const isCorrection = contextRules.correction.patterns.some(pattern => 
      pattern.test(preprocessed.original)
    );

    return {
      isFollowUp,
      isCorrection,
      hasHistory: !!sessionContext.lastQuery,
      lastType: sessionContext.lastRouting?.type,
      timeSinceLastQuery: sessionContext.timestamp ? 
        Date.now() - sessionContext.timestamp : null
    };
  }

  /**
   * Calculate routing scores for all models
   */
  calculateRoutingScores(analysis) {
    const models = this.mockAi.getAvailableModels();
    const scores = {};

    for (const model of models) {
      let score = 0;
      
      // Content type matching
      const contentRules = this.routingRules.contentType[analysis.content.type];
      if (contentRules && contentRules.models.includes(model.id)) {
        score += 50;
        // Bonus for specialty match
        if (model.specialty === analysis.content.type || 
            (analysis.content.type === 'coding' && model.specialty === 'coding')) {
          score += 30;
        }
      }
      
      // Difficulty matching
      if (analysis.difficulty.level === 'hard') {
        if (['gpt-4', 'claude-3-sonnet'].includes(model.id)) {
          score += 25;
        }
      } else {
        if (['gpt-3.5-turbo', 'codellama-34b'].includes(model.id)) {
          score += 15;
        }
      }
      
      // Context considerations
      if (analysis.context.isFollowUp && analysis.context.lastType) {
        // Prefer same model for follow-ups
        score += 10;
      }
      
      scores[model.id] = {
        score,
        model: model,
        suitability: Math.min(score / 100, 1)
      };
    }

    return scores;
  }

  /**
   * Make final routing decision
   */
  makeRoutingDecision(routingScores) {
    // Sort models by score
    const sortedModels = Object.entries(routingScores)
      .sort(([,a], [,b]) => b.score - a.score);

    const primaryModel = sortedModels[0];
    const fallbackModel = sortedModels[1] || sortedModels[0];

    return {
      type: this.determineResponseType(routingScores),
      difficulty: this.determineDifficulty(routingScores),
      primaryModel: primaryModel[0],
      fallbackModel: fallbackModel[0],
      confidence: primaryModel[1].suitability,
      reasoning: this.generateReasoning(primaryModel, routingScores),
      metadata: {
        allScores: routingScores,
        timestamp: Date.now(),
        version: '2.0'
      }
    };
  }

  /**
   * Select appropriate model based on classification
   */
  selectModelForClassification(classification) {
    const { type, difficulty } = classification;
    
    // Get models for the classified type
    const typeRules = this.routingRules.contentType[type];
    if (!typeRules || !typeRules.models) {
      return 'gemini-2.5-flash-lite'; // Default fallback (Gemini 2.5)
    }
    
    // For hard difficulty, prefer more capable models
    if (difficulty === 'hard') {
      const advancedModels = typeRules.models.filter(model => model.includes('flash'));
      return advancedModels.length > 0 ? 'gemini-flash-latest' : typeRules.models[0];
    }
    
    // For easy difficulty, prefer faster/cheaper models
    const basicModels = typeRules.models.filter(model => model.includes('2.5-flash-lite'));
    return basicModels.length > 0 ? 'gemini-2.5-flash-lite' : typeRules.models[0];
  }

  /**
   * Extract technical terms from query
   */
  extractTechnicalTerms(query) {
    const matches = query.match(this.patterns.technicalTerms) || [];
    return [...new Set(matches.map(term => term.toLowerCase()))];
  }

  /**
   * Extract programming languages from query
   */
  extractProgrammingLanguages(query) {
    const matches = query.match(this.patterns.programmingLanguages) || [];
    return [...new Set(matches.map(lang => lang.toLowerCase()))];
  }

  /**
   * Simple tokenization
   */
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Update context cache
   */
  updateContextCache(sessionId, data) {
    if (sessionId) {
      this.contextCache.set(sessionId, {
        ...this.contextCache.get(sessionId),
        ...data
      });
    }
  }

  /**
   * Determine response type from scores
   */
  determineResponseType(scores) {
    // Logic to determine type based on highest scoring models
    const topModel = Object.values(scores).reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    if (topModel.model.specialty === 'coding') return 'coding';
    // No external image generator; keep as text
    return 'text';
  }

  /**
   * Determine difficulty from scores - simplified to easy/hard only
   */
  determineDifficulty(scores) {
    const hardModels = ['gemini-1.0-pro'];
    const topModel = Object.entries(scores).reduce(([bestId, bestData], [id, data]) => 
      data.score > bestData.score ? [id, data] : [bestId, bestData]
    );
    
    return hardModels.includes(topModel[0]) ? 'hard' : 'easy';
  }

  /**
   * Generate reasoning for routing decision
   */
  generateReasoning(primaryModel, scores) {
    const [modelId, modelData] = primaryModel;
    return {
      primary: `Selected ${modelId} (score: ${modelData.score}) for ${modelData.model.specialty} specialty`,
      factors: [
        `Content type match: ${modelData.model.specialty}`,
        `Suitability: ${(modelData.suitability * 100).toFixed(1)}%`,
        `Model capabilities: ${modelData.model.name}`
      ]
    };
  }

  /**
   * Get default routing for fallback
   */
  getDefaultRouting() {
    return {
      type: 'text',
      difficulty: 'easy', // Always default to easy
      primaryModel: 'gemini-2.5-flash-lite',
      fallbackModel: 'gemini-flash-latest',
      confidence: 0.5,
      reasoning: {
        primary: 'Default routing due to analysis error',
        factors: ['Fallback to safe easy/free-friendly model (Gemini)']
      },
      metadata: {
        isDefault: true,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Get hybrid classification performance metrics
   */
  getHybridPerformanceStats() {
    return this.hybridClassifier.getPerformanceStats();
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    return {
      cacheSize: this.contextCache.size,
      availableModels: this.mockAi.getAvailableModels().length,
      routingRules: Object.keys(this.routingRules).length
    };
  }

  /**
   * Clear context cache
   */
  clearContextCache() {
    this.contextCache.clear();
    logger.info('Context cache cleared');
  }

  /**
   * Health check for router service
   */
  healthCheck() {
    return {
      status: 'healthy',
      contextCacheSize: this.contextCache.size,
      routingRules: Object.keys(this.routingRules).length,
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }
}

module.exports = EnhancedRouterService;