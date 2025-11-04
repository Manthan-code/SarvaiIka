import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import supabase from '@/services/supabaseClient';
import apiClient from '@/utils/apiClient';

interface BackgroundImage {
  id: string;
  name: string;
  url: string;
}

interface BackgroundContextType {
  backgroundImage: string | null;
  backgroundImageData: BackgroundImage | null;
  setBackgroundImage: (imageUrl: string | null) => void;
  setBackgroundImageById: (imageId: string | null) => void;
  isLoading: boolean;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

interface BackgroundProviderProps {
  children: React.ReactNode;
}

export const BackgroundProvider: React.FC<BackgroundProviderProps> = ({ children }) => {
  const [backgroundImage, setBackgroundImageState] = useState<string | null>(null);
  const [backgroundImageData, setBackgroundImageData] = useState<BackgroundImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  // Add debug logging for provider initialization
  useEffect(() => {
    console.log('🎨 BackgroundProvider: Initializing with user:', user?.id || 'no user');
  }, []);

  // Load user's background preference on mount and when user changes
  const userId = user?.id;
  useEffect(() => {
    
    const loadUserBackground = async () => {
      if (!userId) {
          setBackgroundImageState(null);
          setBackgroundImageData(null);
          setIsLoading(false);
          return;
        }

      try {
        const data = await apiClient.get('/api/settings');
        
        const preferences = data.preferences || {};
        
        // Handle the background image structure - check multiple sources
        let backgroundImageToUse = null;
        
        // First, check if preferences has backgroundImage (new format)
        if (preferences.backgroundImage && typeof preferences.backgroundImage === 'object') {
          backgroundImageToUse = preferences.backgroundImage;
        }
        // Second, check if root level has background_images (joined data)
        else if (data.background_images && typeof data.background_images === 'object') {
          backgroundImageToUse = data.background_images;
        }
        
        if (backgroundImageToUse) {
          setBackgroundImageData(backgroundImageToUse);
          setBackgroundImageState(backgroundImageToUse.url);
        } else if (preferences.backgroundImage && typeof preferences.backgroundImage === 'string') {
          // Legacy format: just URL string
          setBackgroundImageData(null);
          setBackgroundImageState(preferences.backgroundImage);
        } else {
          // No background image
          setBackgroundImageData(null);
          setBackgroundImageState(null);
        }
      } catch (error) {
        console.error('🎨 BackgroundContext: Failed to load background preference:', error);
        // Set defaults on error
        setBackgroundImageData(null);
        setBackgroundImageState(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserBackground();
  }, [userId]);

  const setBackgroundImageById = async (imageId: string | null) => {
    if (!user?.id) return;

    try {
      // Update the background preference using apiClient
      await apiClient.put('/api/settings', {
        preferences: {
          backgroundImage: imageId ? { id: imageId } : null,
        },
      });

      // Reload the user background to get the updated data
      const data = await apiClient.get('/api/settings');
      const preferences = data.preferences || {};
      
      // Handle the new background image structure
      if (preferences.backgroundImage && typeof preferences.backgroundImage === 'object') {
        setBackgroundImageData(preferences.backgroundImage);
        setBackgroundImageState(preferences.backgroundImage.url);
      } else {
        setBackgroundImageData(null);
        setBackgroundImageState(null);
      }
    } catch (error) {
      console.error('Failed to save background preference:', error);
      throw error;
    }
  };

  const setBackgroundImage = async (imageUrl: string | null) => {
    if (!user?.id) return;

    // Optimistically update the UI
    setBackgroundImageState(imageUrl);

    try {
      // Update the background preference using apiClient
      await apiClient.put('/api/settings', {
        preferences: {
          backgroundImage: imageUrl,
        },
      });
    } catch (error) {
      console.error('Failed to save background preference:', error);
      // Revert the optimistic update
      setBackgroundImageState(backgroundImage);
      throw error;
    }
  };

  const value = {
    backgroundImage,
    backgroundImageData,
    setBackgroundImage,
    setBackgroundImageById,
    isLoading,
  };

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  );
};

// Custom hook - exported at the end to avoid HMR issues
export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    // Add more detailed error information for debugging
    console.error('🚨 BackgroundContext: useBackground called outside of BackgroundProvider');
    console.error('🚨 Current component stack:', new Error().stack);
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
};