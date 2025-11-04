import React from 'react';
import { render, screen } from '@testing-library/react';
import AnimatedLoadingPage from '@/components/AnimatedLoadingPage';

jest.useFakeTimers();

describe('AnimatedLoadingPage', () => {
  it('renders and calls onLoadingComplete after duration', () => {
    const onComplete = jest.fn();
    render(<AnimatedLoadingPage duration={500} onLoadingComplete={onComplete} />);

    // Initially visible
    expect(screen.getByText('AI Agent Platform')).toBeInTheDocument();

    // Fast-forward timers
    jest.advanceTimersByTime(500);

    // Allow fade-out timeout (300ms)
    jest.advanceTimersByTime(300);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});