/**
 * Mock Auth Service
 */

const authService = {
  login: jest.fn().mockResolvedValue({
    success: true,
    data: {
      token: 'mock-token',
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user'
      }
    }
  }),
  
  signup: jest.fn().mockResolvedValue({
    success: true,
    data: {
      token: 'mock-token',
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user'
      }
    }
  }),
  
  logout: jest.fn().mockResolvedValue({
    success: true
  }),
  
  refreshToken: jest.fn().mockResolvedValue({
    success: true,
    data: {
      token: 'new-mock-token'
    }
  }),
  
  getCurrentUser: jest.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user'
    }
  }),
  
  forgotPassword: jest.fn().mockResolvedValue({
    success: true
  }),
  
  resetPassword: jest.fn().mockResolvedValue({
    success: true
  }),
  
  changePassword: jest.fn().mockResolvedValue({
    success: true
  }),
  
  verifyEmail: jest.fn().mockResolvedValue({
    success: true
  }),
  
  isAuthenticated: jest.fn().mockReturnValue(true),
  
  getToken: jest.fn().mockReturnValue('mock-token'),
  
  __resetAllMocks: () => {
    Object.keys(authService).forEach(key => {
      if (typeof authService[key] === 'function' && authService[key].mockClear) {
        authService[key].mockClear();
      }
    });
  }
};

export default authService;