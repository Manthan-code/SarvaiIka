/**
 * Performance monitoring component for React applications
 * Tracks render times, component updates, and memory usage
 */

import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Clock, HardDrive, Zap, RefreshCw } from 'lucide-react';

interface PerformanceMetrics {
  renderTime: number;
  componentUpdates: number;
  memoryUsage: number;
  fps: number;
  timestamp: number;
}

interface ComponentMetric {
  name: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  lastRenderTime: number;
}

// Performance data store
class PerformanceStore {
  private metrics: PerformanceMetrics[] = [];
  private componentMetrics: Map<string, ComponentMetric> = new Map();
  private observers: Set<() => void> = new Set();
  private maxMetrics = 100;

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
    this.notifyObservers();
  }

  addComponentMetric(name: string, renderTime: number) {
    const existing = this.componentMetrics.get(name);
    if (existing) {
      existing.renderCount++;
      existing.totalRenderTime += renderTime;
      existing.averageRenderTime = existing.totalRenderTime / existing.renderCount;
      existing.lastRenderTime = renderTime;
    } else {
      this.componentMetrics.set(name, {
        name,
        renderCount: 1,
        totalRenderTime: renderTime,
        averageRenderTime: renderTime,
        lastRenderTime: renderTime
      });
    }
    this.notifyObservers();
  }

  getMetrics() {
    return [...this.metrics];
  }

  getComponentMetrics() {
    return Array.from(this.componentMetrics.values());
  }

  subscribe(callback: () => void) {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  clear() {
    this.metrics.length = 0;
    this.componentMetrics.clear();
    this.notifyObservers();
  }

  private notifyObservers() {
    this.observers.forEach(callback => callback());
  }
}

// Global performance store instance
const performanceStore = new PerformanceStore();

// Performance monitoring hook
export const usePerformanceMonitor = (componentName?: string) => {
  const renderStartTime = useRef<number>();
  const [, forceUpdate] = useState({});

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    if (renderStartTime.current && componentName) {
      const renderTime = performance.now() - renderStartTime.current;
      performanceStore.addComponentMetric(componentName, renderTime);
    }
  });

  const trackRender = useCallback((name: string) => {
    const startTime = performance.now();
    return () => {
      const renderTime = performance.now() - startTime;
      performanceStore.addComponentMetric(name, renderTime);
    };
  }, []);

  const subscribe = useCallback((callback: () => void) => {
    return performanceStore.subscribe(callback);
  }, []);

  const refresh = useCallback(() => {
    forceUpdate({});
  }, []);

  return {
    trackRender,
    subscribe,
    refresh,
    getMetrics: () => performanceStore.getMetrics(),
    getComponentMetrics: () => performanceStore.getComponentMetrics(),
    clearMetrics: () => performanceStore.clear()
  };
};

// FPS monitor
const useFPSMonitor = () => {
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const animationId = useRef<number>();

  const measureFPS = useCallback(() => {
    frameCount.current++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime.current >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / (currentTime - lastTime.current)));
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
    
    animationId.current = requestAnimationFrame(measureFPS);
  }, []);

  useEffect(() => {
    animationId.current = requestAnimationFrame(measureFPS);
    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
  }, [measureFPS]);

  return fps;
};

// Memory usage monitor
const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    used: number;
    total: number;
    percentage: number;
  }>({ used: 0, total: 0, percentage: 0 });

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize / 1024 / 1024; // MB
        const total = memory.totalJSHeapSize / 1024 / 1024; // MB
        const percentage = (used / total) * 100;
        
        setMemoryInfo({ used, total, percentage });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
};

// Performance metrics display component
const MetricsDisplay = memo(() => {
  const { getMetrics, getComponentMetrics, clearMetrics, subscribe } = usePerformanceMonitor();
  const [, forceUpdate] = useState({});
  const fps = useFPSMonitor();
  const memory = useMemoryMonitor();

  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, [subscribe]);

  const metrics = getMetrics();
  const componentMetrics = getComponentMetrics();
  const latestMetric = metrics[metrics.length - 1];

  const averageRenderTime = componentMetrics.length > 0
    ? componentMetrics.reduce((sum, metric) => sum + metric.averageRenderTime, 0) / componentMetrics.length
    : 0;

  const totalRenders = componentMetrics.reduce((sum, metric) => sum + metric.renderCount, 0);

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FPS</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fps}</div>
            <Badge variant={fps >= 50 ? 'default' : fps >= 30 ? 'secondary' : 'destructive'}>
              {fps >= 50 ? 'Excellent' : fps >= 30 ? 'Good' : 'Poor'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Render Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRenderTime.toFixed(2)}ms</div>
            <Badge variant={averageRenderTime < 16 ? 'default' : averageRenderTime < 33 ? 'secondary' : 'destructive'}>
              {averageRenderTime < 16 ? 'Fast' : averageRenderTime < 33 ? 'Moderate' : 'Slow'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memory.used.toFixed(1)}MB</div>
            <Progress value={memory.percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {memory.percentage.toFixed(1)}% of {memory.total.toFixed(1)}MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Renders</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRenders}</div>
            <p className="text-xs text-muted-foreground">
              {componentMetrics.length} components
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="components" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <Button onClick={clearMetrics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Component Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {componentMetrics
                  .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
                  .map((metric) => (
                    <div key={metric.name} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{metric.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {metric.renderCount} renders
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{metric.averageRenderTime.toFixed(2)}ms</p>
                        <p className="text-sm text-muted-foreground">
                          Last: {metric.lastRenderTime.toFixed(2)}ms
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {metrics.slice(-20).reverse().map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span>{new Date(metric.timestamp).toLocaleTimeString()}</span>
                    <div className="flex gap-4">
                      <span>Render: {metric.renderTime.toFixed(2)}ms</span>
                      <span>Updates: {metric.componentUpdates}</span>
                      <span>Memory: {metric.memoryUsage.toFixed(1)}MB</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

MetricsDisplay.displayName = 'MetricsDisplay';

// Main performance monitor component
export const PerformanceMonitor = memo(() => {
  const [isVisible, setIsVisible] = useState(false);

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
        size="sm"
      >
        <Activity className="h-4 w-4 mr-2" />
        Performance
      </Button>
    );
  }

  return (
    <div className="fixed inset-4 z-50 bg-background border rounded-lg shadow-lg overflow-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Performance Monitor</h2>
          <Button onClick={() => setIsVisible(false)} variant="outline" size="sm">
            Close
          </Button>
        </div>
        <MetricsDisplay />
      </div>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

// HOC for automatic performance tracking
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = memo((props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    usePerformanceMonitor(name);
    
    return <Component {...props} />;
  });
  
  WrappedComponent.displayName = `withPerformanceTracking(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default PerformanceMonitor;