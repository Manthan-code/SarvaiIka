import { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Image, Settings, BarChart3, Shield, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface AdminMasterPanelProps {
  collapsed: boolean;
}

interface AdminMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description?: string;
}

const adminMenuItems: AdminMenuItem[] = [
  {
    id: 'users',
    label: 'Manage Users',
    icon: Users,
    path: '/admin/users',
    description: 'User management and roles'
  },
  {
    id: 'backgrounds',
    label: 'Background Images',
    icon: Image,
    path: '/admin/background-images',
    description: 'Manage chat backgrounds'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    path: '/admin/analytics',
    description: 'Usage and performance metrics'
  },
  {
    id: 'system',
    label: 'System Settings',
    icon: Settings,
    path: '/admin/system',
    description: 'Platform configuration'
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    path: '/admin/security',
    description: 'Security and access control'
  },
  {
    id: 'database',
    label: 'Database',
    icon: Database,
    path: '/admin/database',
    description: 'Database management'
  }
];

export function AdminMasterPanel({ collapsed }: AdminMasterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();

  const handleItemClick = (path: string) => {
    navigate(path);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <div className="flex flex-col gap-1">
          {adminMenuItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                className="w-10 h-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                onClick={() => handleItemClick(item.path)}
                title={item.label}
              >
                <Icon className="w-4 h-4 text-sidebar-foreground" />
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={toggleExpanded}
            className="group/admin-master w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-medium text-sidebar-foreground">Admin Master</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ChevronRight className="w-4 h-4 text-sidebar-foreground/60" />
            </motion.div>
          </SidebarMenuButton>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <SidebarMenuSub>
                  {adminMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          onClick={() => handleItemClick(item.path)}
                          className="group/admin-item w-full justify-start gap-3 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                        >
                          <Icon className="w-4 h-4 text-sidebar-foreground/70 group-hover/admin-item:text-primary transition-colors duration-200" />
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium text-sidebar-foreground group-hover/admin-item:text-primary transition-colors duration-200">
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="text-xs text-sidebar-foreground/60 group-hover/admin-item:text-sidebar-foreground/80 transition-colors duration-200">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}