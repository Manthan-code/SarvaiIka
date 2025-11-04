// Test frontend API connection from Node.js
// Using built-in fetch (Node 18+)

async function testFrontendAPI() {
    console.log('🔍 Testing frontend API connection...');
    
    try {
        // Test the proxy endpoint that frontend uses
        const response = await fetch('http://localhost:8080/api/settings', {
            headers: {
                'Authorization': 'Bearer test-token', // This will fail but let's see the error
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response status:', response.status);
        console.log('📋 Response headers:', Object.fromEntries(response.headers));
        
        const data = await response.text();
        console.log('📄 Response body:', data);
        
        if (response.status === 401) {
            console.log('✅ API is reachable through proxy (401 is expected with test token)');
        }
        
    } catch (error) {
        console.error('❌ API connection failed:', error.message);
        
        // Test direct backend connection as fallback
        console.log('\n🔄 Testing direct backend connection...');
        try {
            const directResponse = await fetch('http://localhost:5000/api/settings', {
                headers: {
                    'Authorization': 'Bearer test-token',
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Direct backend status:', directResponse.status);
            const directData = await directResponse.text();
            console.log('📄 Direct backend response:', directData);
            
        } catch (directError) {
            console.error('❌ Direct backend connection failed:', directError.message);
        }
    }
}

testFrontendAPI();