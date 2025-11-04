import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

interface AnimatedLoadingPageProps {
  onLoadingComplete?: () => void;
  duration?: number; // Duration in milliseconds (default: 1500ms)
  className?: string;
}

const AnimatedLoadingPage: React.FC<AnimatedLoadingPageProps> = ({
  onLoadingComplete,
  duration = 1500,
  className
}) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showContent, setShowContent] = useState(true);

  useEffect(() => {
    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Accelerating progress curve for natural feel
        const increment = prev < 50 ? 2 : prev < 80 ? 3 : 5;
        return Math.min(prev + increment, 100);
      });
    }, duration / 50);

    // Complete loading after duration
    const completeTimer = setTimeout(() => {
      setIsComplete(true);
      
      // Fade out animation
      setTimeout(() => {
        setShowContent(false);
        onLoadingComplete?.();
      }, 300);
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(completeTimer);
    };
  }, [duration, onLoadingComplete]);

  if (!showContent) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800",
        "transition-opacity duration-300",
        isComplete ? "opacity-0" : "opacity-100",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-8">
        {/* Logo/Brand Section */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            {/* Animated logo placeholder - replace with your actual logo */}
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg 
                className="w-7 h-7 text-white animate-pulse" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z" 
                />
              </svg>
            </div>
            
            {/* Pulsing ring animation */}
            <div className="absolute inset-0 rounded-xl border-2 border-blue-400 animate-ping opacity-20"></div>
          </div>
          
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI Agent Platform
          </div>
        </div>

        {/* Loading Animation */}
        <div className="flex flex-col items-center space-y-6">
          {/* Spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 dark:border-gray-600 rounded-full animate-spin border-t-blue-600 dark:border-t-blue-400"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-pulse border-t-indigo-400 opacity-60"></div>
          </div>

          {/* Progress Bar */}
          <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="h-full bg-white opacity-30 animate-pulse"></div>
            </div>
          </div>

          {/* Loading Text */}
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {progress < 30 ? 'Initializing...' : 
               progress < 60 ? 'Loading your workspace...' : 
               progress < 90 ? 'Almost ready...' : 
               'Welcome!'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Setting up your AI-powered experience
            </p>
          </div>
        </div>

        {/* Floating Elements Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "absolute w-2 h-2 bg-blue-400 dark:bg-blue-300 rounded-full opacity-20",
                "animate-bounce"
              )}
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 2) * 40}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimatedLoadingPage;