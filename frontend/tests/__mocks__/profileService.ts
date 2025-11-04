/**
 * Mock Profile Service
 */

const profileService = {
  getUserProfile: jest.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      avatar: 'https://example.com/avatar.png',
      preferences: {
        theme: 'light',
        notifications: true
      },
      createdAt: '2023-01-01T00:00:00.000Z'
    }
  }),
  
  updateUserProfile: jest.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'user-123',
      name: 'Updated User',
      email: 'test@example.com'
    }
  }),
  
  updateProfilePicture: jest.fn().mockResolvedValue({
    success: true,
    data: {
      avatar: 'https://example.com/new-avatar.png'
    }
  }),
  
  getProfileSettings: jest.fn().mockResolvedValue({
    success: true,
    data: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  }),
  
  updateProfileSettings: jest.fn().mockResolvedValue({
    success: true
  }),
  
  deleteAccount: jest.fn().mockResolvedValue({
    success: true
  }),
  
  __resetAllMocks: () => {
    Object.keys(profileService).forEach(key => {
      if (typeof profileService[key] === 'function' && profileService[key].mockClear) {
        profileService[key].mockClear();
      }
    });
  }
};

export default profileService;