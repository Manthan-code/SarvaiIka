/**
 * Lazy-loaded components for code splitting and performance optimization
 */

import { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Loading fallback component
const LoadingFallback = ({ message = 'Loading...' }: { message?: string }) => (
  <Card className="w-full h-64 flex items-center justify-center">
    <CardContent className="flex items-center gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-muted-foreground">{message}</span>
    </CardContent>
  </Card>
);

// Higher-order component for lazy loading with custom fallback
const withLazyLoading = <P extends object>(
  Component: ComponentType<P>,
  fallbackMessage?: string
) => {
  return (props: P) => (
    <Suspense fallback={<LoadingFallback message={fallbackMessage} />}>
      <Component {...props} />
    </Suspense>
  );
};

// Lazy-loaded components
export const LazyPerformanceDashboard = lazy(() => import('@/components/PerformanceDashboard'));
export const LazyEnhancedStreamingChat = lazy(() => import('@/components/EnhancedStreamingChat'));
export const LazyErrorMonitoring = lazy(() => import('@/pages/ErrorMonitoring'));
export const LazySubscriptions = lazy(() => import('@/pages/Subscriptions'));
export const LazyHelpPage = lazy(() => import('@/pages/HelpPage'));

// Wrapped components with loading fallbacks
export const PerformanceDashboardWithLoading = withLazyLoading(
  LazyPerformanceDashboard,
  'Loading Performance Dashboard...'
);

export const EnhancedStreamingChatWithLoading = withLazyLoading(
  LazyEnhancedStreamingChat,
  'Loading Chat Interface...'
);

export const ErrorMonitoringWithLoading = withLazyLoading(
  LazyErrorMonitoring,
  'Loading Error Monitoring...'
);

export const SubscriptionsWithLoading = withLazyLoading(
  LazySubscriptions,
  'Loading Subscriptions...'
);

export const HelpPageWithLoading = withLazyLoading(
  LazyHelpPage,
  'Loading Help...'
);

// Export the HOC for custom usage
export { withLazyLoading, LoadingFallback };