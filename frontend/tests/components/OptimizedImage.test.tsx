import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import OptimizedImage from '@/components/OptimizedImage';

// Mock global Image to trigger onload/onerror
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  _src = '';
  set src(value: string) {
    this._src = value;
    // simulate async load
    queueMicrotask(() => {
      if (value.includes('error')) {
        this.onerror && this.onerror();
      } else {
        this.onload && this.onload();
      }
    });
  }
}
// @ts-ignore
global.Image = MockImage as any;

describe('OptimizedImage', () => {
  it('shows placeholder before loading when lazy', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Test" width={100} height={50} loading="lazy" />
    );
    // Placeholder renders as a div with aria-hidden when no blurDataURL
    const placeholder = container.querySelector('.animate-pulse');
    expect(placeholder).toBeTruthy();
  });

  it('loads and renders image when priority', async () => {
    render(<OptimizedImage src="/test.jpg" alt="Test" width={100} height={50} priority />);
    // After mock load via useImageLoading + useProgressiveImage, the <img> src should update
    const img = await screen.findByRole('img', { name: /test/i });
    await waitFor(() => {
      expect(img).toHaveAttribute('src', expect.stringContaining('/test.jpg'));
    });
  });

  it('renders error fallback on error', async () => {
    render(<OptimizedImage src="/error.jpg" alt="Broken" width={100} height={50} priority />);
    const errorFallback = await screen.findByRole('img', { name: /failed to load image: broken/i });
    expect(errorFallback).toBeInTheDocument();
  });
});