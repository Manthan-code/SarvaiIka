import { useAuthStore } from '../stores/authStore';
import supabase from '../services/supabaseClient';
import { authRefreshManager } from './authRefresh';

export const refreshAuthToken = async (): Promise<boolean> => {
  return await authRefreshManager.performSilentRefresh();
};

export const logout = async (): Promise<void> => {
  try {
    // Stop the refresh timer
    authRefreshManager.stopRefreshTimer();
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear all auth state and localStorage
    const { clearAuthState } = useAuthStore.getState();
    clearAuthState();
    
    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Still clear local state even if Supabase logout fails
    const { clearAuthState } = useAuthStore.getState();
    clearAuthState();
    window.location.href = '/login';
  }
};

export const isAuthenticated = (): boolean => {
  const { isAuthenticated } = useAuthStore.getState();
  return isAuthenticated();
};
