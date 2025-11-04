import fetch from 'node-fetch';

async function testWebhook() {
  try {
    console.log('🧪 Testing webhook endpoint...');
    
    const testData = {
      sessionId: 'cs_test_123',
      userId: 'test-user-123',
      planId: 'test-plan-123'
    };
    
    console.log('📤 Sending test data:', testData);
    
    const response = await fetch('http://localhost:5000/api/subscriptions/test-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook test successful:', result);
    } else {
      console.log('❌ Webhook test failed:', result);
    }
    
  } catch (error) {
    console.error('💥 Error testing webhook:', error.message);
    console.log('💡 Make sure your server is running on port 5000');
  }
}

// Run the test
testWebhook();
