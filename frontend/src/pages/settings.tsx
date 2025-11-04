import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/stores/authStore';
import { User, Bell, Shield, Palette, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function Settings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [emailUpdates, setEmailUpdates] = useState(true);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and profile details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    defaultValue={user?.user_metadata?.name || user?.user_metadata?.full_name || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    defaultValue={user?.email || ''}
                    disabled
                  />
                </div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        );

      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure how you receive notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        );

      case 'appearance':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your interface.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Switch between light and dark themes
                  </p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>
            </CardContent>
          </Card>
        );

      case 'security':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your account security and privacy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        );

      case 'privacy':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Data & Privacy
              </CardTitle>
              <CardDescription>
                Manage your data and privacy preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        {/* Main Content with Sidebar Navigation */}
        <div className="flex gap-6">
          {/* Left Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
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
          <div className="flex-1">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}