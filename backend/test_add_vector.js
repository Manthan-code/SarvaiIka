require('dotenv').config();
const enhancedQdrantService = require('./src/services/enhancedQdrantService');

async function testStoreContext() {
    console.log('--- Testing storeQueryContext with Valid IDs ---');
    try {
        await enhancedQdrantService.initialize();

        const userId = 'test-user-uuid';
        const query = "What is the capital of France?";
        const context = {
            queryType: 'text',
            response: 'The capital of France is Paris.',
            model: 'gpt-4o-mini'
        };

        console.log('Attempting to store query context...');
        const result = await enhancedQdrantService.storeQueryContext(userId, query, context);

        console.log('✅ Result:', result);
        if (result.success && result.pointId) {
            console.log('✅ Success: Point stored with ID:', result.pointId);
        } else {
            console.error('❌ Failure: Unexpected result format');
        }

    } catch (error) {
        console.error('❌ Error storing context:', error);
        if (error.response) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testStoreContext();
