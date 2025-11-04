import profileService from '../../src/services/profileService';
import apiClient from '../../src/utils/apiClient';

describe('profileService', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockClear();
    (apiClient.put as jest.Mock).mockClear();
    global.fetch = jest.fn();
  });

  it('getProfile calls /api/auth/profile', async () => {
    await profileService.getProfile();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/auth/profile');
  });

  it('updateProfile PUTs to /api/auth/profile', async () => {
    const data = { name: 'Alice' };
    await profileService.updateProfile(data);
    expect((apiClient.put as jest.Mock)).toHaveBeenCalledWith('/api/auth/profile', data);
  });

  it('updateAvatar PUTs avatar url', async () => {
    const url = 'https://cdn/img.jpg';
    await profileService.updateAvatar(url);
    expect((apiClient.put as jest.Mock)).toHaveBeenCalledWith('/api/auth/profile', { avatar: url });
  });

  it('uploadAvatar posts to Cloudinary and returns secure_url', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const mockResponse = { ok: true, json: async () => ({ secure_url: 'https://cloudinary/secure.jpg' }) };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const url = await profileService.uploadAvatar(file);
    expect(url).toBe('https://cloudinary/secure.jpg');

    // Ensure fetch was called with the correct Cloudinary endpoint
    const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
    expect((global.fetch as jest.Mock)).toHaveBeenCalledWith(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});