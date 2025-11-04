// Test profile endpoint connection with auth simulation
async function testProfileConnection() {
    const { default: fetch } = await import('node-fetch');
    
    try {
        console.log('Testing profile endpoint connection...');
        
        // Test 1: Basic endpoint accessibility
        console.log('\n1. Testing basic endpoint accessibility:');
        const basicResponse = await fetch('http://localhost:5000/api/auth/profile');
        console.log('Status:', basicResponse.status, basicResponse.statusText);
        
        // Test 2: Check CORS headers
        console.log('\n2. Checking CORS headers:');
        console.log('Access-Control-Allow-Origin:', basicResponse.headers.get('access-control-allow-origin'));
        console.log('Access-Control-Allow-Methods:', basicResponse.headers.get('access-control-allow-methods'));
        console.log('Access-Control-Allow-Headers:', basicResponse.headers.get('access-control-allow-headers'));
        
        // Test 3: OPTIONS preflight request
        console.log('\n3. Testing OPTIONS preflight request:');
        const optionsResponse = await fetch('http://localhost:5000/api/auth/profile', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:8080',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'authorization,content-type'
            }
        });
        console.log('OPTIONS Status:', optionsResponse.status, optionsResponse.statusText);
        console.log('OPTIONS CORS Headers:');
        console.log('  Access-Control-Allow-Origin:', optionsResponse.headers.get('access-control-allow-origin'));
        console.log('  Access-Control-Allow-Methods:', optionsResponse.headers.get('access-control-allow-methods'));
        console.log('  Access-Control-Allow-Headers:', optionsResponse.headers.get('access-control-allow-headers'));
        
        // Test 4: Check if backend is logging requests
        console.log('\n4. Backend should log this request in terminal 12');
        
    } catch (error) {
        console.error('Connection test failed:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
    }
}

testProfileConnection();