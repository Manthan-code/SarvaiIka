import React, { Suspense, lazy } from 'react';
import { render, screen } from '@testing-library/react';
import { withLazyLoading, LoadingFallback } from '@/components/LazyComponents';

describe('LazyComponents HOC', () => {
  it('renders fallback during suspense', () => {
    const LazyComp = lazy(async () => ({ default: () => <div>Loaded</div> }));
    const Wrapped = withLazyLoading(LazyComp, 'Loading...');
    render(
      <Suspense fallback={<LoadingFallback />}>
        <Wrapped />
      </Suspense>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});