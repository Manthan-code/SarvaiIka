import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface DashboardButtonProps {
  collapsed: boolean;
  onSearchClick: () => void;
}

export function DashboardButton({ collapsed, onSearchClick }: DashboardButtonProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  if (collapsed) {
    return (
      <SidebarGroup className="flex-shrink-0">
        <SidebarGroupContent>
          <div className="flex flex-col items-center gap-3 px-2">
            <NavLink to="/dashboard">
              <Button
                size="icon"
                variant={isActive("/dashboard") ? "default" : "ghost"}
                className={cn(
                  "w-12 h-12 rounded-xl transition-all duration-300 ease-in-out hover:scale-105",
                  isActive("/dashboard") 
                    ? "bg-sidebar-accent text-sidebar-primary shadow-md" 
                    : "hover:bg-sidebar-accent"
                )}
              >
                <LayoutDashboard className="h-6 w-6" />
              </Button>
            </NavLink>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSearchClick}
              className="w-12 h-12 rounded-xl transition-all duration-300 ease-in-out hover:bg-sidebar-accent hover:scale-105"
            >
              <Search className="h-6 w-6" />
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="flex-shrink-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild
              className={cn(
                "h-12 transition-all duration-300 ease-in-out hover:scale-[1.02]",
                isActive("/dashboard") && "bg-sidebar-accent text-sidebar-primary"
              )}
            >
              <NavLink to="/dashboard">
                <LayoutDashboard className="h-5 w-5" />
                <span className="font-medium">Dashboard</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={onSearchClick}
              className="h-12 transition-all duration-300 ease-in-out hover:bg-sidebar-accent hover:scale-[1.02]"
            >
              <Search className="h-5 w-5" />
              <span className="font-medium">Search Chats</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}