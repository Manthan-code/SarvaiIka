/**
 * High-performance virtualized list component
 * Features: Virtual scrolling, memoization, and optimized rendering
 */

import React, { memo, useMemo, useCallback, forwardRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { cn } from '@/lib/utils';
import { useVirtualizedList } from '@/hooks/usePerformanceOptimization';

interface OptimizedListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  width?: string | number;
  className?: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  onItemClick?: (item: T, index: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  overscan?: number;
}

// Memoized list item component
const ListItem = memo(<T,>({
  index,
  style,
  data
}: ListChildComponentProps & {
  data: {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    keyExtractor: (item: T, index: number) => string | number;
    onItemClick?: (item: T, index: number) => void;
  };
}) => {
  const { items, renderItem, keyExtractor, onItemClick } = data;
  const item = items[index];
  
  const handleClick = useCallback(() => {
    if (onItemClick && item) {
      onItemClick(item, index);
    }
  }, [onItemClick, item, index]);
  
  if (!item) return null;
  
  return (
    <div
      style={style}
      onClick={handleClick}
      className={cn(
        'flex items-center px-4 hover:bg-accent/50 transition-colors cursor-pointer',
        onItemClick && 'cursor-pointer'
      )}
      data-index={index}
      data-key={keyExtractor(item, index)}
    >
      {renderItem(item, index)}
    </div>
  );
});

ListItem.displayName = 'ListItem';

// Loading skeleton component
const LoadingSkeleton = memo(({ height, itemHeight }: { height: number; itemHeight: number }) => {
  const skeletonCount = Math.ceil(height / itemHeight);
  
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: skeletonCount }, (_, i) => (
        <div
          key={i}
          className="animate-pulse bg-muted rounded"
          style={{ height: itemHeight - 8 }}
        />
      ))}
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';

// Empty state component
const EmptyState = memo(({ message, height }: { message: string; height: number }) => (
  <div 
    className="flex items-center justify-center text-muted-foreground"
    style={{ height }}
  >
    <p>{message}</p>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Main optimized list component
export const OptimizedList = <T,>({
  items,
  itemHeight,
  height,
  width = '100%',
  className,
  renderItem,
  keyExtractor,
  onItemClick,
  loading = false,
  emptyMessage = 'No items to display',
  overscan = 5
}: OptimizedListProps<T>) => {
  // Memoize the data object to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    items,
    renderItem,
    keyExtractor,
    onItemClick
  }), [items, renderItem, keyExtractor, onItemClick]);
  
  // Memoize the item key function
  const getItemKey = useCallback((index: number) => {
    const item = items[index];
    return item ? keyExtractor(item, index) : index;
  }, [items, keyExtractor]);
  
  if (loading) {
    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <LoadingSkeleton height={height} itemHeight={itemHeight} />
      </div>
    );
  }
  
  if (items.length === 0) {
    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <EmptyState message={emptyMessage} height={height} />
      </div>
    );
  }
  
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <List
        height={height}
        width={width}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={itemData}
        itemKey={getItemKey}
        overscanCount={overscan}
      >
        {ListItem}
      </List>
    </div>
  );
};

// Alternative implementation using custom virtualization
export const CustomVirtualizedList = <T,>({
  items,
  itemHeight,
  height,
  className,
  renderItem,
  keyExtractor,
  onItemClick,
  loading = false,
  emptyMessage = 'No items to display',
  overscan = 5
}: OptimizedListProps<T>) => {
  const {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  } = useVirtualizedList({
    items,
    itemHeight,
    containerHeight: height,
    overscan
  });
  
  const handleItemClick = useCallback((item: T, originalIndex: number) => {
    if (onItemClick) {
      onItemClick(item, originalIndex);
    }
  }, [onItemClick]);
  
  if (loading) {
    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <LoadingSkeleton height={height} itemHeight={itemHeight} />
      </div>
    );
  }
  
  if (items.length === 0) {
    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <EmptyState message={emptyMessage} height={height} />
      </div>
    );
  }
  
  return (
    <div 
      className={cn('border rounded-lg overflow-auto', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={keyExtractor(item, index)}
              style={{ height: itemHeight }}
              className={cn(
                'flex items-center px-4 hover:bg-accent/50 transition-colors',
                onItemClick && 'cursor-pointer'
              )}
              onClick={() => handleItemClick(item, index)}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Export both implementations
export default OptimizedList;