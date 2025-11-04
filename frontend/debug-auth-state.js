// Debug script to check authentication state
console.log('🔍 Checking authentication state...');

// Check localStorage for auth data
const authData = localStorage.getItem('auth-storage');
console.log('📦 Auth storage:', authData ? JSON.parse(authData) : 'No auth data');

// Check if there's a session
const sessionData = localStorage.getItem('sb-localhost-auth-token');
console.log('🔑 Supabase session:', sessionData ? 'Present' : 'Missing');

// Check profile cache
const profileCache = localStorage.getItem('userProfile');
console.log('👤 Profile cache:', profileCache ? JSON.parse(profileCache) : 'No profile cache');

// Try to make an API call to check auth
fetch('/api/auth/profile', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(response => {
  console.log('🌐 Profile API response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('👤 Profile API data:', data);
})
.catch(error => {
  console.error('❌ Profile API error:', error);
});

// Try to make an API call to admin users
fetch('/api/admin/users', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(response => {
  console.log('👥 Admin users API response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('👥 Admin users API data:', data);
})
.catch(error => {
  console.error('❌ Admin users API error:', error);
});