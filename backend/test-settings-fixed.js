require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

console.log('🔑 Using Supabase Auth for testing');
console.log('📧 Testing with existing user session');

async function testSettingsAPI() {
    try {
        console.log('\n👤 Creating test user via backend...');
        
        const testEmail = `test${Date.now()}@gmail.com`;
        const testPassword = 'TestPass123!';
        
        // Create user via backend signup endpoint (bypasses email confirmation)
         try {
             const signupResponse = await axios.post('http://localhost:5000/api/auth/signup', {
                email: testEmail,
                password: testPassword,
                name: 'Test User'
            });
            
            console.log('✅ User created via backend:', signupResponse.status);
        } catch (signupError) {
             console.log('❌ Backend signup failed:');
             console.log('Status:', signupError.response?.status);
             console.log('Data:', JSON.stringify(signupError.response?.data, null, 2));
             console.log('Message:', signupError.message);
             
             if (signupError.response?.status === 400 && signupError.response?.data?.error?.includes('already')) {
                 console.log('⚠️ User might already exist, continuing...');
             } else {
                 return;
             }
         }
        
        // Now sign in to get a token
        console.log('\n🔐 Signing in to get token...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });
        
        if (authError) {
            console.log('❌ Login failed:', authError.message);
            return;
        }
        
        console.log('✅ Login successful');
        const token = authData.session.access_token;
        const userId = authData.user.id;
        
        console.log('✅ Ready to test with user:', userId);
        console.log('🔑 Got access token');
        
        console.log('\n🧪 Testing Settings API...');
        
        const response = await axios.get('http://localhost:5000/api/settings', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Settings API Response:', response.status);
        console.log('📄 Data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        if (error.response) {
            console.log('❌ Settings API Error:', error.response?.status);
            console.log('📄 Error Data:', JSON.stringify(error.response?.data, null, 2));
        } else {
            console.log('❌ Network/Auth Error:', error.message);
        }
    }
}

testSettingsAPI();