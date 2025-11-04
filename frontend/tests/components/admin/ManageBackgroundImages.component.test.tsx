import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ManageBackgroundImages from '@/components/admin/ManageBackgroundImages';

// Mock backgroundImageService to avoid real network calls
jest.mock('@/services/backgroundImageService', () => ({
  backgroundImageService: {
    getAllBackgroundImages: jest.fn().mockResolvedValue({ data: { images: [] } }),
    validateImageFile: jest.fn(),
    uploadAndCreateBackgroundImage: jest.fn(),
    updateBackgroundImage: jest.fn(),
    createBackgroundImage: jest.fn(),
    deleteBackgroundImage: jest.fn()
  }
}));

// Import the mocked service to control its behavior in tests
import { backgroundImageService } from '@/services/backgroundImageService';

describe('ManageBackgroundImages Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (backgroundImageService.getAllBackgroundImages as jest.Mock).mockResolvedValue({ data: { images: [] } });
  });

  it('renders heading and description after loading', async () => {
    render(<ManageBackgroundImages />);

    // Wait for the main heading (h2) to appear after initial loading completes
    const heading = await screen.findByRole('heading', { level: 2, name: /background images/i });
    expect(heading).toBeInTheDocument();

    // Description text below the heading
    expect(screen.getByText(/manage background images for user customization/i)).toBeInTheDocument();

    // There may be multiple "Add Background" buttons (header and form)
    const addButtons = screen.getAllByRole('button', { name: /add background/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error when initial fetch fails', async () => {
    (backgroundImageService.getAllBackgroundImages as jest.Mock).mockRejectedValueOnce(new Error('Fetch failed'));
    render(<ManageBackgroundImages />);

    const errorText = await screen.findByText(/fetch failed/i);
    expect(errorText).toBeInTheDocument();
  });

  it('creates a background image via URL payload', async () => {
    render(<ManageBackgroundImages />);

    // Open Add form (specifically header button)
    const addHeaderButton = await screen.findByRole('button', { name: /^add background$/i });
    fireEvent.click(addHeaderButton);

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ocean Wave' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'nature' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Beautiful ocean wave' } });
    fireEvent.change(screen.getByLabelText(/image url/i), { target: { value: 'https://example.com/ocean.jpg' } });
    fireEvent.change(screen.getByLabelText(/thumbnail url/i), { target: { value: 'https://example.com/ocean-thumb.jpg' } });
    fireEvent.change(screen.getByLabelText(/tier required/i), { target: { value: 'plus' } });
    fireEvent.change(screen.getByLabelText(/tags/i), { target: { value: 'water, sea, blue' } });

    (backgroundImageService.createBackgroundImage as jest.Mock).mockResolvedValueOnce({});

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(backgroundImageService.createBackgroundImage).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ocean Wave',
          description: 'Beautiful ocean wave',
          url: 'https://example.com/ocean.jpg',
          thumbnail_url: 'https://example.com/ocean-thumb.jpg',
          category: 'nature',
          tier_required: 'plus',
          tags: ['water', 'sea', 'blue'],
          is_active: true
        })
      );
    });
  });

  it('edits an existing image and updates it', async () => {
    (backgroundImageService.getAllBackgroundImages as jest.Mock).mockResolvedValueOnce({
      data: {
        images: [{
          id: 'img-1',
          name: 'Sunset',
          description: 'Warm sunset',
          url: 'https://example.com/sunset.jpg',
          thumbnail_url: 'https://example.com/sunset-thumb.jpg',
          category: 'nature',
          tier_required: 'free',
          is_active: true,
          tags: ['warm', 'orange'],
          usage_count: 10
        }]
      }
    });

    render(<ManageBackgroundImages />);

    // Wait for card and click Edit
    const editBtn = await screen.findByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    // Update fields
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'Sunset Updated' } });
    const tagsInput = screen.getByLabelText(/tags/i);
    fireEvent.change(tagsInput, { target: { value: 'warm, orange, red' } });

    (backgroundImageService.updateBackgroundImage as jest.Mock).mockResolvedValueOnce({});

    // Submit update
    const updateBtn = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(backgroundImageService.updateBackgroundImage).toHaveBeenCalledWith(
        'img-1',
        expect.objectContaining({
          name: 'Sunset Updated',
          tags: ['warm', 'orange', 'red'],
          is_active: true
        })
      );
    });
  });

  it('toggles image active status (hide/show)', async () => {
    (backgroundImageService.getAllBackgroundImages as jest.Mock).mockResolvedValueOnce({
      data: {
        images: [{
          id: 'img-2',
          name: 'Forest',
          description: 'Green forest',
          url: 'https://example.com/forest.jpg',
          thumbnail_url: 'https://example.com/forest-thumb.jpg',
          category: 'nature',
          tier_required: 'free',
          is_active: true,
          tags: ['green']
        }]
      }
    });

    render(<ManageBackgroundImages />);

    const hideBtn = await screen.findByRole('button', { name: /hide/i });
    (backgroundImageService.updateBackgroundImage as jest.Mock).mockResolvedValueOnce({});
    fireEvent.click(hideBtn);

    await waitFor(() => {
      expect(backgroundImageService.updateBackgroundImage).toHaveBeenCalledWith(
        'img-2', expect.objectContaining({ is_active: false })
      );
    });
  });

  it('deletes an image when confirmed', async () => {
    (backgroundImageService.getAllBackgroundImages as jest.Mock).mockResolvedValueOnce({
      data: {
        images: [{
          id: 'img-3',
          name: 'City',
          description: 'Urban city',
          url: 'https://example.com/city.jpg',
          thumbnail_url: 'https://example.com/city-thumb.jpg',
          category: 'urban',
          tier_required: 'plus',
          is_active: true,
          tags: ['urban']
        }]
      }
    });

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ManageBackgroundImages />);

    const deleteBtn = await screen.findByRole('button', { name: /delete/i });
    (backgroundImageService.deleteBackgroundImage as jest.Mock).mockResolvedValueOnce({});
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(backgroundImageService.deleteBackgroundImage).toHaveBeenCalledWith('img-3');
      expect(confirmSpy).toHaveBeenCalled();
    });
  });

  it('uploads a file and creates background image (Upload & Create)', async () => {
    const { container } = render(<ManageBackgroundImages />);
  
    // Open Add form (specifically header button)
    const addHeaderButton = await screen.findByRole('button', { name: /^add background$/i });
    fireEvent.click(addHeaderButton);
  
    // Wait for the file input to be present
    await waitFor(() => {
      const fi = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fi).toBeTruthy();
    });
  
    // Find the file input within the same rendered container
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
  
    const file = new File(['filecontent'], 'cool.png', { type: 'image/png' });
    (backgroundImageService.validateImageFile as jest.Mock).mockImplementation(() => {});
  
    fireEvent.change(fileInput, { target: { files: [file] } });
  
    // Ensure other fields minimally filled
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Cool Image' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'general' } });
    fireEvent.change(screen.getByLabelText(/tier required/i), { target: { value: 'free' } });
  
    (backgroundImageService.uploadAndCreateBackgroundImage as jest.Mock).mockResolvedValueOnce({});
  
    const uploadCreateBtn = screen.getByRole('button', { name: /upload & create/i });
    fireEvent.click(uploadCreateBtn);
  
    await waitFor(() => {
      expect(backgroundImageService.uploadAndCreateBackgroundImage).toHaveBeenCalledWith(
        file,
        expect.objectContaining({ name: 'Cool Image', category: 'general', tier_required: 'free' })
      );
    });
  });

  it('shows error when upload fails', async () => {
    const { container } = render(<ManageBackgroundImages />);
  
    const addHeaderButton = await screen.findByRole('button', { name: /^add background$/i });
    fireEvent.click(addHeaderButton);
  
    // Wait for the file input to be present
    await waitFor(() => {
      const fi = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fi).toBeTruthy();
    });
  
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['filecontent'], 'bad.png', { type: 'image/png' });
  
    (backgroundImageService.validateImageFile as jest.Mock).mockImplementation(() => {});
    fireEvent.change(fileInput, { target: { files: [file] } });
  
    (backgroundImageService.uploadAndCreateBackgroundImage as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));
  
    const uploadCreateBtn = screen.getByRole('button', { name: /upload & create/i });
    fireEvent.click(uploadCreateBtn);
  
    const err = await screen.findByText(/upload failed/i);
    expect(err).toBeInTheDocument();
  });
});