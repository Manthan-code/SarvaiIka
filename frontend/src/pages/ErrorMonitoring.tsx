import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  MessageSquare, 
  Settings, 
  Shield,
  TrendingUp,
  Users
} from 'lucide-react';
import ErrorDashboard from '../components/ErrorDashboard';
import ErrorFeedbackForm from '../components/ErrorFeedbackForm';
import ErrorMonitoringSettings from '../components/ErrorMonitoringSettings';

const ErrorMonitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Shield className="h-8 w-8 text-blue-600" />
                Error Monitoring & Feedback
              </h1>
              <p className="text-gray-600 mt-2">
                Monitor application errors, track performance, and collect user feedback
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Errors</p>
                  <p className="text-2xl font-bold text-gray-900">--</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Critical Issues</p>
                  <p className="text-2xl font-bold text-red-600">--</p>
                </div>
                <Shield className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
                  <p className="text-2xl font-bold text-green-600">--%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">User Feedback</p>
                  <p className="text-2xl font-bold text-blue-600">--</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Error Monitoring Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ErrorDashboard />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Submit Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ErrorFeedbackForm />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Help us improve!</strong> Your feedback is valuable for identifying and fixing issues.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm">What to include:</h4>
                      <ul className="text-sm text-gray-600 mt-1 space-y-1">
                        <li>• Clear description of the issue</li>
                        <li>• Steps to reproduce the problem</li>
                        <li>• Expected vs actual behavior</li>
                        <li>• Impact on your workflow</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm">Severity levels:</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Critical</Badge>
                          <span className="text-sm text-gray-600">System unusable</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">High</Badge>
                          <span className="text-sm text-gray-600">Major functionality affected</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Medium</Badge>
                          <span className="text-sm text-gray-600">Minor issues or inconvenience</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Low</Badge>
                          <span className="text-sm text-gray-600">Cosmetic or enhancement</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Error Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
                  <p className="text-gray-600 mb-4">
                    Detailed error trends, performance metrics, and predictive insights coming soon.
                  </p>
                  <Button variant="outline">
                    Request Early Access
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <ErrorMonitoringSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ErrorMonitoring;