import { apiClient } from '../utils/apiClient';

const profileService = {
    // Get current user profile
    getProfile: () => apiClient.get('/api/auth/profile'),
    
    // Update user profile (name, email, website)
    updateProfile: (profileData) => apiClient.put('/api/auth/profile', profileData),
    
    // Upload avatar to Cloudinary
    uploadAvatar: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'user_avatars'); // You'll need to set this in Cloudinary
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to upload avatar');
        }
        
        const data = await response.json();
        return data.secure_url;
    },
    
    // Update avatar URL in profile
    updateAvatar: (avatarUrl) => apiClient.put('/api/auth/profile', { avatar: avatarUrl }),
};

export default profileService;