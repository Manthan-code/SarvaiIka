/**
 * Mock Streaming Service - Simulates realistic AI streaming without API costs
 * Provides token-wise streaming with progressive rendering and animations
 */

const MockAiService = require('./mockAiService');
const EnhancedRouterService = require('./enhancedRouterService');
const logger = require('../config/logger');
const { EventEmitter } = require('events');

class MockStreamingService extends EventEmitter {
  constructor() {
    super();
    this.mockAi = new MockAiService();
    this.router = new EnhancedRouterService();
    this.activeStreams = new Map();
    this.streamingConfig = this.initializeStreamingConfig();
    this.models = this.initializeModels();
    this.responsePatterns = this.initializeResponsePatterns();
  }

  /**
   * Initialize available models
   */
  initializeModels() {
    return {
      'gpt-4': {
        name: 'GPT-4',
        maxTokens: 8192,
        streaming: true,
        capabilities: ['text', 'coding', 'analysis']
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        maxTokens: 4096,
        streaming: true,
        capabilities: ['text', 'coding']
      },
      'claude-3': {
        name: 'Claude 3',
        maxTokens: 100000,
        streaming: true,
        capabilities: ['text', 'coding', 'analysis', 'reasoning']
      }
    };
  }

  /**
   * Initialize response patterns
   */
  initializeResponsePatterns() {
    return {
      greeting: /^(hi|hello|hey|good morning|good afternoon)/i,
      question: /\?$/,
      coding: /(code|function|class|method|algorithm|programming)/i,
      analysis: /(analyze|explain|compare|evaluate|assess)/i,
      creative: /(write|create|generate|compose|design)/i
    };
  }

  /**
   * Initialize streaming configuration
   */
  initializeStreamingConfig() {
    const envMin = parseInt(process.env.MOCK_TOKEN_DELAY_MIN || '', 10);
    const envMax = parseInt(process.env.MOCK_TOKEN_DELAY_MAX || '', 10);
    const envVar = parseInt(process.env.MOCK_TOKEN_DELAY_VARIANCE || '', 10);
    const min = Number.isFinite(envMin) ? envMin : 5;
    const max = Number.isFinite(envMax) ? envMax : 25;
    const variance = Number.isFinite(envVar) ? envVar : 10;
    return {
      // Streaming behavior settings
      tokenDelay: {
        min,
        max,
        variance
      },
      
      // Chunk sizes for different content types
      chunkSizes: {
        text: { min: 1, max: 3 },
        coding: { min: 1, max: 2 },
        image: { min: 5, max: 10 },
        video: { min: 3, max: 7 }
      },
      
      // Progressive rendering settings
      progressiveRendering: {
        enabled: true,
        updateInterval: 30, // ms
        minChunkSize: 10 // characters
      },
      
      // Animation settings
      animations: {
        typewriter: {
          enabled: true,
          speed: 50 // ms per character
        },
        fadeIn: {
          enabled: true,
          duration: 300 // ms
        },
        pulse: {
          enabled: true,
          interval: 1000 // ms
        }
      },
      
      // Error simulation
      errorSimulation: {
        enabled: false,
        probability: 0.05, // 5% chance
        types: ['network', 'timeout', 'rate_limit', 'model_error']
      }
    };
  }

