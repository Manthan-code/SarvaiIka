/**
 * Mock Notification Service
 * This mock implements all methods of the notification service with appropriate return values
 */

const notificationService = {
  // Core notification methods
  showNotification: jest.fn().mockResolvedValue({ success: true }),
  showSuccess: jest.fn().mockImplementation((message) => {
    return Promise.resolve({ success: true, message });
  }),
  showError: jest.fn().mockImplementation((message) => {
    return Promise.resolve({ success: true, message });
  }),
  showWarning: jest.fn().mockImplementation((message) => {
    return Promise.resolve({ success: true, message });
  }),
  showInfo: jest.fn().mockImplementation((message) => {
    return Promise.resolve({ success: true, message });
  }),
  
  // Toast notifications
  toast: jest.fn().mockImplementation((options) => {
    return { id: 'mock-toast-id', ...options };
  }),
  
  // Notification management
  dismissNotification: jest.fn().mockResolvedValue({ success: true }),
  dismissAll: jest.fn().mockResolvedValue({ success: true }),
  
  // Notification preferences
  getPreferences: jest.fn().mockResolvedValue({
    success: true,
    data: {
      enableToasts: true,
      enableSounds: true,
      enableBrowserNotifications: false,
      notificationDuration: 5000
    }
  }),
  
  updatePreferences: jest.fn().mockImplementation((preferences) => {
    return Promise.resolve({ success: true, data: preferences });
  }),
  
  // Notification history
  getNotificationHistory: jest.fn().mockResolvedValue({
    success: true,
    data: []
  }),
  
  clearHistory: jest.fn().mockResolvedValue({ success: true }),
  
  // Utility methods
  markAsRead: jest.fn().mockImplementation((id) => {
    return Promise.resolve({ success: true, id });
  }),
  
  markAllAsRead: jest.fn().mockResolvedValue({ success: true }),
  
  getUnreadCount: jest.fn().mockResolvedValue({
    success: true,
    data: 0
  }),
  
  // Reset all mocks for testing
  __resetAllMocks: () => {
    Object.keys(notificationService).forEach(key => {
      if (typeof notificationService[key] === 'function' && notificationService[key].mockClear) {
        notificationService[key].mockClear();
      }
    });
  }
};

export default notificationService;