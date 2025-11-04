import backgroundImageService from '../../src/services/backgroundImageService';
import apiClient from '../../src/utils/apiClient';

describe('backgroundImageService', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockClear();
    (apiClient.post as jest.Mock).mockClear();
    (apiClient.put as jest.Mock).mockClear();
    (apiClient.delete as jest.Mock).mockClear();
    global.fetch = jest.fn();
  });

  it('getBackgroundImages calls user endpoint', async () => {
    await backgroundImageService.getBackgroundImages();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/background-images');
  });

  it('getAllBackgroundImages calls admin endpoint', async () => {
    await backgroundImageService.getAllBackgroundImages();
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/admin/background-images');
  });

  it('getBackgroundImageById calls admin endpoint with id', async () => {
    await backgroundImageService.getBackgroundImageById('img-1');
    expect((apiClient.get as jest.Mock)).toHaveBeenCalledWith('/api/admin/background-images/img-1');
  });

  it('uploadToCloudinary posts to Cloudinary and maps response', async () => {
    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });
    const mockData = {
      secure_url: 'https://cloudinary/sec.jpg',
      public_id: 'pub123',
      width: 100,
      height: 200,
      format: 'jpg',
      bytes: 12345,
    };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockData });

    const res = await backgroundImageService.uploadToCloudinary(file);
    expect(res).toEqual({
      url: mockData.secure_url,
      thumbnail_url: mockData.secure_url.replace('/upload/', '/upload/c_thumb,w_300,h_200/'),
      cloudinary_public_id: mockData.public_id,
      width: mockData.width,
      height: mockData.height,
      format: mockData.format,
      file_size: mockData.bytes,
    });

    const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
    expect((global.fetch as jest.Mock)).toHaveBeenCalledWith(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('createBackgroundImage posts imageData', async () => {
    const payload = { name: 'bg1', url: 'x' } as any;
    await backgroundImageService.createBackgroundImage(payload);
    expect((apiClient.post as jest.Mock)).toHaveBeenCalledWith('/api/admin/background-images', payload);
  });

  it('updateBackgroundImage puts imageData', async () => {
    await backgroundImageService.updateBackgroundImage('img-2', { name: 'new' } as any);
    expect((apiClient.put as jest.Mock)).toHaveBeenCalledWith('/api/admin/background-images/img-2', { name: 'new' });
  });

  it('deleteBackgroundImage deletes image', async () => {
    await backgroundImageService.deleteBackgroundImage('img-3');
    expect((apiClient.delete as jest.Mock)).toHaveBeenCalledWith('/api/admin/background-images/img-3');
  });

  it('deleteFromCloudinary returns success and logs warning', async () => {
    const res = await backgroundImageService.deleteFromCloudinary('pub-1');
    expect(res).toEqual({ success: true });
  });

  it('validateImageFile accepts valid images', () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect(backgroundImageService.validateImageFile(file)).toBe(true);
  });

  it('validateImageFile rejects invalid type', () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(() => backgroundImageService.validateImageFile(file)).toThrow('Invalid file type');
  });
});