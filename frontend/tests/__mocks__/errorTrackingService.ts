/**
 * Mock Error Tracking Service for Testing
 * Provides mock implementation of error tracking functionality
 */

const mockErrorTrackingService = {
  setUserId: jest.fn(),
  captureException: jest.fn(),
  captureError: jest.fn(),
  reportError: jest.fn().mockResolvedValue({
    success: true,
    errorId: 'mock-error-id'
  }),
  addUserFeedback: jest.fn(),
  markErrorAsResolved: jest.fn(),
  getErrorMetrics: jest.fn().mockReturnValue({
    totalErrors: 0,
    criticalErrors: 0,
    highErrors: 0,
    mediumErrors: 0,
    lowErrors: 0,
    errorsByComponent: {},
    errorsByStatusCode: {},
    dailyErrorCounts: []
  }),
  getAllErrors: jest.fn().mockReturnValue([]),
  clearErrors: jest.fn(),
  exportErrors: jest.fn().mockReturnValue('[]'),
  destroy: jest.fn()
};

export const errorTrackingService = mockErrorTrackingService;
export default mockErrorTrackingService;