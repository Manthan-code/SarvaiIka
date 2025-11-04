import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../../src/pages/Dashboard';
import { useAuth } from '../../src/hooks/useAuth';
import * as dashboardService from '../../src/services/dashboardService';

// Mock dependencies
jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../src/services/dashboardService', () => ({
  getUserStats: jest.fn(),
  getRecentActivity: jest.fn(),
  getSystemStatus: jest.fn()
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn()
  })
}));

// Mock chart component
jest.mock('../../src/components/charts/ActivityChart', () => ({
  __esModule: true,
  default: () => <div data-testid="activity-chart">Activity Chart</div>
}));

describe('Dashboard Page', () => {
  const mockUser = { 
    id: 'user123', 
    name: 'Test User', 
    email: 'test@example.com',
    role: 'user'
  };
  
  const mockStats = {
    totalSessions: 42,
    activeChats: 3,
    completedTasks: 156,
    averageResponseTime: '1.2s'
  };
  
  const mockActivity = [
    { id: '1', type: 'chat', title: 'Chat with AI', timestamp: '2023-06-01T10:00:00Z' },
    { id: '2', type: 'task', title: 'Code Review', timestamp: '2023-06-01T09:30:00Z' },
    { id: '3', type: 'session', title: 'Debugging Session', timestamp: '2023-05-31T15:45:00Z' }
  ];
  
  const mockSystemStatus = {
    status: 'operational',
    uptime: '99.98%',
    latency: '120ms',
    nextMaintenance: '2023-06-15T00:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authenticated user
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      loading: false
    });
    
    // Mock successful API responses
    (dashboardService.getUserStats as jest.Mock).mockResolvedValue({
      success: true,
      data: mockStats
    });
    
    (dashboardService.getRecentActivity as jest.Mock).mockResolvedValue({
      success: true,
      data: mockActivity
    });
    
    (dashboardService.getSystemStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: mockSystemStatus
    });
  });

  it('renders dashboard with user greeting and stats', async () => {
    render(<Dashboard />);
    
    // Check for user greeting
    expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument();
    
    // Wait for stats to load
    await waitFor(() => {
      expect(dashboardService.getUserStats).toHaveBeenCalledWith('user123');
    });
    
    // Check if stats are displayed
    expect(screen.getByText(/42/)).toBeInTheDocument(); // totalSessions
    expect(screen.getByText(/3/)).toBeInTheDocument(); // activeChats
    expect(screen.getByText(/156/)).toBeInTheDocument(); // completedTasks
    expect(screen.getByText(/1.2s/)).toBeInTheDocument(); // averageResponseTime
  });

  it('renders recent activity section', async () => {
    render(<Dashboard />);
    
    // Wait for activity to load
    await waitFor(() => {
      expect(dashboardService.getRecentActivity).toHaveBeenCalledWith('user123');
    });
    
    // Check if activity items are displayed
    expect(screen.getByText(/chat with ai/i)).toBeInTheDocument();
    expect(screen.getByText(/code review/i)).toBeInTheDocument();
    expect(screen.getByText(/debugging session/i)).toBeInTheDocument();
  });

  it('renders system status information', async () => {
    render(<Dashboard />);
    
    // Wait for system status to load
    await waitFor(() => {
      expect(dashboardService.getSystemStatus).toHaveBeenCalled();
    });
    
    // Check if system status is displayed
    expect(screen.getByText(/operational/i)).toBeInTheDocument();
    expect(screen.getByText(/99.98%/)).toBeInTheDocument();
    expect(screen.getByText(/120ms/)).toBeInTheDocument();
  });

  it('shows loading state while fetching data', () => {
    // Mock loading state for all services
    (dashboardService.getUserStats as jest.Mock).mockReturnValue(new Promise(() => {}));
    (dashboardService.getRecentActivity as jest.Mock).mockReturnValue(new Promise(() => {}));
    (dashboardService.getSystemStatus as jest.Mock).mockReturnValue(new Promise(() => {}));
    
    render(<Dashboard />);
    
    // Check if loading indicators are shown
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
  });

  it('shows error message when API calls fail', async () => {
    // Mock failed API calls
    (dashboardService.getUserStats as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Failed to fetch user stats'
    });
    
    (dashboardService.getRecentActivity as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Failed to fetch activity'
    });
    
    render(<Dashboard />);
    
    // Check if error messages are displayed
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch user stats/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch activity/i)).toBeInTheDocument();
    });
  });

  it('handles refresh button click to reload dashboard data', async () => {
    render(<Dashboard />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(dashboardService.getUserStats).toHaveBeenCalledTimes(1);
      expect(dashboardService.getRecentActivity).toHaveBeenCalledTimes(1);
      expect(dashboardService.getSystemStatus).toHaveBeenCalledTimes(1);
    });
    
    // Clear mock calls
    jest.clearAllMocks();
    
    // Click refresh button
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    
    // Check if API calls were made again
    await waitFor(() => {
      expect(dashboardService.getUserStats).toHaveBeenCalledTimes(1);
      expect(dashboardService.getRecentActivity).toHaveBeenCalledTimes(1);
      expect(dashboardService.getSystemStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('redirects to login page when user is not authenticated', () => {
    // Mock unauthenticated user
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false
    });
    
    const mockPush = jest.fn();
    require('next/router').useRouter.mockReturnValue({
      push: mockPush
    });
    
    render(<Dashboard />);
    
    // Check if redirected to login page
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders activity chart component', async () => {
    render(<Dashboard />);
    
    // Wait for activity data to load
    await waitFor(() => {
      expect(dashboardService.getRecentActivity).toHaveBeenCalled();
    });
    
    // Check if chart component is rendered
    expect(screen.getByTestId('activity-chart')).toBeInTheDocument();
  });

  it('shows different dashboard for admin users', async () => {
    // Mock admin user
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { ...mockUser, role: 'admin' },
      loading: false
    });
    
    render(<Dashboard />);
    
    // Check for admin-specific elements
    await waitFor(() => {
      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/system management/i)).toBeInTheDocument();
    });
  });
});