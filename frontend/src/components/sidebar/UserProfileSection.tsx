import React, { useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { clearUserRoleCache, useUserRole } from "@/hooks/useUserRole";
import { capitalizePlanName } from "@/utils/planUtils";
import { useNavigate } from "react-router-dom";
import { useHashRouting } from "@/hooks/useHashRouting";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Settings, 
  LogOut, 
  CreditCard, 
  ChevronUp,
  HelpCircle, 
  Receipt,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileSectionProps {
  collapsed: boolean;
  onSettingsClick: () => void;
}

function UserProfileSection({ collapsed, onSettingsClick }: UserProfileSectionProps) {
  const { user, session, signOut } = useAuthStore();
  const navigate = useNavigate();
  const { setHash } = useHashRouting();
  const isAuthenticated = !!user?.id;
  const { refreshProfile, error, profile } = useUserRole();

  // Memoized animation variants to prevent re-creation
  const containerVariants: Variants = useMemo(() => ({
    collapsed: {
      width: "auto",
      transition: { duration: 0.3, ease: "easeInOut" }
    },
    expanded: {
      width: "auto", 
      transition: { duration: 0.3, ease: "easeInOut" }
    }
  }), []);

  const contentVariants: Variants = useMemo(() => ({
    collapsed: {
      opacity: 1,
      width: "auto"
    },
    expanded: {
      opacity: 1,
      width: "auto"
    }
  }), []);

  const textVariants: Variants = useMemo(() => ({
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { delay: 0.1, duration: 0.2 }
    }
  }), []);

  const iconVariants: Variants = useMemo(() => ({
    hidden: { opacity: 0, rotate: -90 },
    visible: { 
      opacity: 1, 
      rotate: 0,
      transition: { delay: 0.2, duration: 0.2 }
    }
  }), []);

  // Debug: Track re-renders and prop changes
  const renderCount = useRef(0);
  const prevProps = useRef({ collapsed, onSettingsClick });
  renderCount.current += 1;

  useEffect(() => {
    const currentProps = { collapsed, onSettingsClick };
    const propsChanged = {
      collapsed: prevProps.current.collapsed !== collapsed,
      onSettingsClick: prevProps.current.onSettingsClick !== onSettingsClick,
    };
    
    // Temporarily re-enabling for deep analysis
    console.log(`🔄 UserProfileSection render #${renderCount.current}`, {
      collapsed,
      userId: user?.id,
      hasSession: !!session,
      sessionToken: session?.access_token ? 'present' : 'missing',
      isAuthenticated,
      profileError: error,
      propsChanged,
      timestamp: new Date().toISOString()
    });
    
    prevProps.current = currentProps;
  }, [collapsed, onSettingsClick, user?.id, session, isAuthenticated, error]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleSubscriptionClick = () => {
    setHash('subscription');
  };

  const handleHelpClick = () => {
    setHash('help');
  };

  const handleTransactionHistoryClick = () => {
    navigate('/transactions');
  };

  const handleRefreshProfile = async () => {
    try {
      clearUserRoleCache();
      await refreshProfile();
      // Force a page refresh to update the UI
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const userInitials = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <motion.div
      key="user-profile-container"
      className="p-2 border-t border-sidebar-border"
      variants={containerVariants}
      initial={false}
      animate={collapsed ? "collapsed" : "expanded"}
    >
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.div
            key="collapsed"
            variants={contentVariants}
            initial="collapsed"
            animate="collapsed"
            exit="collapsed"
            className="flex justify-center"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button variant="ghost" className="w-12 h-12 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700 text-white font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuItem onClick={onSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSubscriptionClick}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscription
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTransactionHistoryClick}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Transaction History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleHelpClick}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefreshProfile}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            variants={contentVariants}
            initial="expanded"
            animate="expanded"
            exit="expanded"
            className="overflow-hidden"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="ghost" className="w-full justify-start gap-3 h-12 hover:bg-gray-100 dark:hover:bg-[#242424] transition-colors duration-200 hover:rounded-xl">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700 text-white font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <motion.div
                      key="user-text-content"
                      className="flex-1 min-w-0 text-left"
                      variants={textVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <span className="text-sm font-medium text-sidebar-foreground truncate whitespace-nowrap">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </span>
                      {profile?.subscription_plan && (
                        <span className="block text-xs text-sidebar-foreground/60 truncate">
                          {capitalizePlanName(profile.subscription_plan)}
                        </span>
                      )}
                      {error && (
                        <span className="text-xs text-red-500 truncate whitespace-nowrap block">
                          Profile error: {error}
                        </span>
                      )}
                    </motion.div>
                    <motion.div
                      key="chevron-icon"
                      className="flex-shrink-0"
                      variants={iconVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <ChevronUp className="w-4 h-4 text-sidebar-foreground/60" />
                    </motion.div>
                  </Button>
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuItem onClick={onSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSubscriptionClick}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscription
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleHelpClick}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefreshProfile}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Optimized comparison function for React.memo
const arePropsEqual = (prevProps: UserProfileSectionProps, nextProps: UserProfileSectionProps) => {
  // Only re-render if collapsed state actually changes
  // onSettingsClick should be stable (memoized in parent)
  return prevProps.collapsed === nextProps.collapsed &&
         prevProps.onSettingsClick === nextProps.onSettingsClick;
};

export default React.memo(UserProfileSection, arePropsEqual);