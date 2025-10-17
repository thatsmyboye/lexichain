import React, { lazy, Suspense, ComponentType } from 'react';

// Loading component for suspense fallbacks
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Error boundary for lazy components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-destructive mb-2">
              Failed to load component
            </h3>
            <p className="text-muted-foreground mb-4">
              There was an error loading this part of the application.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for lazy loading with error boundary
export function withLazyLoading<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);

  return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
    <LazyErrorBoundary>
      <Suspense fallback={fallback || <LoadingSpinner />}>
        <LazyComponent {...props} ref={ref} />
      </Suspense>
    </LazyErrorBoundary>
  ));
}

// Lazy load game components
export const LazyWordPathGame = withLazyLoading(
  () => import('@/components/game/WordPathGame'),
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
  </div>
);

export const LazyLeaderboardPage = withLazyLoading(
  () => import('@/pages/LeaderboardPage')
);

export const LazyMyAccountPage = withLazyLoading(
  () => import('@/pages/MyAccountPage')
);

export const LazyStatsPage = withLazyLoading(
  () => import('@/pages/StatsPage')
);

export const LazyStorePage = withLazyLoading(
  () => import('@/pages/StorePage')
);

export const LazyAuthPage = withLazyLoading(
  () => import('@/pages/AuthPage')
);

export const LazyDebugPage = withLazyLoading(
  () => import('@/pages/DebugPage')
);

// Lazy load tutorial components
export const LazyTutorialOverlay = withLazyLoading(
  () => import('@/components/tutorial/TutorialOverlay')
);

export const LazyInteractiveTutorial = withLazyLoading(
  () => import('@/components/tutorial/InteractiveTutorial')
);

// Lazy load effects components
export const LazyParticleSystem = withLazyLoading(
  () => import('@/components/effects/ParticleSystem')
);

export const LazySoundSystem = withLazyLoading(
  () => import('@/components/effects/SoundSystem')
);

// Lazy load accessibility components
export const LazyColorBlindSupport = withLazyLoading(
  () => import('@/components/accessibility/ColorBlindSupport')
);

export const LazyARIAComponents = withLazyLoading(
  () => import('@/components/accessibility/ARIAComponents')
);

// Route-based code splitting
export const LazyRoute = withLazyLoading(
  () => import('@/components/performance/LazyRoute')
);

// Dynamic import utility
export async function loadComponent<T>(
  importFunc: () => Promise<{ default: T }>
): Promise<T> {
  try {
    const module = await importFunc();
    return module.default;
  } catch (error) {
    console.error('Failed to load component:', error);
    throw error;
  }
}

// Preload components
export function preloadComponents() {
  // Preload critical components
  const criticalComponents = [
    () => import('@/components/game/WordPathGame'),
    () => import('@/components/tutorial/InteractiveTutorial'),
    () => import('@/components/effects/SoundSystem')
  ];

  criticalComponents.forEach(importFunc => {
    importFunc().catch(error => {
      console.warn('Failed to preload component:', error);
    });
  });
}

// Component preloader
export function ComponentPreloader({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Preload components after initial render
    const timer = setTimeout(() => {
      preloadComponents();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return <>{children}</>;
}

// Lazy route component
interface LazyRouteProps {
  path: string;
  component: ComponentType<any>;
  fallback?: React.ReactNode;
}

export function LazyRoute({ path, component: Component, fallback }: LazyRouteProps) {
  return (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      <Component />
    </Suspense>
  );
}

// Bundle analyzer (development only)
export function BundleAnalyzer() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const [bundleSize, setBundleSize] = React.useState<number>(0);

  React.useEffect(() => {
    // This would integrate with webpack-bundle-analyzer in a real implementation
    const estimateBundleSize = () => {
      // Placeholder for bundle size estimation
      return Math.random() * 1000; // Mock data
    };

    setBundleSize(estimateBundleSize());
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg">
      <h4 className="font-semibold mb-2">Bundle Info</h4>
      <p className="text-sm text-muted-foreground">
        Estimated size: {bundleSize.toFixed(2)} KB
      </p>
    </div>
  );
}

// Performance metrics
export function PerformanceMetrics() {
  const [metrics, setMetrics] = React.useState({
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0
  });

  React.useEffect(() => {
    const measurePerformance = () => {
      if ('performance' in window && 'memory' in (performance as any)) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024, // MB
        }));
      }
    };

    const interval = setInterval(measurePerformance, 5000);
    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-background border rounded-lg p-4 shadow-lg">
      <h4 className="font-semibold mb-2">Performance</h4>
      <div className="space-y-1 text-sm">
        <p>Memory: {metrics.memoryUsage.toFixed(2)} MB</p>
        <p>Components: {metrics.componentCount}</p>
      </div>
    </div>
  );
}
