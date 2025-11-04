/**
 * Optimized image component with lazy loading, progressive enhancement,
 * and performance monitoring
 */

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  blurDataURL?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
}

// Intersection Observer hook for lazy loading
const useIntersectionObserver = ({
  threshold = 0.1,
  rootMargin = '50px',
  enabled = true
}: {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
} = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [threshold, rootMargin, enabled]);

  return { ref, isIntersecting };
};

// Image loading state hook
const useImageLoading = (src: string, shouldLoad: boolean) => {
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldLoad || !src) return;

    setLoadingState('loading');

    const img = new Image();
    
    img.onload = () => {
      setLoadedSrc(src);
      setLoadingState('loaded');
    };
    
    img.onerror = () => {
      setLoadingState('error');
    };
    
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, shouldLoad]);

  return { loadingState, loadedSrc };
};

// Progressive image enhancement
const useProgressiveImage = (src: string, placeholder?: string) => {
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
    };
    
    img.src = src;

    return () => {
      img.onload = null;
    };
  }, [src]);

  return { currentSrc, isLoaded };
};

// Placeholder component
const ImagePlaceholder = memo(({ 
  width, 
  height, 
  className,
  blurDataURL 
}: {
  width?: number;
  height?: number;
  className?: string;
  blurDataURL?: string;
}) => {
  if (blurDataURL) {
    return (
      <img
        src={blurDataURL}
        alt=""
        className={cn('blur-sm transition-all duration-300', className)}
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn(
        'bg-muted animate-pulse flex items-center justify-center',
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    >
      <svg
        className="w-8 h-8 text-muted-foreground"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
});

ImagePlaceholder.displayName = 'ImagePlaceholder';

// Error fallback component
const ImageError = memo(({ 
  width, 
  height, 
  className,
  alt 
}: {
  width?: number;
  height?: number;
  className?: string;
  alt: string;
}) => (
  <div
    className={cn(
      'bg-muted border border-dashed border-muted-foreground/25 flex items-center justify-center',
      className
    )}
    style={{ width, height }}
    role="img"
    aria-label={`Failed to load image: ${alt}`}
  >
    <div className="text-center text-muted-foreground">
      <svg
        className="w-8 h-8 mx-auto mb-2"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-xs">Failed to load</p>
    </div>
  </div>
));

ImageError.displayName = 'ImageError';

// Main optimized image component
export const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  className,
  placeholder,
  blurDataURL,
  priority = false,
  quality = 75,
  sizes,
  onLoad,
  onError,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto'
}: OptimizedImageProps) => {
  const [hasError, setHasError] = useState(false);
  const { ref, isIntersecting } = useIntersectionObserver({
    enabled: !priority && loading === 'lazy'
  });
  
  const shouldLoad = priority || loading === 'eager' || isIntersecting;
  const { loadingState, loadedSrc } = useImageLoading(src, shouldLoad);
  const { currentSrc, isLoaded } = useProgressiveImage(
    loadedSrc || '',
    placeholder || blurDataURL
  );

  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Generate srcSet for responsive images
  const generateSrcSet = useCallback((baseSrc: string) => {
    if (!width) return undefined;
    
    const breakpoints = [0.5, 1, 1.5, 2];
    return breakpoints
      .map(multiplier => {
        const scaledWidth = Math.round(width * multiplier);
        return `${baseSrc}?w=${scaledWidth}&q=${quality} ${multiplier}x`;
      })
      .join(', ');
  }, [width, quality]);

  // Show error state
  if (hasError || loadingState === 'error') {
    return (
      <ImageError
        width={width}
        height={height}
        className={className}
        alt={alt}
      />
    );
  }

  // Show placeholder while loading
  if (!shouldLoad || loadingState === 'idle' || loadingState === 'loading') {
    return (
      <div ref={ref} className={cn('relative overflow-hidden', className)}>
        <ImagePlaceholder
          width={width}
          height={height}
          className={className}
          blurDataURL={blurDataURL}
        />
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {/* Blur placeholder */}
      {!isLoaded && (placeholder || blurDataURL) && (
        <div className="absolute inset-0">
          <ImagePlaceholder
            width={width}
            height={height}
            className="w-full h-full object-cover"
            blurDataURL={blurDataURL}
          />
        </div>
      )}
      
      {/* Main image */}
      <img
        src={currentSrc}
        srcSet={generateSrcSet(currentSrc)}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined
        }}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// Avatar component with optimized image
export const OptimizedAvatar = memo(({
  src,
  alt,
  size = 40,
  className,
  fallback
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ width: size, height: size }}
      >
        {fallback || (
          <svg
            className="w-1/2 h-1/2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full object-cover', className)}
      onError={() => setHasError(true)}
      priority
    />
  );
});

OptimizedAvatar.displayName = 'OptimizedAvatar';

// Gallery component with optimized images
export const OptimizedGallery = memo(({
  images,
  columns = 3,
  gap = 4,
  className
}: {
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  columns?: number;
  gap?: number;
  className?: string;
}) => {
  return (
    <div
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap * 0.25}rem`
      }}
    >
      {images.map((image, index) => (
        <OptimizedImage
          key={index}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className="w-full h-auto rounded-lg"
          loading={index < 6 ? 'eager' : 'lazy'}
          priority={index < 3}
        />
      ))}
    </div>
  );
});

OptimizedGallery.displayName = 'OptimizedGallery';

export default OptimizedImage;