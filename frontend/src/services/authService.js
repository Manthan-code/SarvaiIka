import { apiClient } from '../utils/apiClient';

const authService = {
    signup: async (email, password, name) => {
        if (!email || !password || !name) {
            throw new Error('Email, password, and name are required');
        }
        
        return apiClient.post('/api/auth/signup', 
            { email, password, name },
            { context: 'User signup' }
        );
    },

    login: async (email, password) => {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        return apiClient.post('/api/auth/login', 
            { email, password },
            { context: 'User login' }
        );
    },

    logout: async () => {
        try {
            return await apiClient.post('/api/auth/logout', 
                null,
                { context: 'User logout' }
            );
        } catch (error) {
            // Even if the server logout fails, we should still clear local state
            console.warn('Logout error:', error);
            return { success: true };
        }
    },
};

export default authService;
