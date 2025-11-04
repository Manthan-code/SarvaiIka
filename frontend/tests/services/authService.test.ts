import authService from '@/services/authService';
import { apiClient } from '@/utils/apiClient';

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('calls apiClient.post with correct payload and context', async () => {
      const email = 'user@example.com';
      const password = 'StrongP@ssw0rd';
      const name = 'Test User';

      const res = await authService.signup(email, password, name);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/signup',
        { email, password, name },
        { context: 'User signup' }
      );

      expect(res).toBeDefined();
      expect(res.status).toBe(201);
      expect(res.data).toEqual(expect.objectContaining({ message: expect.any(String) }));
    });

    it('throws error when required fields are missing', async () => {
      await expect(authService.signup('', 'pass', 'name')).rejects.toThrow('Email, password, and name are required');
      await expect(authService.signup('email', '', 'name')).rejects.toThrow('Email, password, and name are required');
      await expect(authService.signup('email', 'pass', '')).rejects.toThrow('Email, password, and name are required');
    });
  });

  describe('login', () => {
    it('calls apiClient.post and returns token on success', async () => {
      const email = 'user@example.com';
      const password = 'StrongP@ssw0rd';

      const res = await authService.login(email, password);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/login',
        { email, password },
        { context: 'User login' }
      );

      expect(res).toBeDefined();
      expect(res.status).toBe(200);
      expect(res.data).toEqual(expect.objectContaining({ token: 'mock-jwt-token' }));
    });

    it('throws error when email or password is missing', async () => {
      await expect(authService.login('', 'pass')).rejects.toThrow('Email and password are required');
      await expect(authService.login('email', '')).rejects.toThrow('Email and password are required');
    });
  });

  describe('logout', () => {
    it('calls apiClient.post with correct context', async () => {
      const res = await authService.logout();

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/logout',
        null,
        { context: 'User logout' }
      );

      expect(res).toBeDefined();
    });

    it('returns { success: true } when apiClient.post rejects', async () => {
      (apiClient.post as jest.Mock).mockImplementationOnce(() => apiClient.mockError(500, 'Logout failed'));

      const res = await authService.logout();

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/logout',
        null,
        { context: 'User logout' }
      );

      expect(res).toEqual({ success: true });
    });
  });
});