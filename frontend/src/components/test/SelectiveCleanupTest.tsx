import React, { useState, useEffect } from 'react';
import { clearSessionDataOnSignout } from '../../lib/localStorageUtils';

/**
 * Test component to demonstrate selective localStorage cleanup
 * This component helps verify that essential data persists while session data is cleared
 */
export const SelectiveCleanupTest: React.FC = () => {
  const [localStorageItems, setLocalStorageItems] = useState<Record<string, string>>({});

  // Function to read all localStorage items
  const readLocalStorage = () => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items[key] = localStorage.getItem(key) || '';
      }
    }
    setLocalStorageItems(items);
  };

  // Function to populate test data
  const populateTestData = () => {
    // Essential data that should persist
    localStorage.setItem('ai-agent-theme', 'dark');
    
    // Session data that should be cleared (including the problematic ones mentioned by user)
    localStorage.setItem('ai_agent_plans', JSON.stringify([
      { id: 1, name: 'Basic Plan', price: 10 },
      { id: 2, name: 'Pro Plan', price: 25 }
    ]));
    localStorage.setItem('plans_data', JSON.stringify([
      { id: 1, name: 'Basic Plan', price: 10 },
      { id: 2, name: 'Pro Plan', price: 25 }
    ])); // Duplicate plan data
    
    localStorage.setItem('ai_agent_recent_chats', JSON.stringify([
      { id: 'chat1', title: 'Test Chat 1' }
    ]));
    localStorage.setItem('ai_agent_subscription', JSON.stringify({
      plan: 'pro',
      status: 'active'
    }));
    localStorage.setItem('subscription_cache_timestamp', Date.now().toString());
    localStorage.setItem('subscription_data', JSON.stringify({
      plan: 'premium',
      expires: '2024-12-31'
    }));
    localStorage.setItem('error_notification_config', JSON.stringify({
      enabled: true
    }));
    localStorage.setItem('error_tracking_data', JSON.stringify({
      errors: []
    }));
    localStorage.setItem('streaming_metrics', JSON.stringify({
      totalRequests: 5
    }));
    
    // Add chat messages for specific chat IDs (the problematic ones mentioned by user)
    localStorage.setItem('ai_agent_messages_chat123', JSON.stringify([
      { id: 'msg1', content: 'Hello', role: 'user' }
    ]));
    localStorage.setItem('ai_agent_messages_chat456', JSON.stringify([
      { id: 'msg2', content: 'Hi there', role: 'assistant' }
    ]));
    localStorage.setItem('ai_agent_messages_chat789', JSON.stringify([
      { id: 'msg3', content: 'How are you?', role: 'user' }
    ]));
    
    // Add some Supabase auth data
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
      access_token: 'fake-token',
      refresh_token: 'fake-refresh'
    }));
    localStorage.setItem('supabase.auth.token', 'fake-supabase-token');

    readLocalStorage();
  };

  // Function to test selective cleanup
  const testSelectiveCleanup = () => {
    clearSessionDataOnSignout();
    readLocalStorage();
  };

  // Function to clear all localStorage
  const clearAllStorage = () => {
    localStorage.clear();
    readLocalStorage();
  };

  useEffect(() => {
    readLocalStorage();
  }, []);

  const essentialKeys = ['ai-agent-theme'];
  const sessionKeys = [
    'ai_agent_plans',
    'plans_data',
    'ai_agent_recent_chats',
    'ai_agent_subscription',
    'subscription_cache_timestamp',
    'subscription_data',
    'error_notification_config',
    'error_tracking_data',
    'streaming_metrics',
    'ai_agent_messages_chat123',
    'ai_agent_messages_chat456',
    'ai_agent_messages_chat789',
    'sb-localhost-auth-token',
    'supabase.auth.token'
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Selective localStorage Cleanup Test</h2>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={populateTestData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Populate Test Data
        </button>
        
        <button
          onClick={testSelectiveCleanup}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 ml-2"
        >
          Test Selective Cleanup (Simulate Signout)
        </button>
        
        <button
          onClick={clearAllStorage}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 ml-2"
        >
          Clear All Storage
        </button>
        
        <button
          onClick={readLocalStorage}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 ml-2"
        >
          Refresh View
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Essential Data (Should Persist) */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-green-600">
            Essential Data (Should Persist)
          </h3>
          <div className="space-y-2">
            {essentialKeys.map(key => (
              <div key={key} className="text-sm">
                <span className="font-mono text-blue-600">{key}:</span>
                <span className={`ml-2 ${localStorageItems[key] ? 'text-green-600' : 'text-red-500'}`}>
                  {localStorageItems[key] ? '✓ Present' : '✗ Missing'}
                </span>
                {localStorageItems[key] && (
                  <div className="text-xs text-gray-600 mt-1 pl-4">
                    {localStorageItems[key].length > 100 
                      ? localStorageItems[key].substring(0, 100) + '...'
                      : localStorageItems[key]
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Session Data (Should Be Cleared) */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-orange-600">
            Session Data (Should Be Cleared)
          </h3>
          <div className="space-y-2">
            {sessionKeys.map(key => (
              <div key={key} className="text-sm">
                <span className="font-mono text-blue-600">{key}:</span>
                <span className={`ml-2 ${localStorageItems[key] ? 'text-orange-500' : 'text-green-600'}`}>
                  {localStorageItems[key] ? '⚠ Still Present' : '✓ Cleared'}
                </span>
                {localStorageItems[key] && (
                  <div className="text-xs text-gray-600 mt-1 pl-4">
                    {localStorageItems[key].length > 100 
                      ? localStorageItems[key].substring(0, 100) + '...'
                      : localStorageItems[key]
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All localStorage Items */}
      <div className="mt-6 border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">All localStorage Items</h3>
        <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
          {Object.keys(localStorageItems).length === 0 ? (
            <p className="text-gray-500">No items in localStorage</p>
          ) : (
            Object.entries(localStorageItems).map(([key, value]) => (
              <div key={key} className="border-b pb-1">
                <span className="font-mono text-blue-600">{key}:</span>
                <span className="ml-2 text-gray-700">
                  {value.length > 150 ? value.substring(0, 150) + '...' : value}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
        <h4 className="font-semibold mb-2">Test Instructions:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click "Populate Test Data" to add both essential and session data</li>
          <li>Click "Test Selective Cleanup" to simulate signout behavior</li>
          <li>Verify that essential data (theme, plans) persists while session data is cleared</li>
          <li>Use "Clear All Storage" to reset for another test</li>
        </ol>
      </div>
    </div>
  );
};

export default SelectiveCleanupTest;