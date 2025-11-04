import { useBackground } from '@/contexts/BackgroundContext';

// Safe wrapper for useBackground that provides fallback values
export const useSafeBackground = () => {
  try {
    return useBackground();
  } catch (error) {
    // If useBackground throws an error (context not found), provide safe fallback values
    console.warn('🚨 useSafeBackground: BackgroundProvider not found, using fallback values');
    console.warn('🚨 Error:', error);
    
    return {
      backgroundImage: null,
      backgroundImageData: null,
      setBackgroundImage: async () => {
        console.warn('🚨 setBackgroundImage called outside BackgroundProvider');
      },
      setBackgroundImageById: async () => {
        console.warn('🚨 setBackgroundImageById called outside BackgroundProvider');
      },
      isLoading: false,
    };
  }
};