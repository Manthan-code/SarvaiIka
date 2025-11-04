import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SidebarLogoProps {
  collapsed: boolean;
  onMobileClose?: () => void;
  showMobileClose?: boolean;
}

export function SidebarLogo({ collapsed, onMobileClose, showMobileClose }: SidebarLogoProps) {
  const { toggleSidebar } = useSidebar();
  const [isAnimating, setIsAnimating] = useState(false);
  const [rotationDirection, setRotationDirection] = useState<'left' | 'right'>('right');

  const handleLogoClick = () => {
    if (collapsed) {
      setRotationDirection('right'); // Opening - rotate right
      setIsAnimating(true);
      toggleSidebar();
    }
  };

  const handleSidebarTriggerClick = () => {
    setRotationDirection('left'); // Closing - rotate left
    setIsAnimating(true);
    toggleSidebar();
  };

  // Reset animation state after transition
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  const sparklesClasses = cn(
    "w-5 h-5 text-white transition-transform duration-500 ease-in-out",
    isAnimating && rotationDirection === 'left' && "rotate-[360deg]",
    isAnimating && rotationDirection === 'right' && "rotate-[-360deg]"
  );

  return (
    <div className="flex items-center justify-between p-4 flex-shrink-0">
      {!collapsed && (
        <div className="flex items-center gap-3">
          {/* Enhanced Application Logo */}
          <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25 transition-all duration-300 ease-in-out">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent rounded-xl" />
            <Sparkles className={sparklesClasses} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-sidebar-foreground bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent whitespace-nowrap">
              Sarva-Ika
            </h1>
            <span className="text-xs text-sidebar-foreground/60 font-medium tracking-wide whitespace-nowrap">
              Router AI
            </span>
          </div>
        </div>
      )}
      {collapsed && (
        <button
          onClick={handleLogoClick}
          className="relative w-10 h-10 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-purple-500/25 transition-all duration-300 ease-in-out cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent rounded-xl" />
          <Sparkles className={sparklesClasses} />
        </button>
      )}
      
      {/* Sidebar Trigger - only show when expanded */}
      {!collapsed && (
        <SidebarTrigger 
          className="ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200" 
          onClick={handleSidebarTriggerClick}
        />
      )}
      
      {showMobileClose && (
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-200"
          onClick={onMobileClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}