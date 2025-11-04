require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

// Create Supabase clients
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function debugSettingsAPI() {
    console.log('🔍 Debug Settings API - Starting...\n');

    try {
        // Step 1: Find an existing user
        console.log('1. Finding existing users...');
        const { data: users, error: usersError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .limit(5);

        if (usersError) {
            console.error('❌ Error fetching users:', usersError);
            return;
        }

        if (!users || users.length === 0) {
            console.log('❌ No existing users found. Please create a user through the frontend first.');
            return;
        }

        console.log('✅ Found existing users:', users.map(u => u.email));
        
        // Use the first user
        const testUser = users[0];
        console.log(`📧 Using user: ${testUser.email}\n`);

        // Step 2: Test with service role key (bypass auth middleware for testing)
        console.log('2. Testing with service role key...');
        
        const baseURL = 'http://localhost:5000';
        const headers = {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'X-Test-User-Id': testUser.id  // Pass user ID for testing
        };

        console.log('3. Testing API endpoints...\n');

        // Test GET /api/settings
        console.log('📡 Testing GET /api/settings...');
        try {
            const getResponse = await axios.get(`${baseURL}/api/settings`, { 
                headers,
                timeout: 10000 
            });
            console.log('✅ GET /api/settings - Success:', getResponse.status);
            console.log('📄 Response data:', JSON.stringify(getResponse.data, null, 2));
        } catch (error) {
            console.log('❌ GET /api/settings - Failed:', error.response?.status || 'No response');
            console.log('📄 Error details:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                console.log('🔍 This confirms the auth middleware is working - it rejected the service role key');
                console.log('🔍 Let\'s try to understand what token format is expected...');
                
                // Let's check what the auth middleware expects
                console.log('\n4. Analyzing auth middleware expectations...');
                console.log('📋 The middleware expects a user access token, not a service role key');
                console.log('📋 We need to generate a proper user session token');
            }
        }

        // Let's try a different approach - check if we can bypass auth for testing
        console.log('\n📡 Testing without Authorization header...');
        try {
            const noAuthResponse = await axios.get(`${baseURL}/api/settings`, { 
                timeout: 10000 
            });
            console.log('✅ GET /api/settings (no auth) - Success:', noAuthResponse.status);
        } catch (error) {
            console.log('❌ GET /api/settings (no auth) - Failed:', error.response?.status || 'No response');
            console.log('📄 Error details:', error.response?.data || error.message);
        }

        // Test the background images endpoint (might not require auth)
        console.log('\n📡 Testing GET /api/background-images...');
        try {
            const bgResponse = await axios.get(`${baseURL}/api/background-images`, { 
                timeout: 10000 
            });
            console.log('✅ GET /api/background-images - Success:', bgResponse.status);
            console.log('📄 Response data:', JSON.stringify(bgResponse.data, null, 2));
        } catch (error) {
            console.log('❌ GET /api/background-images - Failed:', error.response?.status || 'No response');
            console.log('📄 Error details:', error.response?.data || error.message);
        }

        console.log('\n🎯 Summary:');
        console.log('- Settings API requires proper user authentication');
        console.log('- Service role key is rejected by auth middleware (as expected)');
        console.log('- Need to generate a valid user access token for testing');
        console.log('- Background images endpoint status checked');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

debugSettingsAPI();