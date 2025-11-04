require('dotenv').config();

async function testLiveAPI() {
  try {
    console.log('Testing live API endpoint...\n');
    
    // Test the actual API endpoint
    const response = await fetch('http://localhost:5000/api/settings', {
      headers: {
        'Authorization': 'Bearer test-token', // This will fail but let's see the error
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const data = JSON.parse(responseText);
        console.log('Parsed JSON:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Failed to parse JSON:', e.message);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testLiveAPI();