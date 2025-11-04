import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = 'https://dvhpkyixjggtdsmhgqao.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aHBreWl4amdndGRzbWhncWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NDA3NDAsImV4cCI6MjA3MTIxNjc0MH0.lkrPdk22G9H44JcWvmYnqIg4bqBv_sQ7P5e0xmU8W4k';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBackgroundAPI() {
    console.log('🧪 Testing BackgroundContext API Call with Authentication');
    console.log('========================================================');
    
    try {
        // Step 1: Create a test user first
        console.log('\n1️⃣ Creating test user...');
        const testEmail = `test${Date.now()}@gmail.com`;
        const testPassword = 'TestPass123!';
        
        try {
            const signupResponse = await axios.post('http://localhost:5000/api/auth/signup', {
                email: testEmail,
                password: testPassword,
                name: 'Test User'
            });
            console.log('✅ User created via backend:', signupResponse.status);
        } catch (signupError) {
            console.log('❌ Backend signup failed:', signupError.response?.status, signupError.response?.data);
            if (signupError.response?.status !== 400) {
                return;
            }
        }
        
        // Step 2: Sign in to get a valid token
        console.log('\n2️⃣ Signing in to get authentication token...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });
        
        if (authError) {
            console.log('❌ Auth failed:', authError.message);
            console.log('🔍 Let\'s test without authentication first...');
            
            // Test without auth
            const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:5000';
            try {
                const response = await axios.get(`${baseURL}/api/settings`);
                console.log('✅ No auth needed:', response.status);
            } catch (error) {
                console.log('❌ Expected auth error:', error.response?.status, error.response?.data);
            }
            return;
        }
        
        console.log('✅ Authentication successful');
        console.log('🔑 Access token:', authData.session.access_token.substring(0, 20) + '...');
        
        // Step 3: Test the API call that BackgroundContext makes
        console.log('\n3️⃣ Testing /api/settings with authentication...');
        const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:5000';
        
        try {
            const response = await axios.get(`${baseURL}/api/settings`, {
                headers: {
                    'Authorization': `Bearer ${authData.session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ API call successful:', response.status);
            console.log('📄 Response data:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            console.log('❌ API call failed:', error.response?.status || 'No response');
            console.log('📄 Error details:', error.response?.data || error.message);
            
            if (error.response?.status === 404) {
                console.log('🔍 404 error - route not found or not mounted properly');
            } else if (error.response?.status === 401) {
                console.log('🔍 401 error - authentication issue');
            }
        }
        
        // Step 4: Test the frontend proxy (if running from frontend)
        console.log('\n4️⃣ Testing frontend proxy...');
        try {
            const proxyResponse = await axios.get('/api/settings', {
                headers: {
                    'Authorization': `Bearer ${authData.session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Proxy call successful:', proxyResponse.status);
            console.log('📄 Proxy response:', JSON.stringify(proxyResponse.data, null, 2));
            
        } catch (error) {
            console.log('❌ Proxy call failed:', error.response?.status || 'No response');
            console.log('📄 Proxy error:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testBackgroundAPI().catch(console.error);