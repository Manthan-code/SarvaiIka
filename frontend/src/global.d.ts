declare global {
  interface Window {
    refreshSidebar: (forceRefresh?: boolean) => Promise<void>;
  }
}

export {};