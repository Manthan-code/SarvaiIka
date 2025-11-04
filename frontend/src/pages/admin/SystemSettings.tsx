import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RefreshCw, Database, Shield, Globe, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SystemConfig {
  // General Settings
  site_name: string;
  site_description: string;
  maintenance_mode: boolean;
  registration_enabled: boolean;
  max_users: number;
  
  // Chat Settings
  max_chat_history: number;
  default_model: string;
  rate_limit_per_minute: number;
  max_message_length: number;
  
  // Security Settings
  session_timeout: number;
  password_min_length: number;
  require_email_verification: boolean;
  enable_2fa: boolean;
  
  // Performance Settings
  cache_ttl: number;
  max_concurrent_requests: number;
  database_pool_size: number;
  
  // Feature Flags
  enable_background_images: boolean;
  enable_subscriptions: boolean;
  enable_analytics: boolean;
  enable_file_uploads: boolean;
}

const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({
    site_name: '',
    site_description: '',
    maintenance_mode: false,
    registration_enabled: true,
    max_users: 10000,
    max_chat_history: 100,
    default_model: 'gemini-1.5-flash',
    rate_limit_per_minute: 60,
    max_message_length: 4000,
    session_timeout: 24,
    password_min_length: 8,
    require_email_verification: true,
    enable_2fa: false,
    cache_ttl: 3600,
    max_concurrent_requests: 100,
    database_pool_size: 10,
    enable_background_images: true,
    enable_subscriptions: true,
    enable_analytics: true,
    enable_file_uploads: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemStats, setSystemStats] = useState({
    total_users: 0,
    active_sessions: 0,
    total_chats: 0,
    database_size: '0 MB',
    uptime: '0 days',
    memory_usage: '0%',
    cpu_usage: '0%'
  });

  useEffect(() => {
    fetchSystemConfig();
    fetchSystemStats();
  }, []);

  const fetchSystemConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/system/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch system config');
      }
      
      const data = await response.json();
      setConfig({ ...config, ...data.config });
    } catch (error) {
      console.error('Error fetching system config:', error);
      toast.error('Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const response = await fetch('/api/admin/system/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch system stats');
      }
      
      const data = await response.json();
      setSystemStats(data.stats);
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/system/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save system config');
      }
      
      toast.success('System configuration saved successfully');
    } catch (error) {
      console.error('Error saving system config:', error);
      toast.error('Failed to save system configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRestartSystem = async () => {
    if (!confirm('Are you sure you want to restart the system? This will temporarily interrupt service.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/system/restart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to restart system');
      }
      
      toast.success('System restart initiated');
    } catch (error) {
      console.error('Error restarting system:', error);
      toast.error('Failed to restart system');
    }
  };

  const updateConfig = (key: keyof SystemConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide settings and monitor performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={fetchSystemStats}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Stats
          </Button>
          <Button onClick={handleSaveConfig} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Users</p>
                <p className="text-2xl font-bold">{systemStats.total_users}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Sessions</p>
                <p className="text-2xl font-bold">{systemStats.active_sessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Total Chats</p>
                <p className="text-2xl font-bold">{systemStats.total_chats}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">System Uptime</p>
                <p className="text-2xl font-bold">{systemStats.uptime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="chat">Chat Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic site configuration and user management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="site_name">Site Name</Label>
                <Input
                  id="site_name"
                  value={config.site_name}
                  onChange={(e) => updateConfig('site_name', e.target.value)}
                  placeholder="AI Agent Platform"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site_description">Site Description</Label>
                <Textarea
                  id="site_description"
                  value={config.site_description}
                  onChange={(e) => updateConfig('site_description', e.target.value)}
                  placeholder="Your AI-powered conversation platform"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">Temporarily disable access to the platform</p>
                </div>
                <Switch
                  checked={config.maintenance_mode}
                  onCheckedChange={(checked) => updateConfig('maintenance_mode', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Registration Enabled</Label>
                  <p className="text-sm text-muted-foreground">Allow new users to register</p>
                </div>
                <Switch
                  checked={config.registration_enabled}
                  onCheckedChange={(checked) => updateConfig('registration_enabled', checked)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_users">Maximum Users</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={config.max_users}
                  onChange={(e) => updateConfig('max_users', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chat Configuration</CardTitle>
              <CardDescription>Settings for chat functionality and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="max_chat_history">Max Chat History</Label>
                <Input
                  id="max_chat_history"
                  type="number"
                  value={config.max_chat_history}
                  onChange={(e) => updateConfig('max_chat_history', parseInt(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="default_model">Default AI Model</Label>
                <Select value={config.default_model} onValueChange={(value) => updateConfig('default_model', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    <SelectItem value="gemini-1.0-pro">Gemini 1.0 Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rate_limit">Rate Limit (per minute)</Label>
                <Input
                  id="rate_limit"
                  type="number"
                  value={config.rate_limit_per_minute}
                  onChange={(e) => updateConfig('rate_limit_per_minute', parseInt(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_message_length">Max Message Length</Label>
                <Input
                  id="max_message_length"
                  type="number"
                  value={config.max_message_length}
                  onChange={(e) => updateConfig('max_message_length', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Authentication and security configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="session_timeout">Session Timeout (hours)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  value={config.session_timeout}
                  onChange={(e) => updateConfig('session_timeout', parseInt(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password_min_length">Minimum Password Length</Label>
                <Input
                  id="password_min_length"
                  type="number"
                  value={config.password_min_length}
                  onChange={(e) => updateConfig('password_min_length', parseInt(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Email Verification</Label>
                  <p className="text-sm text-muted-foreground">Users must verify their email before accessing the platform</p>
                </div>
                <Switch
                  checked={config.require_email_verification}
                  onCheckedChange={(checked) => updateConfig('require_email_verification', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Allow users to enable 2FA for their accounts</p>
                </div>
                <Switch
                  checked={config.enable_2fa}
                  onCheckedChange={(checked) => updateConfig('enable_2fa', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Settings</CardTitle>
              <CardDescription>System performance and resource management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="cache_ttl">Cache TTL (seconds)</Label>
                <Input
                  id="cache_ttl"
                  type="number"
                  value={config.cache_ttl}
                  onChange={(e) => updateConfig('cache_ttl', parseInt(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_concurrent">Max Concurrent Requests</Label>
                <Input
                  id="max_concurrent"
                  type="number"
                  value={config.max_concurrent_requests}
                  onChange={(e) => updateConfig('max_concurrent_requests', parseInt(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="db_pool_size">Database Pool Size</Label>
                <Input
                  id="db_pool_size"
                  type="number"
                  value={config.database_pool_size}
                  onChange={(e) => updateConfig('database_pool_size', parseInt(e.target.value))}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Current Performance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Memory Usage</p>
                    <p className="font-medium">{systemStats.memory_usage}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPU Usage</p>
                    <p className="font-medium">{systemStats.cpu_usage}</p>
                  </div>
                </div>
              </div>
              <Button variant="destructive" onClick={handleRestartSystem} className="w-full">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Restart System
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Enable or disable platform features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Background Images</Label>
                  <p className="text-sm text-muted-foreground">Allow users to customize chat backgrounds</p>
                </div>
                <Switch
                  checked={config.enable_background_images}
                  onCheckedChange={(checked) => updateConfig('enable_background_images', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Subscriptions</Label>
                  <p className="text-sm text-muted-foreground">Enable subscription tiers and billing</p>
                </div>
                <Switch
                  checked={config.enable_subscriptions}
                  onCheckedChange={(checked) => updateConfig('enable_subscriptions', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Analytics</Label>
                  <p className="text-sm text-muted-foreground">Collect usage analytics and metrics</p>
                </div>
                <Switch
                  checked={config.enable_analytics}
                  onCheckedChange={(checked) => updateConfig('enable_analytics', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>File Uploads</Label>
                  <p className="text-sm text-muted-foreground">Allow users to upload files in chats</p>
                </div>
                <Switch
                  checked={config.enable_file_uploads}
                  onCheckedChange={(checked) => updateConfig('enable_file_uploads', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemSettings;