import { useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Menu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
// Remove authService import - using Supabase only

// Remove useUserProfile import and use Supabase user data directly
import { getCachedSubscription, CachedSubscription } from "@/lib/localStorageUtils";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useHashRouting } from "@/hooks/useHashRouting";
import { useUserRole } from "@/hooks/useUserRole";

// Modular Components - Fixed imports (named exports)
import { SidebarLogo } from "@/components/sidebar/SidebarLogo";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { DashboardButton } from "@/components/sidebar/DashboardButton";
import { SearchChatModal } from "@/components/sidebar/SearchChatModal";
import { RecentChatsPanel } from "@/components/sidebar/RecentChatsPanel";
import { AdminMasterPanel } from "@/components/sidebar/AdminMasterPanel";
import UserProfileSection from "@/components/sidebar/UserProfileSection";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { HelpPage } from "@/pages/HelpPage";
// Add this import at the top with other imports
import Subscriptions from "@/pages/Subscriptions";

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, open, setOpen } = useSidebar();
  const sidebarCollapsed = state === "collapsed";
  
  // Debug: Track AppSidebar re-renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`🏠 AppSidebar render #${renderCount.current}`, {
    sidebarCollapsed,
    pathname: location.pathname,
    timestamp: new Date().toISOString()
  });
  
  // Hash routing
  const { currentHash, setHash, clearHash, isHashActive } = useHashRouting();
  
  // Auth state - Use Supabase session instead of authToken
  const { session, user, signOut } = useAuthStore();
  const isAuthenticated = !!user?.id; // Use user.id for stable authentication check
  const { isAdmin } = useUserRole(); // Always call hook unconditionally
  
  // Keep subscription state management as is for now
  const [subscription, setSubscription] = useState<CachedSubscription | null>(null);
  const { subscription: liveSubscription } = useSubscriptions(); // Always call hook unconditionally
  
  // Modal states
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const helpModalRef = useRef<HTMLDivElement>(null);
  
  // Load cached data on mount
  useEffect(() => {
    // Load cached subscription data
    const cachedSubscription = getCachedSubscription();
    setSubscription(cachedSubscription);
  }, []);
  
  // Update subscription when live data changes
  useEffect(() => {
    if (liveSubscription) {
      setSubscription(liveSubscription);
    }
  }, [liveSubscription]);
  
  // Memoized user data
  const userData = useMemo(() => ({
    isAuthenticated,
    user,
    subscription
  }), [isAuthenticated, user, subscription]);

  // Handle logout - Use Supabase signOut
  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      navigate("/login");
    }
  }, [signOut, navigate]);
  
  // Handle hash navigation - Memoized to prevent UserProfileSection re-renders
  const handleSettingsClick = useCallback(() => {
    setHash('settings');
  }, [setHash]);
  
  const handlePricingClick = useCallback(() => {
    setHash('pricing');
  }, [setHash]);
  
  const handleHelpClick = useCallback(() => {
    setHash('help');
  }, [setHash]);
  
  // Handle search modal
  const handleSearchClick = useCallback(() => {
    setSearchModalOpen(true);
  }, []);
  
  // Handle modal close
  const handleModalClose = useCallback(() => {
    clearHash();
  }, [clearHash]);

  // Handle ESC key for Help modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isHashActive('help')) {
        handleModalClose();
      }
    };

    if (isHashActive('help')) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isHashActive, handleModalClose]);

  // Handle click outside for Help modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (helpModalRef.current && !helpModalRef.current.contains(event.target as Node) && isHashActive('help')) {
        handleModalClose();
      }
    };

    if (isHashActive('help')) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHashActive, handleModalClose]);

  return (
    <>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarContent className="flex flex-col h-full">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Logo */}
            <div className="flex-shrink-0">
              <SidebarLogo collapsed={sidebarCollapsed} />
            </div>
            
            {/* New Chat Button - Only for non-admin users */}
            {isAuthenticated && !isAdmin && (
              <div className="flex-shrink-0 px-4 py-3">
                <NewChatButton collapsed={sidebarCollapsed} />
              </div>
            )}
            
            {/* Dashboard and Search - Only for non-admin users */}
            {isAuthenticated && !isAdmin && (
              <div className="flex-shrink-0">
                <DashboardButton 
                  collapsed={sidebarCollapsed} 
                  onSearchClick={handleSearchClick}
                />
              </div>
            )}
            
            {/* Admin Master Panel for admin users */}
            {isAuthenticated && isAdmin && (
              <SidebarGroup className="flex-1 overflow-hidden">
                <SidebarGroupLabel className="px-2 text-xs font-medium text-sidebar-foreground/70">
                  Administration
                </SidebarGroupLabel>
                <SidebarGroupContent className="h-full overflow-y-auto">
                  <AdminMasterPanel collapsed={sidebarCollapsed} />
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            
            {/* Recent Chats for regular users - Hide completely when collapsed */}
            {isAuthenticated && !isAdmin && !sidebarCollapsed && (
              <SidebarGroup className="flex-1 overflow-hidden">
                <SidebarGroupLabel className="px-2 text-xs font-medium text-sidebar-foreground/70">
                  Chats
                </SidebarGroupLabel>
                <SidebarGroupContent className="h-full overflow-y-auto">
                  <RecentChatsPanel 
                    collapsed={sidebarCollapsed} 
                    user={user}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </div>
          
          {/* User Profile Section - Now uses hash routing */}
          {isAuthenticated && (
            <UserProfileSection
              collapsed={sidebarCollapsed}
              onSettingsClick={handleSettingsClick}
            />
          )}
        </SidebarContent>
      </Sidebar>
      
      {/* Search Modal */}
      <SearchChatModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />
      
      {/* Hash-based Modals and Pages */}
      <SettingsModal
        open={isHashActive('settings')}
        onOpenChange={handleModalClose}
      />
      
      {/* Help Page Modal */}
      {isHashActive('help') && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div ref={helpModalRef} className="relative w-full max-w-6xl bg-background rounded-lg shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 z-10"
                  onClick={handleModalClose}
                >
                  <X className="h-4 w-4" />
                </Button>
                <HelpPage showCloseButton={false} />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Subscription Page Modal - Full Screen */}
      {isHashActive('subscription') && (
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-900">
          <div className="h-full w-full overflow-y-auto">
            <div className="relative h-full">
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 shadow-md"
                onClick={handleModalClose}
              >
                <X className="h-4 w-4 text-red-500 ho ver:text-red-600" />
              </Button>
              <Subscriptions />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Memoize AppSidebar to prevent unnecessary re-renders
export default memo(AppSidebar);
