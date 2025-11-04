import { apiClient } from '../utils/apiClient';

export interface BackgroundImage {
    id: string;
    name: string;
    description?: string;
    url: string;
    thumbnail_url?: string;
    category: string;
    tier_required: 'free' | 'plus' | 'pro';
    is_active: boolean;
    usage_count?: number;
    file_size?: number;
    width?: number;
    height?: number;
    format?: string;
    cloudinary_public_id?: string;
    created_at: string;
    updated_at: string;
}

export interface BackgroundImageMetadata {
    name: string;
    description?: string;
    category?: string;
    tier_required?: 'free' | 'plus' | 'pro';
}

export interface CloudinaryUploadResult {
    url: string;
    thumbnail_url: string;
    cloudinary_public_id: string;
    width: number;
    height: number;
    format: string;
    file_size: number;
}

const backgroundImageService = {
    // Get all background images available to the user
    getBackgroundImages: () => apiClient.get('/api/background-images'),
    
    // Admin: Get all background images for management
    getAllBackgroundImages: (): Promise<BackgroundImage[]> => apiClient.get('/api/admin/background-images'),
    
    // Get a specific background image by ID
    getBackgroundImageById: (id: string): Promise<BackgroundImage> => {
        return apiClient.get(`/api/admin/background-images/${id}`);
    },
    
    // Upload image to Cloudinary
    uploadToCloudinary: async (file: File, onProgress?: (progress: number) => void): Promise<CloudinaryUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'user_avatars');
        formData.append('folder', 'background-images'); // Organize uploads in a folder
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to upload image to Cloudinary');
        }
        
        const data = await response.json();
        return {
            url: data.secure_url,
            thumbnail_url: data.secure_url.replace('/upload/', '/upload/c_thumb,w_300,h_200/'),
            cloudinary_public_id: data.public_id,
            width: data.width,
            height: data.height,
            format: data.format,
            file_size: data.bytes
        };
    },
    
    // Admin: Create a new background image entry
    createBackgroundImage: async (imageData: Partial<BackgroundImage>): Promise<BackgroundImage> => {
        return apiClient.post('/api/admin/background-images', imageData);
    },
    
    // Admin: Update background image
    updateBackgroundImage: (imageId: string, imageData: Partial<BackgroundImage>): Promise<BackgroundImage> => {
        return apiClient.put(`/api/admin/background-images/${imageId}`, imageData);
    },
    
    // Admin: Delete background image
    deleteBackgroundImage: (imageId: string): Promise<void> => {
        return apiClient.delete(`/api/admin/background-images/${imageId}`);
    },
    
    // Admin: Upload and create background image in one step
    uploadAndCreateBackgroundImage: async (file, metadata) => {
        try {
            // First upload to Cloudinary
            const cloudinaryData = await backgroundImageService.uploadToCloudinary(file);
            
            // Then create the database entry
            const imageData = {
                name: metadata.name,
                description: metadata.description,
                category: metadata.category || 'general',
                tier_required: metadata.tier_required || 'free',
                url: cloudinaryData.url,
                thumbnail_url: cloudinaryData.thumbnail_url,
                cloudinary_public_id: cloudinaryData.cloudinary_public_id,
                width: cloudinaryData.width,
                height: cloudinaryData.height,
                format: cloudinaryData.format,
                file_size: cloudinaryData.file_size
            };
            
            return await backgroundImageService.createBackgroundImage(imageData);
        } catch (error) {
            console.error('Error uploading and creating background image:', error);
            throw error;
        }
    },
    
    // Delete image from Cloudinary
    deleteFromCloudinary: async (publicId) => {
        try {
            // Note: Deleting from Cloudinary requires server-side implementation
            // with admin API key for security reasons
            console.warn('Cloudinary deletion should be handled server-side');
            return { success: true };
        } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
            throw error;
        }
    },
    
    // Validate image file
    validateImageFile: (file) => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP images.');
        }
        
        if (file.size > maxSize) {
            throw new Error('File size too large. Please upload images smaller than 10MB.');
        }
        
        return true;
    }
};

export default backgroundImageService;