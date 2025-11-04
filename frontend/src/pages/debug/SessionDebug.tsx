import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const SessionDebug: React.FC = () => {
  const { user, session, isAuthenticated } = useAuthStore();

  const refreshSession = async () => {
    try {
      // Force a session refresh
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Failed to refresh session');
    }
  };

  const testAdminEndpoint = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Admin endpoint response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Admin endpoint data:', data);
        toast.success('Admin endpoint accessible!');
      } else {
        const errorText = await response.text();
        console.error('Admin endpoint error:', errorText);
        toast.error(`Admin endpoint failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Error testing admin endpoint:', error);
      toast.error('Failed to test admin endpoint');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Debug Information</CardTitle>
          <CardDescription>
            Debug information about the current user session and authentication state
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Authentication Status</h3>
            <p>Is Authenticated: {isAuthenticated() ? '✅ Yes' : '❌ No'}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">User Information</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Session Information</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">User Metadata</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(user?.user_metadata, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">App Metadata</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(user?.app_metadata, null, 2)}
            </pre>
          </div>

          <div className="flex gap-2">
            <Button onClick={refreshSession} variant="outline">
              Refresh Session
            </Button>
            <Button onClick={testAdminEndpoint} variant="default">
              Test Admin Endpoint
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionDebug;