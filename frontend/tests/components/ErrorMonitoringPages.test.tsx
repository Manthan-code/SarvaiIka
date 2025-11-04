import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorDashboard from '@/components/ErrorDashboard';
import ErrorFeedbackForm from '@/components/ErrorFeedbackForm';

jest.mock('@/services/errorApiService', () => {
  const mock = {
    reportError: jest.fn().mockResolvedValue({ success: true, errorId: 'test-id', message: 'ok' }),
    getErrors: jest.fn().mockResolvedValue({ errors: [], pagination: { page: 1, limit: 100, total: 0 } }),
    getErrorMetrics: jest.fn().mockResolvedValue({
      totalErrors: 0,
      recentErrors: [],
      last24Hours: 0,
      last7Days: 0,
      errorsByStatus: {},
      errorsBySeverity: {},
      errorsByComponent: {},
      dailyTrends: [
        { date: '2024-01-01', count: 0 },
        { date: '2024-01-02', count: 0 }
      ],
      resolutionRate: 0
    }),
    clearAllErrors: jest.fn().mockResolvedValue({ success: true, message: 'cleared' }),
    resolveError: jest.fn().mockResolvedValue({ success: true, message: 'resolved' }),
    submitFeedback: jest.fn().mockResolvedValue({ success: true })
  };
  return { errorApiService: mock, default: mock };
});

jest.mock('@/services/errorTrackingService', () => ({
  errorTrackingService: {
    getErrorMetrics: jest.fn().mockResolvedValue({ totalErrors: 0, criticalErrors: 0, resolutionRate: 0 }),
    refreshData: jest.fn().mockResolvedValue(true)
  }
}));

describe('Error monitoring pages', () => {
  it('renders ErrorDashboard', async () => {
    render(<ErrorDashboard />);
    expect(await screen.findByText(/error monitoring dashboard/i)).toBeInTheDocument();
    // Try clicking refresh if present
    const refresh = screen.queryByRole('button', { name: /refresh/i });
    if (refresh) fireEvent.click(refresh);
  });

  it('submits ErrorFeedbackForm', async () => {
    render(<ErrorFeedbackForm />);
    const input = screen.getByPlaceholderText(/describe the issue/i);
    fireEvent.change(input, { target: { value: 'Test issue' } });
    fireEvent.click(screen.getByText(/submit feedback/i));
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });
});