const axios = require('axios');

async function testChat() {
    try {
        console.log('Sending request to http://localhost:5000/api/chat...');
        const response = await axios.post('http://localhost:5000/api/chat', {
            message: 'Hello, this is a test message to trigger the 500 error.',
            userId: 'test-user-123'
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Request failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testChat();
