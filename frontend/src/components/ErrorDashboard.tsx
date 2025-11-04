import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { errorTrackingService } from '@/services/errorTrackingService';
import { errorApiService, ErrorReport, ErrorMetrics } from '@/services/errorApiService';

const ErrorDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
  const [allErrors, setAllErrors] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [errorsResponse, metricsData] = await Promise.all([
        errorApiService.getErrors({ limit: 100 }),
        errorApiService.getErrorMetrics()
      ]);
      setAllErrors(errorsResponse.errors);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load error data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearErrors = async () => {
    if (confirm('Are you sure you want to clear all error data? This action cannot be undone.')) {
      try {
        await errorApiService.clearAllErrors();
        await loadData();
      } catch (error) {
        console.error('Failed to clear errors:', error);
      }
    }
  };

  const handleExportErrors = () => {
    const data = errorTrackingService.exportErrors();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleMarkResolved = async (errorId: string) => {
    try {
      await errorApiService.resolveError(errorId, 'Manually resolved from dashboard');
      await loadData();
    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusCodeColor = (statusCode?: number) => {
    if (!statusCode) return 'secondary';
    if (statusCode >= 500) return 'destructive';
    if (statusCode >= 400) return 'default';
    return 'secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading error data...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load error tracking data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Error Monitoring Dashboard</h2>
          <p className="text-gray-600">Track and analyze application errors</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleExportErrors} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleClearErrors} variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalErrors}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Types</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(metrics.errorsByStatus).length}</div>
            <p className="text-xs text-muted-foreground">Unique status codes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Trend</CardTitle>
            {metrics.dailyTrends.length > 1 && 
             metrics.dailyTrends[metrics.dailyTrends.length - 1].count > 
             metrics.dailyTrends[metrics.dailyTrends.length - 2].count ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.dailyTrends[metrics.dailyTrends.length - 1]?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Errors today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allErrors.length > 0 
                ? Math.round((allErrors.filter(e => e.resolved).length / allErrors.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Resolved errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Errors</TabsTrigger>
          <TabsTrigger value="trends">Error Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Latest error reports from your application</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.recentErrors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No recent errors found. Great job!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.recentErrors.map((error) => (
                    <div 
                      key={error.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedError(error)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {error.statusCode && (
                              <Badge variant={getStatusCodeColor(error.statusCode)}>
                                {error.statusCode}
                              </Badge>
                            )}
                            <Badge variant={getSeverityColor(error.severity)}>
                              {error.severity}
                            </Badge>
                            {error.resolved ? (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600">
                                <XCircle className="h-3 w-3 mr-1" />
                                Open
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium">{error.message}</h4>
                          <p className="text-sm text-gray-600 mt-1">{error.details}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(error.timestamp).toLocaleString()}
                            </span>
                            {error.component && (
                              <span>Component: {error.component}</span>
                            )}
                          </div>
                        </div>
                        {!error.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkResolved(error.id);
                            }}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Trends</CardTitle>
              <CardDescription>Error frequency over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.dailyTrends.map((trend, index) => (
                  <div key={trend.date} className="flex items-center justify-between py-2">
                    <span className="text-sm">{new Date(trend.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="bg-blue-200 h-4 rounded"
                        style={{ width: `${Math.max(trend.count * 10, 4)}px` }}
                      />
                      <span className="text-sm font-medium w-8">{trend.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Errors by Status Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(metrics.errorsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={getStatusCodeColor(parseInt(status))}>
                        {status}
                      </Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Errors by Component</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(metrics.errorsByComponent).map(([component, count]) => (
                    <div key={component} className="flex items-center justify-between">
                      <span className="text-sm">{component}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Error Details</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedError(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Error ID</label>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">{selectedError.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Timestamp</label>
                  <p className="text-sm">{new Date(selectedError.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status Code</label>
                  <p className="text-sm">{selectedError.statusCode || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <Badge variant={getSeverityColor(selectedError.severity)}>
                    {selectedError.severity}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Message</label>
                <p className="text-sm bg-gray-100 p-2 rounded">{selectedError.message}</p>
              </div>
              
              {selectedError.details && (
                <div>
                  <label className="text-sm font-medium">Details</label>
                  <p className="text-sm bg-gray-100 p-2 rounded">{selectedError.details}</p>
                </div>
              )}
              
              {selectedError.stack && (
                <div>
                  <label className="text-sm font-medium">Stack Trace</label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {selectedError.stack}
                  </pre>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium">URL</label>
                <p className="text-sm bg-gray-100 p-2 rounded break-all">{selectedError.url}</p>
              </div>
              
              {selectedError.userFeedback && (
                <div>
                  <label className="text-sm font-medium">User Feedback</label>
                  <p className="text-sm bg-blue-50 p-2 rounded">{selectedError.userFeedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ErrorDashboard;