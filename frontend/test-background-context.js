import axios from 'axios';

async function testBackgroundContextAPI() {
    console.log('🧪 Testing BackgroundContext API Call');
    console.log('====================================');
    
    const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:5000';
    console.log('🔗 Base URL:', baseURL);
    
    // Test 1: Direct call to /api/settings (what BackgroundContext does)
    console.log('\n1️⃣ Testing direct call to /api/settings...');
    try {
        const response = await axios.get(`${baseURL}/api/settings`);
        console.log('✅ Success:', response.status);
        console.log('📄 Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Error:', error.response?.status || 'No response');
        console.log('📄 Error details:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('🔍 This is expected - authentication required');
        } else if (error.response?.status === 404) {
            console.log('🔍 Route not found - checking backend routes...');
        }
    }
    
    // Test 2: Check if the route exists in backend
    console.log('\n2️⃣ Testing backend route existence...');
    try {
        const response = await axios.get(`${baseURL}/api/settings`, {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });
        console.log('✅ Route exists (got response)');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Route exists (got 401 - auth required)');
        } else if (error.response?.status === 404) {
            console.log('❌ Route does not exist (got 404)');
        } else {
            console.log('🔍 Other error:', error.response?.status);
        }
    }
    
    // Test 3: Check what routes are available
    console.log('\n3️⃣ Testing available routes...');
    const testRoutes = ['/api/auth', '/api/users', '/api/plans', '/health'];
    
    for (const route of testRoutes) {
        try {
            await axios.get(`${baseURL}${route}`);
            console.log(`✅ ${route} - Available`);
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 400) {
                console.log(`✅ ${route} - Available (${error.response.status})`);
            } else if (error.response?.status === 404) {
                console.log(`❌ ${route} - Not found`);
            } else {
                console.log(`🔍 ${route} - Error: ${error.response?.status || 'No response'}`);
            }
        }
    }
}

testBackgroundContextAPI().catch(console.error);