  /**
   * Start streaming response
   * @param {string} query - User input
   * @param {Object} options - Streaming options
   * @param {Object} res - Express response object
   * @returns {Promise} Stream completion promise
   */
  async startStream(query, options = {}, res) {
    const streamId = this.generateStreamId();
    
    try {
      // Ensure query is a string
      const queryStr = typeof query === 'string' ? query : String(query || '');
      logger.info('Starting mock stream', { streamId, query: queryStr.substring(0, 100) });
      
      // Check for empty or invalid query
      if (!queryStr.trim() || queryStr === '[object Object]') {
        this.setupSSEHeaders(res);
        res.write('error: Invalid or empty query provided\n');
        if (res && res.end) {
          res.end();
        }
        return;
      }
      
      // Set up SSE headers
      this.setupSSEHeaders(res);
      
      // Route the query
      const routing = await this.router.routeQuery(queryStr, options.context || {});
      
      // Create stream context
      const streamContext = {
        id: streamId,
        query: queryStr,
        routing,
        options,
        startTime: Date.now(),
        status: 'active',
        metadata: {
          totalTokens: 0,
          estimatedDuration: 0,
          progress: 0
        }
      };
      
      this.activeStreams.set(streamId, streamContext);
      
      // Send initial stream event
      this.sendStreamEvent(res, 'stream_start', {
        streamId,
        routing: {
          type: routing.type,
          difficulty: routing.difficulty,
          model: routing.primaryModel,
          confidence: routing.confidence
        },
        metadata: {
          timestamp: Date.now(),
          estimatedTokens: await this.estimateResponseLength(queryStr, routing)
        }
      });
      
      // Start the actual streaming
      await this.processStream(streamContext, res);
      
      // Clean up
      this.activeStreams.delete(streamId);
      
      logger.info('Stream completed', { streamId, duration: Date.now() - streamContext.startTime });
      
    } catch (error) {
      logger.error('Stream error', { streamId, error: error.message });
      this.sendStreamEvent(res, 'error', {
        streamId,
        error: {
          type: 'stream_error',
          message: error.message,
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Process the streaming response
   */
  async processStream(streamContext, res) {
    const { query, routing, options } = streamContext;
    
    try {
      // Simulate error if enabled
      if (this.shouldSimulateError()) {
        throw new Error(this.generateSimulatedError());
      }
      
      // Get the response generator
      const responseGenerator = this.mockAi.generateResponse(
        query, 
        routing.primaryModel, 
        options
      );
      
      let accumulatedResponse = '';
      let tokenCount = 0;
      let lastProgressUpdate = Date.now();
      
      // Process each token
      for await (const tokenData of responseGenerator) {
        // Update stream context
        streamContext.metadata.totalTokens = tokenData.total;
        streamContext.metadata.progress = (tokenData.index / tokenData.total) * 100;
        
        if (tokenData.completed) {
          // Send completion event
          this.sendStreamEvent(res, 'stream_complete', {
            streamId: streamContext.id,
            finalResponse: accumulatedResponse,
            metadata: {
              totalTokens: tokenData.metadata.totalTokens,
              totalCost: tokenData.metadata.totalCost,
              duration: tokenData.metadata.duration,
              model: tokenData.model,
              type: tokenData.type,
              difficulty: tokenData.difficulty
            },
            timestamp: Date.now()
          });
          break;
        }
        
        // Accumulate response
        accumulatedResponse += tokenData.token + ' ';
        tokenCount++;
        
        // Send token event
        this.sendStreamEvent(res, 'token', {
          streamId: streamContext.id,
          token: tokenData.token,
          index: tokenData.index,
          total: tokenData.total,
          progress: streamContext.metadata.progress,
          metadata: tokenData.metadata
        });
        
        // Send progressive update if needed
        const now = Date.now();
        if (now - lastProgressUpdate > this.streamingConfig.progressiveRendering.updateInterval) {
          this.sendStreamEvent(res, 'progress_update', {
            streamId: streamContext.id,
            partialResponse: accumulatedResponse,
            progress: streamContext.metadata.progress,
            tokensProcessed: tokenCount,
            estimatedTimeRemaining: this.estimateTimeRemaining(tokenData, streamContext.startTime)
          });
          lastProgressUpdate = now;
        }
        
        // Add realistic delay with variance
        await this.addStreamingDelay(routing.type);
      }
      
      // End the response stream
      if (res && res.end) {
        res.end();
      }
      
    } catch (error) {
      // Handle streaming errors
      this.sendStreamEvent(res, 'stream_error', {
        streamId: streamContext.id,
        error: {
          type: error.name || 'StreamingError',
          message: error.message,
          timestamp: Date.now()
        }
      });
      
      // End the response stream even on error
      if (res && res.end) {
        res.end();
      }
      
      throw error;
    }
  }

  /**
   * Send Server-Sent Event
   */
  sendStreamEvent(res, eventType, data) {
    try {
      const eventData = {
        type: eventType,
        data,
        timestamp: Date.now()
      };
      
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      
      // Emit internal event for monitoring
      this.emit('stream_event', eventType, data);
      
    } catch (error) {
      logger.error('Error sending stream event', { eventType, error: error.message });
    }
  }

  /**
   * Setup Server-Sent Events headers
   */
  setupSSEHeaders(res) {
    if (res.headersSent) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization, Accept, Origin',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });
  }

  /**
   * Add realistic streaming delay
   */
  async addStreamingDelay(contentType) {
    const config = this.streamingConfig.tokenDelay;
    const baseDelay = config.min + Math.random() * (config.max - config.min);
    const variance = (Math.random() - 0.5) * config.variance;
    const delay = Math.max(1, baseDelay + variance);
    
    // Adjust delay based on content type
    const typeMultipliers = {
      text: 1.0,
      coding: 1.2, // Slightly slower for code
      image: 2.0,  // Much slower for image descriptions
      video: 1.5   // Moderately slower for video
    };
    
    const finalDelay = delay * (typeMultipliers[contentType] || 1.0);
    
    return new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Estimate response length
   */
  async estimateResponseLength(query, routing) {
    const baseLength = query.length * 2; // Response typically 2x input
    
    const multipliers = {
      text: { normal: 2, hard: 4 },
      coding: { normal: 3, hard: 6 },
      image: { normal: 1.5, hard: 2 },
      video: { normal: 2.5, hard: 4 }
    };
    
    const multiplier = multipliers[routing.type]?.[routing.difficulty] || 2;
    return Math.ceil(baseLength * multiplier / 4); // Convert to approximate tokens
  }

  /**
   * Estimate time remaining
   */
  estimateTimeRemaining(tokenData, startTime) {
    const elapsed = Date.now() - startTime;
    const tokensProcessed = tokenData.index + 1;
    const totalTokens = tokenData.total;
    const remainingTokens = totalTokens - tokensProcessed;
    
    if (tokensProcessed === 0) return 0;
    
    const avgTimePerToken = elapsed / tokensProcessed;
    return Math.ceil(remainingTokens * avgTimePerToken);
  }

  /**
   * Generate unique stream ID
   */
  generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if should simulate error
   */
  shouldSimulateError() {
    const config = this.streamingConfig.errorSimulation;
    return config.enabled && Math.random() < config.probability;
  }

  /**
   * Generate simulated error
   */
  generateSimulatedError() {
    const config = this.streamingConfig.errorSimulation;
    const errorType = config.types[Math.floor(Math.random() * config.types.length)];
    
    const errorMessages = {
      network: 'Network connection interrupted',
      timeout: 'Request timeout - please try again',
      rate_limit: 'Rate limit exceeded - please wait before retrying',
      model_error: 'Model temporarily unavailable'
    };
    
    return errorMessages[errorType] || 'Unknown streaming error';
  }

  /**
   * Get active streams info
   */
  getActiveStreams() {
    return Array.from(this.activeStreams.values()).map(stream => ({
      id: stream.id,
      query: stream.query.substring(0, 50) + '...',
      status: stream.status,
      startTime: stream.startTime,
      duration: Date.now() - stream.startTime,
      progress: stream.metadata.progress,
      model: stream.routing.primaryModel
    }));
  }

  /**
   * Stop specific stream
   */
  stopStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.status = 'stopped';
      this.activeStreams.delete(streamId);
      logger.info('Stream stopped', { streamId });
      return true;
    }
    return false;
  }

  /**
   * Stop all active streams
   */
  stopAllStreams() {
    const streamIds = Array.from(this.activeStreams.keys());
    streamIds.forEach(id => this.stopStream(id));
    logger.info('All streams stopped', { count: streamIds.length });
    return streamIds.length;
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats() {
    return {
      activeStreams: this.activeStreams.size,
      totalEventsEmitted: this.listenerCount('stream_event'),
      config: {
        errorSimulationEnabled: this.streamingConfig.errorSimulation.enabled,
        progressiveRenderingEnabled: this.streamingConfig.progressiveRendering.enabled,
        animationsEnabled: Object.values(this.streamingConfig.animations)
          .some(anim => anim.enabled)
      }
    };
  }

  /**
   * Update streaming configuration
   */
  updateConfig(newConfig) {
    this.streamingConfig = {
      ...this.streamingConfig,
      ...newConfig
    };
    logger.info('Streaming config updated', { newConfig });
  }

  /**
   * Enable/disable error simulation
   */
  setErrorSimulation(enabled, probability = 0.05) {
    this.streamingConfig.errorSimulation.enabled = enabled;
    this.streamingConfig.errorSimulation.probability = probability;
    logger.info('Error simulation updated', { enabled, probability });
  }

  /**
   * Create streaming middleware for Express
   */
  createStreamingMiddleware() {
    return async (req, res, next) => {
      try {
        const { query, context, options } = req.body;
        
        if (!query) {
          return res.status(400).json({ error: 'Query is required' });
        }
        
        // Start streaming
        await this.startStream(query, { context, ...options }, res);
        
      } catch (error) {
        logger.error('Streaming middleware error', { error: error.message });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Streaming failed' });
        }
      }
    };
  }

  /**
   * Health check for streaming service
   */
  healthCheck() {
    return {
      status: 'healthy',
      activeStreams: this.activeStreams.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };
  }
}

module.exports = MockStreamingService;