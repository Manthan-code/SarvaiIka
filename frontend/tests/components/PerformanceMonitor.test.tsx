import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PerformanceMonitor from '../../src/components/PerformanceMonitor';

// Basic mocks for UI components to avoid Radix/portal complexities
jest.mock('../../src/components/ui/card', () => {
  const React = require('react');
  return {
    Card: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    CardContent: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    CardHeader: React.forwardRef<HTMLDivElement, any>(({ children, className, ...props }, ref) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    CardTitle: React.forwardRef<HTMLHeadingElement, any>(({ children, className, ...props }, ref) => (
      <h3 ref={ref} className={className} {...props}>{children}</h3>
    ))
  };
});

jest.mock('../../src/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>
}));

jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, onClick, className, 'data-testid': testId }: any) => (
    <button className={className} onClick={onClick} data-testid={testId}>{children}</button>
  )
}));

jest.mock('../../src/components/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />
}));

jest.mock('../../src/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>
}));

// Mock lucide-react icons to simple spans
jest.mock('lucide-react', () => ({
  Activity: () => <span>icon-activity</span>,
  Clock: () => <span>icon-clock</span>,
  HardDrive: () => <span>icon-harddrive</span>,
  Zap: () => <span>icon-zap</span>,
  RefreshCw: () => <span>icon-refresh</span>
}));

// Tests
describe('PerformanceMonitor', () => {
  it('renders a toggle button initially', () => {
    render(<PerformanceMonitor />);
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });

  it('shows the monitor UI after clicking the toggle button', () => {
    render(<PerformanceMonitor />);
    fireEvent.click(screen.getByText('Performance'));
    expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
  });

  it('closes the monitor when clicking Close', () => {
    render(<PerformanceMonitor />);
    fireEvent.click(screen.getByText('Performance'));
    expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });
});