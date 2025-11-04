/**
 * Optimized Streaming Service
 * Features: Connection pooling, intelligent buffering, performance monitoring, and error recovery
 */

interface StreamingConfig {
  maxRetries: number;
  retryDelay: number;
  bufferSize: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

interface StreamingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  averageThroughput: number;
  connectionErrors: number;
  retryAttempts: number;
  lastUpdated: Date;
}

interface ConnectionPool {
  activeConnections: Set<string>;
  maxConnections: number;
  connectionQueue: Array<() => void>;
}

interface BufferedChunk {
  id: string;
  data: string;
  timestamp: number;
  size: number;
}

interface StreamingEvent {
  type: 'routing' | 'model_selected' | 'token' | 'image' | 'error' | 'metadata' | 'heartbeat';
  data?: string | object | null;
  timestamp: number;
}

class OptimizedStreamingService {
  private config: StreamingConfig;
  private metrics: StreamingMetrics;
  private connectionPool: ConnectionPool;
  private buffer: Map<string, BufferedChunk[]>;
  private activeStreams: Map<string, AbortController>;
  private heartbeatIntervals: Map<string, NodeJS.Timeout>;
  private performanceObserver?: PerformanceObserver;
  
  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      bufferSize: 1024 * 8, // 8KB buffer
      connectionTimeout: 30000, // 30 seconds
      heartbeatInterval: 10000, // 10 seconds
      enableCompression: true,
      enableMetrics: true,
      ...config
    };
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      averageThroughput: 0,
      connectionErrors: 0,
      retryAttempts: 0,
      lastUpdated: new Date()
    };
    
    this.connectionPool = {
      activeConnections: new Set(),
      maxConnections: 5,
      connectionQueue: []
    };
    
    this.buffer = new Map();
    this.activeStreams = new Map();
    this.heartbeatIntervals = new Map();
    
    this.initializePerformanceMonitoring();
    this.loadMetricsFromStorage();
  }
  
  private initializePerformanceMonitoring(): void {
    if (!this.config.enableMetrics || typeof PerformanceObserver === 'undefined') {
      return;
    }
    
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name.includes('streaming-request')) {
            this.updateResponseTimeMetrics(entry.duration);
          }
        }
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Performance monitoring not available:', error);
    }
  }
  
  private loadMetricsFromStorage(): void {
    try {
      const stored = localStorage.getItem('streaming_metrics');
      if (stored) {
        const parsedMetrics = JSON.parse(stored);
        this.metrics = {
          ...this.metrics,
          ...parsedMetrics,
          lastUpdated: new Date(parsedMetrics.lastUpdated)
        };
      }
    } catch (error) {
      console.warn('Failed to load metrics from storage:', error);
    }
  }
  
  private saveMetricsToStorage(): void {
    try {
      localStorage.setItem('streaming_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Failed to save metrics to storage:', error);
    }
  }
  
  private updateResponseTimeMetrics(duration: number): void {
    const totalTime = this.metrics.averageResponseTime * this.metrics.totalRequests;
    this.metrics.averageResponseTime = (totalTime + duration) / (this.metrics.totalRequests + 1);
  }
  
  private updateThroughputMetrics(bytesTransferred: number, duration: number): void {
    const throughput = bytesTransferred / (duration / 1000); // bytes per second
    const totalThroughput = this.metrics.averageThroughput * this.metrics.successfulRequests;
    this.metrics.averageThroughput = (totalThroughput + throughput) / (this.metrics.successfulRequests + 1);
  }
  
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async acquireConnection(): Promise<string> {
    return new Promise((resolve) => {
      const connectionId = this.generateStreamId();
      
      if (this.connectionPool.activeConnections.size < this.connectionPool.maxConnections) {
        this.connectionPool.activeConnections.add(connectionId);
        resolve(connectionId);
      } else {
        this.connectionPool.connectionQueue.push(() => {
          this.connectionPool.activeConnections.add(connectionId);
          resolve(connectionId);
        });
      }
    });
  }
  
  private releaseConnection(connectionId: string): void {
    this.connectionPool.activeConnections.delete(connectionId);
    
    // Process queue
    if (this.connectionPool.connectionQueue.length > 0) {
      const nextCallback = this.connectionPool.connectionQueue.shift();
      if (nextCallback) {
        nextCallback();
      }
    }
  }
  
  private initializeBuffer(streamId: string): void {
    this.buffer.set(streamId, []);
  }
  
  private addToBuffer(streamId: string, data: string): void {
    const chunks = this.buffer.get(streamId) || [];
    const chunk: BufferedChunk = {
      id: `chunk_${Date.now()}`,
      data,
      timestamp: Date.now(),
      size: new Blob([data]).size
    };
    
    chunks.push(chunk);
    
    // Manage buffer size
    let totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
    while (totalSize > this.config.bufferSize && chunks.length > 1) {
      const removed = chunks.shift();
      if (removed) {
        totalSize -= removed.size;
      }
    }
    
    this.buffer.set(streamId, chunks);
  }
  
  private flushBuffer(streamId: string): string {
    const chunks = this.buffer.get(streamId) || [];
    const data = chunks.map(c => c.data).join('');
    this.buffer.delete(streamId);
    return data;
  }
  
  private setupHeartbeat(streamId: string, onHeartbeat: () => void): void {
    const interval = setInterval(() => {
      onHeartbeat();
    }, this.config.heartbeatInterval);
    
    this.heartbeatIntervals.set(streamId, interval);
  }
  
  private clearHeartbeat(streamId: string): void {
    const interval = this.heartbeatIntervals.get(streamId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(streamId);
    }
  }
  
  private parseStreamingEvent(data: string): StreamingEvent | null {
    try {
      if (data === '[DONE]') {
        return {
          type: 'metadata',
          data: { done: true },
          timestamp: Date.now()
        };
      }
      
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Failed to parse streaming event:', error);
      return null;
    }
  }
  
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.config.maxRetries) {
        throw error;
      }
      
      this.metrics.retryAttempts++;
      
      const delay = this.config.retryDelay * Math.pow(2, retryCount); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.retryWithBackoff(operation, retryCount + 1);
    }
  }
  
  public async startOptimizedStream(
    message: string,
    token: string,
    onEvent: (event: StreamingEvent) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<string> {
    const streamId = await this.acquireConnection();
    const startTime = performance.now();
    let bytesTransferred = 0;
    
    try {
      // Mark performance measurement start
      if (this.config.enableMetrics) {
        performance.mark(`streaming-request-start-${streamId}`);
      }
      
      this.metrics.totalRequests++;
      this.initializeBuffer(streamId);
      
      // Setup heartbeat
      this.setupHeartbeat(streamId, () => {
        onEvent({
          type: 'heartbeat',
          timestamp: Date.now()
        });
      });
      
      const operation = async () => {
        const abortController = new AbortController();
        this.activeStreams.set(streamId, abortController);
        
        // Setup timeout
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, this.config.connectionTimeout);
        
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          };
          
          if (this.config.enableCompression) {
            headers['Accept-Encoding'] = 'gzip, deflate, br';
          }
          
          const response = await fetch('/api/streaming/stream', {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
              message,
              streamId,
              options: {
                enableOptimizations: true,
                bufferSize: this.config.bufferSize
              }
            }),
            signal: abortController.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body reader available');
          }
          
          const decoder = new TextDecoder();
          let buffer = '';
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              bytesTransferred += chunk.length;
              
              // Add to internal buffer for optimization
              this.addToBuffer(streamId, chunk);
              
              buffer += chunk;
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    // Flush any remaining buffer
                    const remainingData = this.flushBuffer(streamId);
                    if (remainingData) {
                      // Process any remaining data
                    }
                    
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    this.metrics.successfulRequests++;
                    this.updateThroughputMetrics(bytesTransferred, duration);
                    
                    if (this.config.enableMetrics) {
                      performance.mark(`streaming-request-end-${streamId}`);
                      performance.measure(
                        `streaming-request-${streamId}`,
                        `streaming-request-start-${streamId}`,
                        `streaming-request-end-${streamId}`
                      );
                    }
                    
                    onComplete();
                    return;
                  }
                  
                  const event = this.parseStreamingEvent(data);
                  if (event) {
                    onEvent(event);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } finally {
          clearTimeout(timeoutId);
        }
      };
      
      await this.retryWithBackoff(operation);
      
    } catch (error: unknown) {
      this.metrics.failedRequests++;
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (errorObj.name === 'AbortError') {
        // Stream was cancelled, not an error
        return streamId;
      }
      
      if (errorObj.message.includes('fetch')) {
        this.metrics.connectionErrors++;
      }
      
      onError(errorObj);
    } finally {
      // Cleanup
      this.clearHeartbeat(streamId);
      this.activeStreams.delete(streamId);
      this.buffer.delete(streamId);
      this.releaseConnection(streamId);
      
      // Update metrics
      this.metrics.lastUpdated = new Date();
      this.saveMetricsToStorage();
    }
    
    return streamId;
  }
  
  public cancelStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
    
    this.clearHeartbeat(streamId);
    this.buffer.delete(streamId);
    this.releaseConnection(streamId);
  }
  
  public cancelAllStreams(): void {
    for (const [streamId] of Array.from(this.activeStreams)) {
      this.cancelStream(streamId);
    }
  }
  
  public getMetrics(): StreamingMetrics {
    return { ...this.metrics };
  }
  
  public getConnectionPoolStatus(): {
    active: number;
    queued: number;
    maxConnections: number;
  } {
    return {
      active: this.connectionPool.activeConnections.size,
      queued: this.connectionPool.connectionQueue.length,
      maxConnections: this.connectionPool.maxConnections
    };
  }
  
  public getBufferStatus(): {
    activeBuffers: number;
    totalBufferSize: number;
    averageBufferSize: number;
  } {
    let totalSize = 0;
    let bufferCount = 0;
    
    for (const [, chunks] of Array.from(this.buffer)) {
      bufferCount++;
      totalSize += chunks.reduce((sum: number, chunk: BufferedChunk) => sum + chunk.size, 0);
    }
    
    return {
      activeBuffers: bufferCount,
      totalBufferSize: totalSize,
      averageBufferSize: bufferCount > 0 ? totalSize / bufferCount : 0
    };
  }
  
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      averageThroughput: 0,
      connectionErrors: 0,
      retryAttempts: 0,
      lastUpdated: new Date()
    };
    
    this.saveMetricsToStorage();
  }
  
  public updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  public destroy(): void {
    this.cancelAllStreams();
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    // Clear all intervals
    for (const [streamId] of Array.from(this.heartbeatIntervals)) {
      this.clearHeartbeat(streamId);
    }
    
    // Clear buffers
    this.buffer.clear();
    
    // Save final metrics
    this.saveMetricsToStorage();
  }
}

// Singleton instance
let optimizedStreamingService: OptimizedStreamingService | null = null;

export const getOptimizedStreamingService = (config?: Partial<StreamingConfig>): OptimizedStreamingService => {
  if (!optimizedStreamingService) {
    optimizedStreamingService = new OptimizedStreamingService(config);
  }
  return optimizedStreamingService;
};

export const destroyOptimizedStreamingService = (): void => {
  if (optimizedStreamingService) {
    optimizedStreamingService.destroy();
    optimizedStreamingService = null;
  }
};

export default OptimizedStreamingService;
export type { StreamingConfig, StreamingMetrics, StreamingEvent };