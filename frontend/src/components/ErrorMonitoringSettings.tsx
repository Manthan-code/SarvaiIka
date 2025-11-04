import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { AlertCircle, Bell, Mail, Webhook, Filter, BarChart3 } from 'lucide-react';
import { errorMonitoringManager, type ErrorMonitoringConfig } from '../config/errorMonitoring';
import { notificationService } from '@/services/notificationService';

interface ErrorMonitoringSettingsProps {
  onConfigChange?: (config: ErrorMonitoringConfig) => void;
}

export const ErrorMonitoringSettings: React.FC<ErrorMonitoringSettingsProps> = ({
  onConfigChange
}) => {
  const [config, setConfig] = useState<ErrorMonitoringConfig>({
    enabled: true,
    reportingThreshold: {
      critical: 1,
      high: 3,
      medium: 10,
      low: 50
    },
    batchSize: 10,
    flushInterval: 30000,
    maxRetries: 3,
    notifications: {
      email: true,
      browser: true,
      webhook: false
    },
    sampling: {
      enabled: false,
      rate: 0.1
    },
    filters: {
      ignoreUrls: [],
      ignoreMessages: [],
      ignoreComponents: []
    }
  });

  const [stats, setStats] = useState({
    totalErrors: 0,
    reportedErrors: 0,
    errorsByType: {} as Record<string, number>
  });

  const [newFilter, setNewFilter] = useState({ type: 'url', value: '' });

  useEffect(() => {
    // Load current stats
    const currentStats = errorMonitoringManager.getErrorStats();
    setStats(currentStats);
  }, []);

  const handleConfigUpdate = (updates: Partial<ErrorMonitoringConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    errorMonitoringManager.updateConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleThresholdChange = (severity: keyof ErrorMonitoringConfig['reportingThreshold'], value: number) => {
    handleConfigUpdate({
      reportingThreshold: {
        ...config.reportingThreshold,
        [severity]: value
      }
    });
  };

  const handleNotificationChange = (type: keyof ErrorMonitoringConfig['notifications'], enabled: boolean) => {
    handleConfigUpdate({
      notifications: {
        ...config.notifications,
        [type]: enabled
      }
    });
  };

  const addFilter = () => {
    if (!newFilter.value.trim()) return;

    const filterKey = `ignore${newFilter.type.charAt(0).toUpperCase() + newFilter.type.slice(1)}s` as keyof ErrorMonitoringConfig['filters'];
    const currentFilters = config.filters[filterKey] as string[];
    
    if (!currentFilters.includes(newFilter.value)) {
      handleConfigUpdate({
        filters: {
          ...config.filters,
          [filterKey]: [...currentFilters, newFilter.value]
        }
      });
    }
    
    setNewFilter({ ...newFilter, value: '' });
  };

  const removeFilter = (type: keyof ErrorMonitoringConfig['filters'], value: string) => {
    const currentFilters = config.filters[type] as string[];
    handleConfigUpdate({
      filters: {
        ...config.filters,
        [type]: currentFilters.filter(f => f !== value)
      }
    });
  };

  const testNotifications = async () => {
    try {
      await notificationService.notifyError({
        id: 'test-error',
        message: 'This is a test notification',
        severity: 'medium',
        url: window.location.href,
        component: 'ErrorMonitoringSettings'
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const resetStats = () => {
    errorMonitoringManager.reset();
    setStats({ totalErrors: 0, reportedErrors: 0, errorsByType: {} });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Monitoring Configuration
          </CardTitle>
          <CardDescription>
            Configure automated error reporting and monitoring settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="monitoring-enabled">Enable Error Monitoring</Label>
              <p className="text-sm text-muted-foreground">
                Automatically track and report application errors
              </p>
            </div>
            <Switch
              id="monitoring-enabled"
              checked={config.enabled}
              onCheckedChange={(enabled) => handleConfigUpdate({ enabled })}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="thresholds" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reporting Thresholds</CardTitle>
              <CardDescription>
                Set how many errors of each severity level trigger a report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(config.reportingThreshold).map(([severity, threshold]) => (
                <div key={severity} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={severity === 'critical' ? 'destructive' : severity === 'high' ? 'default' : 'secondary'}>
                      {severity.toUpperCase()}
                    </Badge>
                    <span className="text-sm">Report after</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={threshold}
                      onChange={(e) => handleThresholdChange(severity as keyof ErrorMonitoringConfig['reportingThreshold'], parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">errors</span>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch-size">Batch Size</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    min="1"
                    value={config.batchSize}
                    onChange={(e) => handleConfigUpdate({ batchSize: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div>
                  <Label htmlFor="flush-interval">Flush Interval (ms)</Label>
                  <Input
                    id="flush-interval"
                    type="number"
                    min="1000"
                    value={config.flushInterval}
                    onChange={(e) => handleConfigUpdate({ flushInterval: parseInt(e.target.value) || 30000 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure how you want to be notified about errors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive error reports via email</p>
                  </div>
                </div>
                <Switch
                  checked={config.notifications.email}
                  onCheckedChange={(enabled) => handleNotificationChange('email', enabled)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <div>
                    <Label>Browser Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show desktop notifications</p>
                  </div>
                </div>
                <Switch
                  checked={config.notifications.browser}
                  onCheckedChange={(enabled) => handleNotificationChange('browser', enabled)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  <div>
                    <Label>Webhook Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send to external webhook</p>
                  </div>
                </div>
                <Switch
                  checked={config.notifications.webhook}
                  onCheckedChange={(enabled) => handleNotificationChange('webhook', enabled)}
                />
              </div>
              
              <Button onClick={testNotifications} variant="outline" className="w-full">
                Test Notifications
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Error Filters
              </CardTitle>
              <CardDescription>
                Configure which errors to ignore
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <select
                  value={newFilter.type}
                  onChange={(e) => setNewFilter({ ...newFilter, type: e.target.value })}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="url">URL</option>
                  <option value="message">Message</option>
                  <option value="component">Component</option>
                </select>
                <Input
                  placeholder={`Enter ${newFilter.type} to ignore...`}
                  value={newFilter.value}
                  onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && addFilter()}
                />
                <Button onClick={addFilter}>Add</Button>
              </div>
              
              {Object.entries(config.filters).map(([type, filters]) => (
                <div key={type}>
                  <Label className="capitalize">{type.replace('ignore', '').replace('s', '')} Filters</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(filters as string[]).map((filter, index) => (
                      <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFilter(type as keyof ErrorMonitoringConfig['filters'], filter)}>
                        {filter} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Error Statistics
              </CardTitle>
              <CardDescription>
                View error tracking statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{stats.totalErrors}</div>
                  <div className="text-sm text-muted-foreground">Total Errors</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{stats.reportedErrors}</div>
                  <div className="text-sm text-muted-foreground">Reported Errors</div>
                </div>
              </div>
              
              {Object.keys(stats.errorsByType).length > 0 && (
                <div>
                  <Label>Errors by Type</Label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(stats.errorsByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center p-2 border rounded">
                        <span className="text-sm truncate">{type}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button onClick={resetStats} variant="outline" className="w-full">
                Reset Statistics
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ErrorMonitoringSettings;