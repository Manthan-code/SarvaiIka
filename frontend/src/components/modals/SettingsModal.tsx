import { useState, useRef, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { User, Bell, Shield, Palette, Download, Edit, Camera, Trash2, Loader2, X, Monitor, Sun, Moon, Image as ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import profileService from '@/services/profileService';
import supabase from '@/services/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/hooks/useTheme';
import { useSafeBackground } from '@/hooks/useSafeBackground';

interface BackgroundImage {
  id: string;
  name: string;
  description: string;
  url: string;
  thumbnail_url?: string;
  category: string;
  tier_required: 'free' | 'plus' | 'pro';
}

type SettingsTab = 'profile' | 'notifications' | 'appearance' | 'security' | 'privacy';

const settingsTabs = [
  {
    id: 'profile' as SettingsTab,
    label: 'Profile Information',
    icon: User,
  },
  {
    id: 'notifications' as SettingsTab,
    label: 'Notifications',
    icon: Bell,
  },
  {
    id: 'appearance' as SettingsTab,
    label: 'Appearance',
    icon: Palette,
  },
  {
    id: 'security' as SettingsTab,
    label: 'Security',
    icon: Shield,
  },
  {
    id: 'privacy' as SettingsTab,
    label: 'Data & Privacy',
    icon: Download,
  },
];

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to get display name
const getDisplayName = (user: {
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
  email?: string;
} | null) => {
  if (user?.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }
  if (user?.user_metadata?.name) {
    return user.user_metadata.name;
  }
  if (user?.email) {
    return user.email.split('@')[0];
  }
  return 'User';
};

// Helper function to get initials
const getInitials = (user: {
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
  email?: string;
} | null) => {
  const displayName = getDisplayName(user);
  return displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
};

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user, setUser, session } = useAuthStore();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  // Use safe background hook to prevent context errors
  const { backgroundImage: currentBackgroundImage, setBackgroundImage, setBackgroundImageById } = useSafeBackground();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(getDisplayName(user));
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  
  // Background image states
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(null);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [open, onOpenChange]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onOpenChange]);

  const handleNameEdit = () => {
    setIsEditingName(true);
    setEditedName(getDisplayName(user));
  };

  const handleNameSave = async () => {
    if (!editedName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingName(true);
    try {
      console.log('Updating profile with data:', { name: editedName.trim() });
      console.log('Current user:', user);
      console.log('Auth token exists:', !!localStorage.getItem('authToken'));
      
      // Update profile via backend
      const response = await profileService.updateProfile({ name: editedName.trim() });
      console.log('Profile update response:', response);
      
      // Update Supabase user metadata
      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: editedName.trim(),
          name: editedName.trim()
        }
      });

      if (error) {
        console.error('Supabase user update error:', error);
        throw error;
      }

      // Update local user state
      const updatedUser = {
        ...user,
        user_metadata: {
          ...user?.user_metadata,
          full_name: editedName.trim(),
          name: editedName.trim()
        }
      };
      setUser(updatedUser);
      
      setIsEditingName(false);
      toast({
        title: "Success",
        description: "Name updated successfully",
      });
    } catch (error) {
      console.error('Error updating name:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast({
        title: "Error",
        description: `Failed to update name: ${error.response?.data?.error || error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleNameCancel = () => {
    setEditedName(getDisplayName(user));
    setIsEditingName(false);
  };

  const handleAvatarChange = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select a valid image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Upload to Cloudinary
      const avatarUrl = await profileService.uploadAvatar(file);
      
      // Update profile via backend
      await profileService.updateAvatar(avatarUrl);
      
      // Update Supabase user metadata
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl }
      });

      if (error) throw error;

      // Update local user state
      const updatedUser = {
        ...user,
        user_metadata: {
          ...user?.user_metadata,
          avatar_url: avatarUrl
        }
      };
      setUser(updatedUser);
      
      toast({
        title: "Success",
        description: "Avatar updated successfully",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarDelete = async () => {
    setIsDeletingAvatar(true);
    try {
      // Update profile via backend (remove avatar)
      await profileService.updateAvatar('');
      
      // Update Supabase user metadata
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null }
      });

      if (error) throw error;

      // Update local user state
      const updatedUser = {
        ...user,
        user_metadata: {
          ...user?.user_metadata,
          avatar_url: null
        }
      };
      setUser(updatedUser);
      
      toast({
        title: "Success",
        description: "Avatar deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast({
        title: "Error",
        description: "Failed to delete avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  // Background image functions
  const fetchBackgroundImages = async () => {
    setLoadingBackgrounds(true);
    try {
      const response = await fetch('/api/background-images', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch background images');
      }

      const data = await response.json();
      setBackgroundImages(data.images || []);
    } catch (error) {
      console.error('Error fetching background images:', error);
      toast({
        title: "Error",
        description: "Failed to load background images",
        variant: "destructive",
      });
    } finally {
      setLoadingBackgrounds(false);
    }
  };

  const fetchUserSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.background_image_id) {
          setSelectedBackgroundId(data.background_image_id);
        }
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    }
  };

  const handleBackgroundSelect = async (backgroundId: string) => {
    setSavingBackground(true);
    try {
      // Use the context function which handles the API call and state updates
      await setBackgroundImageById(backgroundId === '' ? null : backgroundId);
      
      setSelectedBackgroundId(backgroundId === '' ? null : backgroundId);
      
      toast({
        title: "Success",
        description: "Background updated successfully",
      });
    } catch (error) {
      console.error('Error saving background:', error);
      toast({
        title: "Error",
        description: "Failed to save background preference",
        variant: "destructive",
      });
    } finally {
      setSavingBackground(false);
    }
  };

  // Load background images when appearance tab is opened
  useEffect(() => {
    if (activeTab === 'appearance' && open) {
      fetchBackgroundImages();
      fetchUserSettings();
    }
  }, [activeTab, open, session]);

  // Sync selected background with context when background images are loaded
  useEffect(() => {
    if (backgroundImages.length > 0 && currentBackgroundImage) {
      const matchingImage = backgroundImages.find(img => img.url === currentBackgroundImage);
      setSelectedBackgroundId(matchingImage?.id || null);
    } else if (!currentBackgroundImage) {
      setSelectedBackgroundId(null);
    }
  }, [backgroundImages, currentBackgroundImage]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Avatar Edit Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                      disabled={isUploadingAvatar || isDeletingAvatar}
                    >
                      {isUploadingAvatar || isDeletingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={handleAvatarChange}
                      disabled={isUploadingAvatar || isDeletingAvatar}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Change Avatar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleAvatarDelete} 
                      className="text-destructive"
                      disabled={isUploadingAvatar || isDeletingAvatar || !user?.user_metadata?.avatar_url}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Avatar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Name Section */}
            <div className="space-y-2">
              <Label>Name</Label>
              <div className="flex items-center space-x-2">
                {isEditingName ? (
                  <>
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="flex-1"
                      placeholder="Enter your name"
                      disabled={isUpdatingName}
                    />
                    <Button 
                      size="sm" 
                      onClick={handleNameSave}
                      disabled={isUpdatingName || !editedName.trim()}
                    >
                      {isUpdatingName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleNameCancel}
                      disabled={isUpdatingName}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 px-3 py-2 border rounded-md bg-muted/50">
                      {getDisplayName(user)}
                    </div>
                    <Button size="sm" variant="outline" onClick={handleNameEdit}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Email Section - Non-editable */}
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/30 text-muted-foreground cursor-not-allowed">
                {user?.email || ''}
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need to update your email address.
              </p>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about chat updates
                </p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email updates about new features
                </p>
              </div>
              <Switch
                checked={emailUpdates}
                onCheckedChange={setEmailUpdates}
              />
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred theme or sync with your system
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="flex items-center gap-2 h-auto p-3 flex-col"
                >
                  <Sun className="h-4 w-4" />
                  <span className="text-xs">Light</span>
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="flex items-center gap-2 h-auto p-3 flex-col"
                >
                  <Moon className="h-4 w-4" />
                  <span className="text-xs">Dark</span>
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="flex items-center gap-2 h-auto p-3 flex-col"
                >
                  <Monitor className="h-4 w-4" />
                  <span className="text-xs">System</span>
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base">Background Images</Label>
                <p className="text-sm text-muted-foreground">
                  Choose a background image for your chat interface
                </p>
              </div>
              
              {loadingBackgrounds ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {/* Default/No background option */}
                  <div
                    className={cn(
                      "relative aspect-video rounded-lg border-2 cursor-pointer transition-all hover:scale-105",
                      selectedBackgroundId === null 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => handleBackgroundSelect('')}
                  >
                    <div className="flex items-center justify-center h-full bg-muted rounded-lg">
                      <div className="text-center">
                        <X className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Default</span>
                      </div>
                    </div>
                    {selectedBackgroundId === null && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  
                  {backgroundImages.map((bg) => (
                    <div
                      key={bg.id}
                      className={cn(
                        "relative aspect-video rounded-lg border-2 cursor-pointer transition-all hover:scale-105",
                        selectedBackgroundId === bg.id 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => handleBackgroundSelect(bg.id)}
                    >
                      <img
                        src={bg.thumbnail_url || bg.url}
                        alt={bg.name}
                        className="w-full h-full object-cover rounded-lg"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-1 left-1 right-1">
                          <p className="text-xs text-white font-medium truncate">{bg.name}</p>
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              "text-xs px-1 py-0.5 rounded text-white",
                              bg.tier_required === 'free' ? 'bg-green-600' :
                              bg.tier_required === 'pro' ? 'bg-blue-600' : 'bg-purple-600'
                            )}>
                              {bg.tier_required}
                            </span>
                          </div>
                        </div>
                      </div>
                      {selectedBackgroundId === bg.id && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      {savingBackground && selectedBackgroundId === bg.id && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Change Password</Label>
              <p className="text-sm text-muted-foreground">
                Update your password to keep your account secure.
              </p>
              <Button variant="outline">Change Password</Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account.
              </p>
              <Button variant="outline">Enable 2FA</Button>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Export Data</Label>
              <p className="text-sm text-muted-foreground">
                Download a copy of your chat history and data.
              </p>
              <Button variant="outline">Export Data</Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Delete Account</Label>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
              <Button variant="destructive">Delete Account</Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div ref={modalRef} className="relative w-full max-w-4xl bg-background rounded-lg shadow-lg border">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 z-10"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Header */}
            <div className="p-6 pb-4 border-b">
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            
            {/* Content */}
            <div className="flex gap-6 h-[60vh] p-6">
              {/* Left Sidebar Navigation */}
              <div className="w-48 flex-shrink-0 border-r pr-4">
                <nav className="space-y-1">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium rounded-md transition-colors",
                          activeTab === tab.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const currentTab = settingsTabs.find(tab => tab.id === activeTab);
                      const Icon = currentTab?.icon || User;
                      return (
                        <>
                          <Icon className="h-5 w-5" />
                          <h3 className="text-lg font-semibold">{currentTab?.label}</h3>
                        </>
                      );
                    })()}
                  </div>
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}