const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testBackgroundImages() {
  const token = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjdkYjEyZjNlLTNjNzQtNGI4Zi1hNzJjLTQ2ZGY4ZGY4ZGY4ZCIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzM3MzI3NzI5LCJpYXQiOjE3MzczMjQxMjksImlzcyI6Imh0dHBzOi8vdGVzdC5zdXBhYmFzZS5jbyIsInN1YiI6ImI3ZGUzNGVkLTg1MjQtNDI3ZC1iOGU0LTA1YmM0NzAxODk0MiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnt9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzM3MzI0MTI5fV0sInNlc3Npb25faWQiOiI5ZjY5ZjY5Zi02ZjY5LTQ2ZjktYjY5Zi02ZjY5ZjY5ZjY5ZjkifQ.test-signature';

  try {
    console.log('Testing background images API...');
    
    const response = await fetch('http://localhost:5000/api/background-images', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\nAPI Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nNumber of images returned:', data.images ? data.images.length : 0);
    
    if (data.images) {
      console.log('\nImage IDs:');
      data.images.forEach((img, index) => {
        console.log(`${index + 1}. ${img.id} - ${img.name} (tier: ${img.tier})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBackgroundImages();