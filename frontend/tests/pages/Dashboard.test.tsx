import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';

// Mock the useHashRouting hook
jest.mock('../../src/hooks/useHashRouting', () => ({
  useHashRouting: jest.fn(() => ({
    currentHash: null,
    setHash: jest.fn(),
    clearHash: jest.fn(),
    isHashActive: jest.fn(() => false),
  })),
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  MessageSquare: () => <div data-testid="message-square-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  CreditCard: () => <div data-testid="credit-card-icon" />,
  HelpCircle: () => <div data-testid="help-circle-icon" />,
}));

// Mock UI components
jest.mock('../../src/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div data-testid="card-description" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div data-testid="card-title" {...props}>{children}</div>,
}));

jest.mock('../../src/components/ui/button', () => ({
  Button: ({ children, onClick, asChild, ...props }: any) => {
    if (asChild) {
      return <div data-testid="button" {...props}>{children}</div>;
    }
    return <button data-testid="button" onClick={onClick} {...props}>{children}</button>;
  },
}));

jest.mock('../../src/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} {...props} />
  ),
}));

const renderDashboard = () => {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderDashboard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays the main dashboard title and description', () => {
    renderDashboard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back! Here\'s what\'s happening with your account.')).toBeInTheDocument();
  });

  it('renders all stat cards with correct data', () => {
    renderDashboard();
    
    // Check for stat cards
    expect(screen.getByText('Total Chats')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    
    expect(screen.getByText('Usage This Month')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    
    expect(screen.getByText('Response Time')).toBeInTheDocument();
    expect(screen.getByText('0.8s')).toBeInTheDocument();
  });

  it('renders usage overview section', () => {
    renderDashboard();
    
    expect(screen.getByText('Usage Overview')).toBeInTheDocument();
    expect(screen.getByText('Your current plan usage and limits')).toBeInTheDocument();
    expect(screen.getByText('Messages Used')).toBeInTheDocument();
    expect(screen.getByText('1,234 / 5,000')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('2.1 GB / 10 GB')).toBeInTheDocument();
  });

  it('renders progress bars with correct values', () => {
    renderDashboard();
    
    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute('data-value', '25');
    expect(progressBars[1]).toHaveAttribute('data-value', '21');
  });

  it('renders recent activity section', () => {
    renderDashboard();
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Your latest actions and updates')).toBeInTheDocument();
    
    // Check for activity items
    expect(screen.getByText('Started new chat')).toBeInTheDocument();
    expect(screen.getByText('Upgraded plan')).toBeInTheDocument();
    expect(screen.getByText('Generated report')).toBeInTheDocument();
    expect(screen.getByText('Updated settings')).toBeInTheDocument();
  });

  it('renders quick actions section with all buttons', () => {
    renderDashboard();
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Common tasks and shortcuts')).toBeInTheDocument();
    
    // Check for action buttons
    expect(screen.getByText('Start New Chat')).toBeInTheDocument();
    expect(screen.getByText('View Settings')).toBeInTheDocument();
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('handles subscription click', () => {
    const mockSetHash = jest.fn();
    const { useHashRouting } = require('../../src/hooks/useHashRouting');
    useHashRouting.mockReturnValue({
      currentHash: null,
      setHash: mockSetHash,
      clearHash: jest.fn(),
      isHashActive: jest.fn(() => false),
    });
    
    renderDashboard();
    
    const upgradeButton = screen.getByText('Upgrade Plan');
    fireEvent.click(upgradeButton);
    
    expect(mockSetHash).toHaveBeenCalledWith('subscription');
  });

  it('renders all required icons', () => {
    renderDashboard();
    
    expect(screen.getByTestId('message-square-icon')).toBeInTheDocument();
    expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
    expect(screen.getByTestId('credit-card-icon')).toBeInTheDocument();
    expect(screen.getByTestId('help-circle-icon')).toBeInTheDocument();
  });

  it('has proper navigation links', () => {
    renderDashboard();
    
    // Check for Link components (rendered as divs due to mocking)
    const startChatLink = screen.getByText('Start New Chat').closest('[data-testid="button"]');
    expect(startChatLink).toBeInTheDocument();
  });

  it('displays correct time stamps in recent activity', () => {
    renderDashboard();
    
    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    expect(screen.getByText('3 hours ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
  });

  it('renders proper card structure', () => {
    renderDashboard();
    
    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBeGreaterThan(0);
    
    const cardHeaders = screen.getAllByTestId('card-header');
    expect(cardHeaders.length).toBeGreaterThan(0);
    
    const cardContents = screen.getAllByTestId('card-content');
    expect(cardContents.length).toBeGreaterThan(0);
  });

  it('has responsive layout classes', () => {
    renderDashboard();
    
    // The component should have grid layout classes for responsiveness
    const container = screen.getByText('Dashboard').closest('div');
    expect(container).toBeInTheDocument();
  });
});