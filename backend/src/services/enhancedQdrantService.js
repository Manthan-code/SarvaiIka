/**
 * Enhanced Qdrant Service - Intelligent semantic search and context retrieval
 * Integrates with mock AI services for development without API costs
 */

const qdrantClient = require('../db/qdrant/client');
const logger = require('../config/logger');
const crypto = require('crypto');

class EnhancedQdrantService {
  constructor() {
    this.collections = {
      userEmbeddings: 'user_embeddings',
      queryContext: 'query_context',
      responsePatterns: 'response_patterns',
      semanticCache: 'semantic_cache'
    };
    
    this.vectorConfig = {
      size: 1536, // OpenAI embedding size
      distance: 'Cosine',
      mockVectorSize: 384 // Smaller size for mock embeddings
    };
    
    this.useMockEmbeddings = process.env.USE_MOCK_AI === 'true' || process.env.NODE_ENV === 'development';
    this.initialized = false;
  }

  /**
   * Initialize all collections
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create collections if they don't exist
      for (const [name, collection] of Object.entries(this.collections)) {
        await qdrantClient.createCollection(collection, {
          vectors: {
            size: this.useMockEmbeddings ? this.vectorConfig.mockVectorSize : this.vectorConfig.size,
            distance: this.vectorConfig.distance
          }
        });
      }
      
      this.initialized = true;
      logger.info('EnhancedQdrantService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EnhancedQdrantService', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate mock embedding vector
   * @param {string} text - Text to generate embedding for
   * @returns {number[]} Mock embedding vector
   */
  generateMockEmbedding(text) {
    const size = this.useMockEmbeddings ? this.vectorConfig.mockVectorSize : this.vectorConfig.size;
    const vector = new Array(size);
    
    // Create deterministic but varied embeddings based on text content
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const seed = parseInt(hash.substring(0, 8), 16);
    
    for (let i = 0; i < size; i++) {
      // Use text features to influence vector values
      const textFeature = this.extractTextFeature(text, i);
      const randomComponent = Math.sin(seed + i) * 0.5;
      vector[i] = (textFeature + randomComponent) / Math.sqrt(size);
    }
    
    return vector;
  }

  /**
   * Extract text features for embedding generation
   * @param {string} text - Input text
   * @param {number} dimension - Vector dimension
   * @returns {number} Feature value
   */
  extractTextFeature(text, dimension) {
    const features = {
      length: text.length / 1000,
      wordCount: text.split(' ').length / 100,
      uniqueChars: new Set(text.toLowerCase()).size / 26,
      vowelRatio: (text.match(/[aeiou]/gi) || []).length / text.length,
      digitRatio: (text.match(/\d/g) || []).length / text.length,
      punctuationRatio: (text.match(/[.,!?;:]/g) || []).length / text.length
    };
    
    const featureKeys = Object.keys(features);
    const featureIndex = dimension % featureKeys.length;
    return features[featureKeys[featureIndex]] || 0;
  }

  /**
   * Search semantic cache
   * @param {string} query - Query text
   * @param {Object} options - Search options
   * @returns {Object|null} Cached response or null
   */
  async searchSemanticCache(query, options = {}) {
    try {
      await this.initialize();
      
      // Handle case where threshold is passed as second parameter directly
      let threshold = 0.8;
      let topK = 1;
      
      if (typeof options === 'number') {
        threshold = options;
      } else {
        threshold = options.threshold || 0.8;
        topK = options.topK || 1;
      }
      
      // Validate threshold parameter
      if (threshold < 0 || threshold > 1) {
        return null;
      }
      
      const vector = this.generateMockEmbedding(query);
      const currentTime = Date.now();
      
      const searchResult = await qdrantClient.searchVector(this.collections.semanticCache, {
        vector: vector,
        limit: topK,
        score_threshold: threshold,
        with_payload: true
      });
      
      if (!searchResult || searchResult.length === 0) {
        return null;
      }
      
      const result = searchResult[0];
      
      // Check TTL
      if (result.payload.ttl && (currentTime - result.payload.timestamp) > result.payload.ttl) {
        return null;
      }
      
      logger.debug('Semantic cache hit', {
        score: result.score,
        accessCount: result.payload.accessCount + 1
      });
      
      return {
        response: result.payload.response,
        metadata: result.payload.metadata,
        score: result.score,
        cached: true,
        accessCount: result.payload.accessCount + 1
      };
    } catch (error) {
      logger.error('Failed to search semantic cache', { error: error.message });
      return null;
    }
  }

