import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type HashTab = 'settings' | 'pricing' | 'help' | 'subscription' | null;

interface HashRoutingState {
  currentHash: HashTab;
  setHash: (hash: HashTab) => void;
  clearHash: () => void;
  isHashActive: (hash: HashTab) => boolean;
}

export function useHashRouting(): HashRoutingState {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentHash, setCurrentHash] = useState<HashTab>(null);

  // Parse hash from URL
  const parseHash = useCallback((hash: string): HashTab => {
    const cleanHash = hash.replace('#', '');
    if (['settings', 'pricing', 'help', 'subscription'].includes(cleanHash)) {
      return cleanHash as HashTab;
    }
    return null;
  }, []);

  // Update hash in URL and state
  const setHash = useCallback((hash: HashTab) => {
    if (hash) {
      window.location.hash = hash;
    } else {
      // Clear hash by setting it to empty
      window.location.hash = '';
    }
    // No need to manually set state here as hashchange event will handle it
  }, []);

  // Clear hash from URL and state
  const clearHash = useCallback(() => {
    const currentPath = window.location.pathname;
    window.history.replaceState(null, '', currentPath);
    setCurrentHash(null);
  }, []);

  // Check if a specific hash is active
  const isHashActive = useCallback((hash: HashTab) => {
    return currentHash === hash;
  }, [currentHash]);

  // Listen to hash changes (browser back/forward, direct URL access)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = parseHash(window.location.hash);
      setCurrentHash(hash);
    };

    // Set initial hash from URL
    handleHashChange();

    // Listen to hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Listen to popstate for browser navigation
    window.addEventListener('popstate', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [parseHash]);

  // Update hash when location changes (route navigation)
  useEffect(() => {
    const hash = parseHash(window.location.hash);
    setCurrentHash(hash);
  }, [location, parseHash]);

  return {
    currentHash,
    setHash,
    clearHash,
    isHashActive,
  };
}