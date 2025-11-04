/**
 * Performance Dashboard Component
 * Features: Real-time metrics visualization, system health monitoring, and performance analytics
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Wifi,
  Database,
  Cpu,
  MemoryStick,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  LineChart,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getOptimizedStreamingService } from '@/services/optimizedStreamingService';
import type { StreamingMetrics } from '@/services/optimizedStreamingService';
import { cn } from '@/lib/utils';

interface PerformanceData {
  timestamp: number;
  responseTime: number;
  throughput: number;
  successRate: number;
  activeConnections: number;
  memoryUsage: number;
}

interface SystemHealth {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  api: 'online' | 'degraded' | 'offline';
  streaming: 'optimal' | 'slow' | 'error';
  cache: 'hit' | 'miss' | 'disabled';
  network: 'fast' | 'slow' | 'unstable';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  format?: 'number' | 'percentage' | 'time' | 'bytes';
}

interface ChartProps {
  data: PerformanceData[];
  metric: keyof PerformanceData;
  color: string;
  height?: number;
}

const MetricCard: React.FC<MetricCardProps> = memo(({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color = 'blue',
  format = 'number'
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'time':
        return `${val.toFixed(0)}ms`;
      case 'bytes':
        return val > 1024 ? `${(val / 1024).toFixed(1)}KB` : `${val}B`;
      default:
        return val.toLocaleString();
    }
  };
  
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="relative overflow-hidden">
        <div className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-5',
          colorClasses[color]
        )} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{formatValue(value)}</p>
              {change !== undefined && (
                <div className="flex items-center mt-1">
                  {change > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : change < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  ) : null}
                  <span className={cn(
                    'text-sm font-medium',
                    change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className={cn(
              'p-3 rounded-full bg-gradient-to-br',
              colorClasses[color]
            )}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

const MiniChart: React.FC<ChartProps> = memo(({ data, metric, color, height = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    
    // Skip canvas operations in test environment
    if (typeof window !== 'undefined' && window.navigator.userAgent.includes('jsdom')) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height: canvasHeight } = canvas;
    ctx.clearRect(0, 0, width, canvasHeight);
    
    // Get values for the metric
    const values = data.map(d => d[metric] as number);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    values.forEach((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = canvasHeight - ((value - minValue) / range) * canvasHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '00');
    
    ctx.fillStyle = gradient;
    ctx.lineTo(width, canvasHeight);
    ctx.lineTo(0, canvasHeight);
    ctx.closePath();
    ctx.fill();
    
  }, [data, metric, color]);
  
  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={height}
      className="w-full"
      style={{ height: `${height}px` }}
    />
  );
});

const SystemHealthIndicator: React.FC<{ health: SystemHealth }> = memo(({ health }) => {
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'online':
      case 'optimal':
      case 'hit':
      case 'fast':
        return 'text-green-500';
      case 'good':
      case 'degraded':
      case 'slow':
      case 'miss':
        return 'text-yellow-500';
      case 'fair':
      case 'unstable':
        return 'text-orange-500';
      case 'poor':
      case 'offline':
      case 'error':
      case 'disabled':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };
  
  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'online':
      case 'optimal':
      case 'hit':
      case 'fast':
        return CheckCircle;
      case 'poor':
      case 'offline':
      case 'error':
      case 'disabled':
        return XCircle;
      default:
        return AlertTriangle;
    }
  };
  
  const healthItems = [
    { label: 'Overall', value: health.overall, icon: Activity },
    { label: 'API', value: health.api, icon: Wifi },
    { label: 'Streaming', value: health.streaming, icon: Zap },
    { label: 'Cache', value: health.cache, icon: Database },
    { label: 'Network', value: health.network, icon: Download }
  ];
  
  return (
    <div className="grid grid-cols-5 gap-4">
      {healthItems.map(({ label, value, icon: Icon }) => {
        const HealthIcon = getHealthIcon(value);
        return (
          <motion.div
            key={label}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <HealthIcon className={cn('w-4 h-4', getHealthColor(value))} />
            </div>
            <span className="text-xs font-medium text-center">{label}</span>
            <span className={cn('text-xs capitalize', getHealthColor(value))}>
              {value}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
});

const PerformanceDashboard: React.FC<{ className?: string }> = ({ className }) => {
  const [metrics, setMetrics] = useState<StreamingMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'good',
    api: 'online',
    streaming: 'optimal',
    cache: 'hit',
    network: 'fast'
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  
  const streamingService = getOptimizedStreamingService();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const currentMetrics = streamingService.getMetrics();
      const connectionStatus = streamingService.getConnectionPoolStatus();
      const bufferStatus = streamingService.getBufferStatus();
      
      if (!currentMetrics) {
        return; // Exit early if no metrics available
      }
      
      setMetrics(currentMetrics);
      
      // Add to performance data
      const newDataPoint: PerformanceData = {
        timestamp: Date.now(),
        responseTime: currentMetrics.averageResponseTime,
        throughput: currentMetrics.averageThroughput,
        successRate: currentMetrics.successfulRequests > 0 
          ? (currentMetrics.successfulRequests / currentMetrics.totalRequests) * 100 
          : 100,
        activeConnections: connectionStatus.active,
        memoryUsage: bufferStatus.totalBufferSize
      };
      
      setPerformanceData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-50); // Keep last 50 data points
      });
      
      // Update system health
      updateSystemHealth(currentMetrics, connectionStatus, bufferStatus);
      
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [streamingService]);
  
  const updateSystemHealth = useCallback((metrics: StreamingMetrics, connectionStatus: { active: number; queued: number; maxConnections: number }, bufferStatus: { activeBuffers: number; totalBufferSize: number; averageBufferSize: number }) => {
    const successRate = metrics.totalRequests > 0 
      ? (metrics.successfulRequests / metrics.totalRequests) * 100 
      : 100;
    
    const health: SystemHealth = {
      overall: successRate > 95 ? 'excellent' : successRate > 85 ? 'good' : successRate > 70 ? 'fair' : 'poor',
      api: metrics.connectionErrors < 5 ? 'online' : metrics.connectionErrors < 15 ? 'degraded' : 'offline',
      streaming: metrics.averageResponseTime < 2000 ? 'optimal' : metrics.averageResponseTime < 5000 ? 'slow' : 'error',
      cache: bufferStatus.activeBuffers > 0 ? 'hit' : 'miss',
      network: metrics.averageThroughput > 1000 ? 'fast' : metrics.averageThroughput > 500 ? 'slow' : 'unstable'
    };
    
    setSystemHealth(health);
  }, []);
  
  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
      fetchMetrics(); // Initial fetch
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchMetrics]);
  
  const resetMetrics = useCallback(() => {
    streamingService.resetMetrics();
    setPerformanceData([]);
    fetchMetrics();
  }, [streamingService, fetchMetrics]);
  
  const successRate = useMemo(() => 
    metrics && metrics.totalRequests > 0 
      ? (metrics.successfulRequests / metrics.totalRequests) * 100 
      : 100,
    [metrics?.totalRequests, metrics?.successfulRequests]
  );
  
  if (!metrics) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading performance metrics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <TooltipProvider>
      <motion.div
        layout
        className={cn('space-y-6', className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Performance Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time monitoring of AI streaming performance
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  <RefreshCw className={cn(
                    'w-4 h-4 mr-2',
                    autoRefresh && 'animate-spin'
                  )} />
                  {autoRefresh ? 'Auto' : 'Manual'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {autoRefresh ? 'Disable' : 'Enable'} auto-refresh
              </TooltipContent>
            </Tooltip>
            
            <Button variant="outline" size="sm" onClick={resetMetrics}>
              Reset
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SystemHealthIndicator health={systemHealth} />
          </CardContent>
        </Card>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Response Time"
            value={metrics.averageResponseTime}
            icon={Clock}
            color="blue"
            format="time"
          />
          
          <MetricCard
            title="Success Rate"
            value={successRate}
            icon={CheckCircle}
            color="green"
            format="percentage"
          />
          
          <MetricCard
            title="Throughput"
            value={metrics.averageThroughput}
            icon={Upload}
            color="purple"
            format="bytes"
          />
          
          <MetricCard
            title="Total Requests"
            value={metrics.totalRequests}
            icon={BarChart3}
            color="yellow"
          />
        </div>
        
        {/* Detailed Metrics */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Tabs defaultValue="charts" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="charts">Performance Charts</TabsTrigger>
                  <TabsTrigger value="details">Detailed Metrics</TabsTrigger>
                  <TabsTrigger value="connections">Connections</TabsTrigger>
                </TabsList>
                
                <TabsContent value="charts" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Response Time Trend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MiniChart
                          data={performanceData}
                          metric="responseTime"
                          color="#3b82f6"
                          height={120}
                        />
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Success Rate Trend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MiniChart
                          data={performanceData}
                          metric="successRate"
                          color="#10b981"
                          height={120}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="details" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Request Statistics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between">
                          <span>Total Requests:</span>
                          <Badge variant="outline">{metrics.totalRequests}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Successful:</span>
                          <Badge variant="outline" className="text-green-600">
                            {metrics.successfulRequests}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Failed:</span>
                          <Badge variant="outline" className="text-red-600">
                            {metrics.failedRequests}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Retry Attempts:</span>
                          <Badge variant="outline">{metrics.retryAttempts}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Performance Metrics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Avg Response Time:</span>
                            <span>{metrics.averageResponseTime.toFixed(0)}ms</span>
                          </div>
                          <Progress value={Math.min((metrics.averageResponseTime / 5000) * 100, 100)} />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Success Rate:</span>
                            <span>{successRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={successRate} className="[&>div]:bg-green-500" />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Avg Throughput:</span>
                            <span>{(metrics.averageThroughput / 1024).toFixed(1)} KB/s</span>
                          </div>
                          <Progress value={Math.min((metrics.averageThroughput / 10240) * 100, 100)} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="connections">
                  <Card>
                    <CardHeader>
                      <CardTitle>Connection Pool Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {streamingService.getConnectionPoolStatus().active}
                          </div>
                          <div className="text-sm text-muted-foreground">Active Connections</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {streamingService.getConnectionPoolStatus().queued}
                          </div>
                          <div className="text-sm text-muted-foreground">Queued Requests</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {streamingService.getBufferStatus().activeBuffers}
                          </div>
                          <div className="text-sm text-muted-foreground">Active Buffers</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Footer */}
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {metrics.lastUpdated.toLocaleTimeString()} • 
          Auto-refresh: {autoRefresh ? `${refreshInterval / 1000}s` : 'Off'}
        </div>
      </motion.div>
    </TooltipProvider>
  );
};

export default PerformanceDashboard;