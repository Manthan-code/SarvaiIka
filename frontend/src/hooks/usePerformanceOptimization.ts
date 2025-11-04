/**
 * Custom hook for React performance optimizations
 * Provides memoized utilities and performance monitoring
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
}

interface UsePerformanceOptimizationOptions {
  enableMetrics?: boolean;
  debounceDelay?: number;
  throttleDelay?: number;
}

export const usePerformanceOptimization = ({
  enableMetrics = false,
  debounceDelay = 300,
  throttleDelay = 100
}: UsePerformanceOptimizationOptions = {}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0
  });

  const renderStartTime = useRef<number>(0);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const throttleTimers = useRef<Map<string, { lastCall: number; timer?: NodeJS.Timeout }>>(new Map());

  // Performance metrics tracking
  useEffect(() => {
    if (enableMetrics) {
      renderStartTime.current = performance.now();
      
      return () => {
        const renderTime = performance.now() - renderStartTime.current;
        setMetrics(prev => {
          const newRenderCount = prev.renderCount + 1;
          const newTotalTime = prev.totalRenderTime + renderTime;
          return {
            renderCount: newRenderCount,
            lastRenderTime: renderTime,
            averageRenderTime: newTotalTime / newRenderCount,
            totalRenderTime: newTotalTime
          };
        });
      };
    }
  });

  // Memoized debounce function
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    delay: number = debounceDelay
  ): ((...args: Parameters<T>) => void) => {
    return (...args: Parameters<T>) => {
      const existingTimer = debounceTimers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      const timer = setTimeout(() => {
        func(...args);
        debounceTimers.current.delete(key);
      }, delay);
      
      debounceTimers.current.set(key, timer);
    };
  }, [debounceDelay]);

  // Memoized throttle function
  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    delay: number = throttleDelay
  ): ((...args: Parameters<T>) => void) => {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const throttleData = throttleTimers.current.get(key);
      
      if (!throttleData || now - throttleData.lastCall >= delay) {
        func(...args);
        throttleTimers.current.set(key, { lastCall: now });
      } else {
        if (throttleData.timer) {
          clearTimeout(throttleData.timer);
        }
        
        const timer = setTimeout(() => {
          func(...args);
          throttleTimers.current.set(key, { lastCall: Date.now() });
        }, delay - (now - throttleData.lastCall));
        
        throttleTimers.current.set(key, { ...throttleData, timer });
      }
    };
  }, [throttleDelay]);

  // Memoized stable reference creator
  const createStableRef = useCallback(<T>(value: T): T => {
    const ref = useRef<T>(value);
    return useMemo(() => {
      ref.current = value;
      return ref.current;
    }, [value]);
  }, []);

  // Memoized deep comparison
  const useMemoDeep = useCallback(<T>(
    factory: () => T,
    deps: any[]
  ): T => {
    return useMemo(factory, deps.map(dep => 
      typeof dep === 'object' && dep !== null 
        ? JSON.stringify(dep) 
        : dep
    ));
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    debounceTimers.current.forEach(timer => clearTimeout(timer));
    debounceTimers.current.clear();
    
    throttleTimers.current.forEach(data => {
      if (data.timer) clearTimeout(data.timer);
    });
    throttleTimers.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    metrics: enableMetrics ? metrics : null,
    debounce,
    throttle,
    createStableRef,
    useMemoDeep,
    cleanup
  };
};

// Hook for optimizing list rendering
export const useVirtualizedList = <T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index
      }));
  }, [items, visibleRange]);
  
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;
  
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    visibleRange
  };
};

export default usePerformanceOptimization;