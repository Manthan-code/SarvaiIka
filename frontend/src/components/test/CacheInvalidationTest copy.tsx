import React, { useEffect, useState } from 'react';
import { useUserRole } from '../../hooks/useUserRole';
import { useUserProfile } from '../../hooks/useUserProfile';
import { cacheInvalidationEmitter } from '../../stores/authStore';

export const CacheInvalidationTest: React.FC = () => {
  const { profile: roleProfile, role, refreshProfile: refreshRole } = useUserRole();
  const { profile: userProfile, refreshProfile: refreshUser } = useUserProfile();
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[CacheTest] ${message}`);
  };

  useEffect(() => {
    addLog('CacheInvalidationTest component mounted');
    
    // Listen for cache invalidation events
    const unsubscribe = cacheInvalidationEmitter?.subscribe((event) => {
      addLog(`Cache invalidation event received: ${event}`);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
      addLog('CacheInvalidationTest component unmounted');
    };
  }, []);

  const testCacheInvalidation = () => {
    addLog('Testing cache invalidation...');
    
    // Simulate old cache by setting timestamp to 10 minutes ago
    const oldTimestamp = Date.now() - 10 * 60 * 1000;
    const oldCacheData = {
      data: { id: 'test', role: 'user', subscription_plan: 'free' },
      timestamp: oldTimestamp
    };
    
    localStorage.setItem('ai_agent_user_profile', JSON.stringify(oldCacheData));
    localStorage.setItem('ai_agent_user_profile_with_role', JSON.stringify(oldCacheData));
    
    addLog('Set old cache data (10 minutes ago)');
    
    // Emit cache invalidation event
    if (cacheInvalidationEmitter) {
      cacheInvalidationEmitter.emit('profile');
      addLog('Emitted profile cache invalidation event');
    } else {
      addLog('Cache invalidation emitter not available');
    }
  };

  const forceRefresh = () => {
    addLog('Forcing manual refresh of both hooks...');
    refreshRole();
    refreshUser();
  };

  const clearCache = () => {
    localStorage.removeItem('ai_agent_user_profile');
    localStorage.removeItem('ai_agent_user_profile_with_role');
    localStorage.removeItem('ai_agent_subscription');
    addLog('Cleared all cache manually');
  };

  const checkCacheStatus = () => {
    const keys = ['ai_agent_user_profile', 'ai_agent_user_profile_with_role', 'ai_agent_subscription'];
    
    keys.forEach(key => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const { timestamp } = JSON.parse(cached);
          const ageMinutes = Math.round((Date.now() - timestamp) / (1000 * 60));
          addLog(`${key}: exists (${ageMinutes} minutes old)`);
        } catch {
          addLog(`${key}: exists (invalid format)`);
        }
      } else {
        addLog(`${key}: not found`);
      }
    });
  };

  return (
    <div style={{ padding: '20px', border: '2px solid #007bff', margin: '20px', borderRadius: '8px' }}>
      <h2>Cache Invalidation Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Current Data:</h3>
        <p><strong>Role Profile:</strong> {roleProfile ? `${roleProfile.role} (${roleProfile.subscription_plan})` : 'Loading...'}</p>
        <p><strong>User Profile:</strong> {userProfile ? `${userProfile.name || userProfile.email} (${userProfile.subscription_plan})` : 'Loading...'}</p>
        <p><strong>Current Role:</strong> {role || 'None'}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={testCacheInvalidation} style={{ margin: '5px', padding: '10px' }}>
          Test Cache Invalidation
        </button>
        <button onClick={forceRefresh} style={{ margin: '5px', padding: '10px' }}>
          Force Refresh
        </button>
        <button onClick={clearCache} style={{ margin: '5px', padding: '10px' }}>
          Clear Cache
        </button>
        <button onClick={checkCacheStatus} style={{ margin: '5px', padding: '10px' }}>
          Check Cache Status
        </button>
      </div>

      <div>
        <h3>Test Logs:</h3>
        <div style={{ 
          height: '200px', 
          overflow: 'auto', 
          border: '1px solid #ccc', 
          padding: '10px',
          backgroundColor: '#f8f9fa',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {testLogs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
};