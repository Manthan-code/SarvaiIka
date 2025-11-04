import axios from 'axios';
import supabase from '../services/supabaseClient';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
});

// Request interceptor - Properly handle Supabase token refresh
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      // Use getUser() which automatically refreshes expired tokens
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Auth error:', error);
        // If auth fails, don't attach token
        return config;
      }
      
      if (user) {
        // Get the fresh session after getUser() call
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
      }
    } catch (error) {
      console.error('Auth interceptor error:', error);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling 401 errors
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the session
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !session) {
          // Refresh failed, sign out and redirect
          await supabase.auth.signOut();
          window.location.href = '/login';
          return Promise.reject(error);
        }
        
        // Update the authorization header and retry the request
        originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, sign out and redirect
        await supabase.auth.signOut();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;