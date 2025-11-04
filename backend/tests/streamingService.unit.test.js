/**
 * Streaming Service Unit Tests
 * Comprehensive tests for all streaming operations and edge cases
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const StreamingService = require('../src/services/streamingService');
const EventEmitter = require('events');

// Mock dependencies
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../src/services/mockAiService');
jest.mock('../src/services/cacheService');

describe('StreamingService Unit Tests', () => {
  let streamingService;
  let mockAiService;
  let mockCacheService;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock AI service
    mockAiService = {
      generateStreamingResponse: jest.fn(),
      generateResponse: jest.fn()
    };
    
    // Setup mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    
    // Setup mock response object
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      destroyed: false
    };
    
    streamingService = new StreamingService(mockAiService, mockCacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct dependencies', () => {
      expect(streamingService.aiService).toBe(mockAiService);
      expect(streamingService.cacheService).toBe(mockCacheService);
      expect(streamingService.activeStreams).toBeInstanceOf(Map);
      expect(streamingService.streamMetrics).toBeInstanceOf(Map);
    });

    it('should initialize with default configuration', () => {
      expect(streamingService.config).toBeDefined();
      expect(streamingService.config.maxConcurrentStreams).toBeGreaterThan(0);
      expect(streamingService.config.streamTimeout).toBeGreaterThan(0);
      expect(streamingService.config.chunkSize).toBeGreaterThan(0);
    });
  });

  describe('startStream', () => {
    const mockStreamData = {
      sessionId: 'test-session',
      query: 'Test query',
      model: 'gpt-3.5-turbo',
      userId: 'test-user'
    };

    it('should start a new stream successfully', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream(mockStreamData, mockResponse);
      
      expect(result.success).toBe(true);
      expect(result.streamId).toBeDefined();
      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
    });

    it('should reject when max concurrent streams reached', async () => {
      // Fill up to max concurrent streams
      const maxStreams = streamingService.config.maxConcurrentStreams;
      for (let i = 0; i < maxStreams; i++) {
        streamingService.activeStreams.set(`stream-${i}`, {
          sessionId: `session-${i}`,
          startTime: Date.now()
        });
      }
      
      const result = await streamingService.startStream(mockStreamData, mockResponse);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum concurrent streams');
    });

    it('should handle AI service errors gracefully', async () => {
      mockAiService.generateStreamingResponse.mockRejectedValue(new Error('AI service error'));
      
      const result = await streamingService.startStream(mockStreamData, mockResponse);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('AI service error');
    });

    it('should setup stream event handlers correctly', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      await streamingService.startStream(mockStreamData, mockResponse);
      
      // Verify event handlers are set up
      expect(mockStream.listenerCount('data')).toBeGreaterThan(0);
      expect(mockStream.listenerCount('end')).toBeGreaterThan(0);
      expect(mockStream.listenerCount('error')).toBeGreaterThan(0);
    });

    it('should handle response object errors', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      mockResponse.writeHead.mockImplementation(() => {
        throw new Error('Response error');
      });
      
      const result = await streamingService.startStream(mockStreamData, mockResponse);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Response error');
    });
  });

  describe('Stream Event Handling', () => {
    let mockStream;
    let streamId;

    beforeEach(async () => {
      mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query',
        model: 'gpt-3.5-turbo'
      }, mockResponse);
      
      streamId = result.streamId;
    });

    it('should handle data events correctly', () => {
      const testData = { content: 'Hello world', type: 'text' };
      
      mockStream.emit('data', testData);
      
      expect(mockResponse.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(testData)}\n\n`
      );
    });

    it('should handle end events correctly', () => {
      mockStream.emit('end');
      
      expect(mockResponse.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockResponse.end).toHaveBeenCalled();
      expect(streamingService.activeStreams.has(streamId)).toBe(false);
    });

    it('should handle error events correctly', () => {
      const testError = new Error('Stream error');
      
      mockStream.emit('error', testError);
      
      expect(mockResponse.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`
      );
      expect(mockResponse.end).toHaveBeenCalled();
      expect(streamingService.activeStreams.has(streamId)).toBe(false);
    });

    it('should handle response close events', () => {
      const closeHandler = mockResponse.on.mock.calls.find(call => call[0] === 'close')[1];
      
      closeHandler();
      
      expect(streamingService.activeStreams.has(streamId)).toBe(false);
    });

    it('should not write to destroyed response', () => {
      mockResponse.destroyed = true;
      const testData = { content: 'Hello world' };
      
      mockStream.emit('data', testData);
      
      expect(mockResponse.write).not.toHaveBeenCalled();
    });
  });

  describe('stopStream', () => {
    let streamId;

    beforeEach(async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, mockResponse);
      
      streamId = result.streamId;
    });

    it('should stop an active stream', () => {
      const result = streamingService.stopStream(streamId);
      
      expect(result.success).toBe(true);
      expect(streamingService.activeStreams.has(streamId)).toBe(false);
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should handle non-existent stream IDs', () => {
      const result = streamingService.stopStream('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stream not found');
    });

    it('should handle already stopped streams', () => {
      streamingService.stopStream(streamId);
      const result = streamingService.stopStream(streamId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stream not found');
    });
  });

  describe('getStreamStatus', () => {
    let streamId;

    beforeEach(async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, mockResponse);
      
      streamId = result.streamId;
    });

    it('should return status for active stream', () => {
      const status = streamingService.getStreamStatus(streamId);
      
      expect(status.exists).toBe(true);
      expect(status.sessionId).toBe('test-session');
      expect(status.startTime).toBeDefined();
      expect(status.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return not found for non-existent stream', () => {
      const status = streamingService.getStreamStatus('non-existent-id');
      
      expect(status.exists).toBe(false);
    });

    it('should calculate duration correctly', () => {
      const status1 = streamingService.getStreamStatus(streamId);
      
      // Wait a bit
      setTimeout(() => {
        const status2 = streamingService.getStreamStatus(streamId);
        expect(status2.duration).toBeGreaterThan(status1.duration);
      }, 10);
    });
  });

  describe('getActiveStreams', () => {
    it('should return empty array when no active streams', () => {
      const activeStreams = streamingService.getActiveStreams();
      
      expect(activeStreams).toEqual([]);
    });

    it('should return list of active streams', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      await streamingService.startStream({
        sessionId: 'session-1',
        query: 'Query 1'
      }, mockResponse);
      
      await streamingService.startStream({
        sessionId: 'session-2',
        query: 'Query 2'
      }, { ...mockResponse });
      
      const activeStreams = streamingService.getActiveStreams();
      
      expect(activeStreams).toHaveLength(2);
      expect(activeStreams[0]).toHaveProperty('streamId');
      expect(activeStreams[0]).toHaveProperty('sessionId');
      expect(activeStreams[0]).toHaveProperty('startTime');
    });

    it('should filter streams by session ID', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      await streamingService.startStream({
        sessionId: 'session-1',
        query: 'Query 1'
      }, mockResponse);
      
      await streamingService.startStream({
        sessionId: 'session-2',
        query: 'Query 2'
      }, { ...mockResponse });
      
      const filteredStreams = streamingService.getActiveStreams('session-1');
      
      expect(filteredStreams).toHaveLength(1);
      expect(filteredStreams[0].sessionId).toBe('session-1');
    });
  });

  describe('Stream Metrics', () => {
    let streamId;

    beforeEach(async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, mockResponse);
      
      streamId = result.streamId;
    });

    it('should track stream metrics', () => {
      const metrics = streamingService.streamMetrics.get(streamId);
      
      expect(metrics).toBeDefined();
      expect(metrics.bytesTransferred).toBe(0);
      expect(metrics.chunksTransferred).toBe(0);
      expect(metrics.startTime).toBeDefined();
    });

    it('should update metrics on data transfer', () => {
      const mockStream = streamingService.activeStreams.get(streamId).stream;
      const testData = { content: 'Hello world' };
      
      mockStream.emit('data', testData);
      
      const metrics = streamingService.streamMetrics.get(streamId);
      expect(metrics.chunksTransferred).toBe(1);
      expect(metrics.bytesTransferred).toBeGreaterThan(0);
    });

    it('should clean up metrics when stream ends', () => {
      const mockStream = streamingService.activeStreams.get(streamId).stream;
      
      mockStream.emit('end');
      
      expect(streamingService.streamMetrics.has(streamId)).toBe(false);
    });
  });

  describe('Stream Timeout Handling', () => {
    it('should timeout inactive streams', (done) => {
      // Set a very short timeout for testing
      streamingService.config.streamTimeout = 50;
      
      streamingService.startStream({
        sessionId: 'timeout-session',
        query: 'Test query'
      }, mockResponse).then((result) => {
        const streamId = result.streamId;
        
        // Check that stream is cleaned up after timeout
        setTimeout(() => {
          expect(streamingService.activeStreams.has(streamId)).toBe(false);
          done();
        }, 100);
      });
    });

    it('should not timeout active streams', (done) => {
      streamingService.config.streamTimeout = 100;
      
      streamingService.startStream({
        sessionId: 'active-session',
        query: 'Test query'
      }, mockResponse).then((result) => {
        const streamId = result.streamId;
        const mockStream = streamingService.activeStreams.get(streamId).stream;
        
        // Keep stream active by emitting data
        const interval = setInterval(() => {
          mockStream.emit('data', { content: 'keep alive' });
        }, 25);
        
        setTimeout(() => {
          clearInterval(interval);
          expect(streamingService.activeStreams.has(streamId)).toBe(true);
          done();
        }, 150);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed stream data', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, mockResponse);
      
      // Emit malformed data
      const circularObj = {};
      circularObj.self = circularObj;
      
      expect(() => {
        mockStream.emit('data', circularObj);
      }).not.toThrow();
    });

    it('should handle missing required parameters', async () => {
      const result = await streamingService.startStream({}, mockResponse);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should handle null response object', async () => {
      const result = await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, null);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response object');
    });

    it('should handle very large data chunks', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, mockResponse);
      
      const largeData = { content: 'x'.repeat(100000) }; // 100KB
      
      expect(() => {
        mockStream.emit('data', largeData);
      }).not.toThrow();
    });

    it('should handle rapid successive data events', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      await streamingService.startStream({
        sessionId: 'test-session',
        query: 'Test query'
      }, mockResponse);
      
      // Emit many data events rapidly
      for (let i = 0; i < 1000; i++) {
        mockStream.emit('data', { content: `chunk ${i}` });
      }
      
      expect(mockResponse.write).toHaveBeenCalledTimes(1000);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent streams efficiently', async () => {
      const promises = [];
      const numStreams = 10;
      
      for (let i = 0; i < numStreams; i++) {
        const mockStream = new EventEmitter();
        mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
        
        promises.push(streamingService.startStream({
          sessionId: `session-${i}`,
          query: `Query ${i}`
        }, { ...mockResponse }));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(numStreams);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      expect(streamingService.activeStreams.size).toBe(numStreams);
    });

    it('should complete stream operations within reasonable time', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const startTime = Date.now();
      await streamingService.startStream({
        sessionId: 'performance-session',
        query: 'Performance test query'
      }, mockResponse);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources when streams end', async () => {
      const mockStream = new EventEmitter();
      mockAiService.generateStreamingResponse.mockResolvedValue(mockStream);
      
      const result = await streamingService.startStream({
        sessionId: 'cleanup-session',
        query: 'Cleanup test'
      }, mockResponse);
      
      const streamId = result.streamId;
      
      // Verify resources are allocated
      expect(streamingService.activeStreams.has(streamId)).toBe(true);
      expect(streamingService.streamMetrics.has(streamId)).toBe(true);
      
      // End the stream
      mockStream.emit('end');
      
      // Verify resources are cleaned up
      expect(streamingService.activeStreams.has(streamId)).toBe(false);
      expect(streamingService.streamMetrics.has(streamId)).toBe(false);
    });

    it('should prevent memory leaks from abandoned streams', () => {
      const initialMemory = process.memoryUsage();
      
      // Create and abandon many streams
      for (let i = 0; i < 100; i++) {
        streamingService.activeStreams.set(`abandoned-${i}`, {
          sessionId: `session-${i}`,
          startTime: Date.now() - 1000000 // Old timestamp
        });
      }
      
      // Trigger cleanup (this would normally be done by a cleanup interval)
      streamingService.cleanupAbandonedStreams();
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not have increased significantly
      expect(finalMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(1000000); // Less than 1MB
    });
  });
});