  /**
   * Get user's query history with analytics
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Object} User analytics
   */
  async getUserAnalytics(userId, options = {}) {
    try {
      await this.initialize();
      
      const {
        limit = 100,
        timeRange = 30 * 24 * 60 * 60 * 1000 // 30 days
      } = options;
      
      const currentTime = Date.now();
      const startTime = currentTime - timeRange;
      
      // Search for user's query history
      const searchResult = await qdrantClient.searchVector(this.collections.queryContext, {
        vector: this.generateMockEmbedding('user analytics query'),
        limit: limit,
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: userId }
            },
            {
              key: 'timestamp',
              range: {
                gte: startTime,
                lte: currentTime
              }
            }
          ]
        },
        with_payload: true
      });
      
      const queries = searchResult || [];
      
      // Analyze query patterns
      const analytics = {
        totalQueries: queries.length,
        averageResponseTime: queries.length > 0 ? 150 + Math.random() * 100 : 0, // Mock response time
        timeRange: {
          start: startTime,
          end: currentTime
        },
        queryTypes: {},
        models: {},
        modelUsage: {},
        averageComplexity: 0,
        averageSimilarity: 0,
        mostCommonTopics: [],
        queryFrequency: {
          daily: 0,
          weekly: 0,
          monthly: 0
        }
      };
      
      // Process query statistics
      queries.forEach(query => {
        const payload = query.payload;
        
        // Count query types
        const queryType = payload.queryType || 'unknown';
        analytics.queryTypes[queryType] = (analytics.queryTypes[queryType] || 0) + 1;
        
        // Count models
        const model = payload.model || 'unknown';
        analytics.models[model] = (analytics.models[model] || 0) + 1;
      });
      
      // Calculate frequency
      const dayMs = 24 * 60 * 60 * 1000;
      analytics.queryFrequency.daily = queries.filter(q => 
        (currentTime - q.payload.timestamp) < dayMs
      ).length;
      
      analytics.queryFrequency.weekly = queries.filter(q => 
        (currentTime - q.payload.timestamp) < (7 * dayMs)
      ).length;
      
      analytics.queryFrequency.monthly = queries.length;
      
      logger.debug('Generated user analytics', { userId, totalQueries: analytics.totalQueries });
      return analytics;
    } catch (error) {
      logger.error('Failed to get user analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Store semantic cache entry
   * @param {string} query - Query text
   * @param {string} response - Cached response
   * @param {Object} metadata - Cache metadata
   */
  async storeSemanticCache(query, response, metadata) {
    try {
      await this.initialize();
      
      const vector = this.generateMockEmbedding(query);
      const pointId = `cache_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      const point = {
        id: pointId,
        vector: vector,
        payload: {
          query,
          response,
          metadata,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccess: Date.now(),
          ttl: metadata.ttl || 3600000 // 1 hour default
        }
      };
      
      await qdrantClient.addVector(this.collections.semanticCache, point);
      
      logger.debug('Stored semantic cache entry', { pointId });
      return { success: true, pointId };
    } catch (error) {
      logger.error('Failed to store semantic cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Store query context for future analysis
   */
  async storeQueryContext(userId, query, context) {
    try {
      await this.initialize();
      
      const vector = this.generateMockEmbedding(query);
      const pointId = `context_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      const point = {
        id: pointId,
        vector: vector,
        payload: {
          userId,
          query,
          context,
          timestamp: Date.now(),
          queryType: context.queryType || 'general'
        }
      };
      
      await qdrantClient.addVector(this.collections.queryContext, point);
      
      logger.debug('Stored query context', { pointId, userId });
      return { success: true, pointId };
    } catch (error) {
      logger.error('Failed to store query context', { error: error.message });
      throw error;
    }
  }

  /**
   * Track user query for analytics
   * @param {string} userId - User identifier
   * @param {string} query - Query text
   * @param {Object} metadata - Query metadata (model, queryType, etc.)
   */
  async trackUserQuery(userId, query, metadata = {}) {
    try {
      await this.initialize();
      
      const vector = this.generateMockEmbedding(query);
      const pointId = `query_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      const point = {
        id: pointId,
        vector: vector,
        payload: {
          userId,
          query,
          timestamp: Date.now(),
          queryType: metadata.queryType || 'general',
          model: metadata.model || 'unknown',
          complexity: metadata.complexity || 0,
          confidence: metadata.confidence || 0
        }
      };
      
      await qdrantClient.addVector(this.collections.queryContext, point);
      
      logger.debug('Tracked user query', { pointId, userId, queryType: metadata.queryType });
      return { success: true, pointId };
    } catch (error) {
      logger.error('Failed to track user query', { error: error.message });
      throw error;
    }
  }

  /**
   * Search for similar queries by user
   */
  async searchSimilarQueries(userId, query, limit = 5) {
    try {
      await this.initialize();
      
      const vector = this.generateMockEmbedding(query);
      
      const searchResult = await qdrantClient.searchVector(this.collections.queryContext, {
        vector: vector,
        limit: limit,
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        with_payload: true
      });
      
      return searchResult.map(result => ({
        query: result.payload.query,
        context: result.payload.context,
        similarity: result.score,
        timestamp: result.payload.timestamp
      }));
    } catch (error) {
      logger.error('Failed to search similar queries', { error: error.message });
      return [];
    }
  }

  /**
   * Store response pattern
   */
  async storeResponsePattern(queryType, pattern) {
    try {
      await this.initialize();
      
      const vector = this.generateMockEmbedding(pattern.template || pattern.response || '');
      const pointId = `pattern_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      const point = {
        id: pointId,
        vector: vector,
        payload: {
          queryType,
          pattern,
          timestamp: Date.now()
        }
      };
      
      await qdrantClient.addVector(this.collections.responsePatterns, point);
      
      logger.debug('Stored response pattern', { pointId, queryType });
      return { success: true, pointId };
    } catch (error) {
      logger.error('Failed to store response pattern', { error: error.message });
      throw error;
    }
  }

  /**
   * Find response patterns by query type
   */
  async findResponsePatterns(queryType, limit = 5) {
    try {
      await this.initialize();
      
      const searchResult = await qdrantClient.searchVector(this.collections.responsePatterns, {
        vector: this.generateMockEmbedding(queryType),
        limit: limit,
        filter: {
          must: [
            { key: 'queryType', match: { value: queryType } }
          ]
        },
        with_payload: true
      });
      
      return searchResult.map(result => ({
        pattern: result.payload.pattern,
        queryType: result.payload.queryType,
        score: result.score,
        timestamp: result.payload.timestamp
      }));
    } catch (error) {
      logger.error('Failed to find response patterns', { error: error.message });
      return [];
    }
  }

  /**
   * Initialize all collections
   */
  async initializeCollections() {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      logger.error('Failed to initialize collections', { error: error.message });
      return false;
    }
  }

  async healthCheck() {
    try {
      const collections = await qdrantClient.getCollections();
      return {
        status: 'healthy',
        collections: collections.collections || [],
        totalVectors: 0, // Mock value for testing
        memoryUsage: '0MB', // Mock value for testing
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Qdrant health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        totalVectors: 0,
        memoryUsage: '0MB',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = EnhancedQdrantService;