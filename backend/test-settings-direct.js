const axios = require('axios');

async function testSettingsAPI() {
    console.log('🧪 Testing Settings API Directly');
    console.log('================================');
    
    const baseURL = 'http://localhost:5000';
    
    try {
        // Test 1: Check if the server is responding
        console.log('\n1️⃣ Testing server health...');
        const healthResponse = await axios.get(`${baseURL}/health`);
        console.log('✅ Server is running:', healthResponse.status);
        
        // Test 2: Test settings endpoint without auth (should get 401)
        console.log('\n2️⃣ Testing /api/settings without auth...');
        try {
            const noAuthResponse = await axios.get(`${baseURL}/api/settings`);
            console.log('❌ Unexpected success:', noAuthResponse.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Expected 401 Unauthorized:', error.response.status);
            } else if (error.response?.status === 404) {
                console.log('❌ Got 404 Not Found - Route not found!');
                console.log('📄 Error details:', error.response.data);
            } else {
                console.log('❌ Unexpected error:', error.response?.status || 'No response');
                console.log('📄 Error details:', error.response?.data || error.message);
            }
        }
        
        // Test 3: Test with fake auth header
        console.log('\n3️⃣ Testing /api/settings with fake auth...');
        try {
            const fakeAuthResponse = await axios.get(`${baseURL}/api/settings`, {
                headers: {
                    'Authorization': 'Bearer fake-token'
                }
            });
            console.log('❌ Unexpected success:', fakeAuthResponse.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Expected 401 Unauthorized:', error.response.status);
            } else if (error.response?.status === 404) {
                console.log('❌ Got 404 Not Found - Route not found!');
                console.log('📄 Error details:', error.response.data);
            } else {
                console.log('❌ Unexpected error:', error.response?.status || 'No response');
                console.log('📄 Error details:', error.response?.data || error.message);
            }
        }
        
        // Test 4: Check what routes are available
        console.log('\n4️⃣ Testing other API routes...');
        const testRoutes = ['/api/auth', '/api/users', '/api/chat'];
        
        for (const route of testRoutes) {
            try {
                await axios.get(`${baseURL}${route}`);
                console.log(`✅ ${route} - Route exists (got response)`);
            } catch (error) {
                if (error.response?.status === 401 || error.response?.status === 400) {
                    console.log(`✅ ${route} - Route exists (got ${error.response.status})`);
                } else if (error.response?.status === 404) {
                    console.log(`❌ ${route} - Route not found (404)`);
                } else {
                    console.log(`⚠️ ${route} - Error: ${error.response?.status || 'No response'}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to connect to server:', error.message);
        console.log('📋 Make sure the backend server is running on port 5000');
    }
}

testSettingsAPI().catch(console.error);