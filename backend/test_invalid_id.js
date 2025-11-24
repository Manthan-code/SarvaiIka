require('dotenv').config();
const qdrant = require('./src/db/qdrant/client');
const enhancedQdrantService = require('./src/services/enhancedQdrantService');

async function testInvalidId() {
    console.log('--- Testing Invalid ID Format ---');
    try {
        await enhancedQdrantService.initialize();

        const text = "Test query for ID check";
        const vector = await enhancedQdrantService.generateEmbedding(text);

        // Construct a point with a non-UUID string ID, similar to enhancedQdrantService
        const invalidId = `context_${Date.now()}_test`;
        console.log(`Attempting to add vector with ID: "${invalidId}"`);

        const point = {
            id: invalidId,
            vector: vector,
            payload: {
                userId: 'test-user',
                query: text
            }
        };

        await qdrant.addVector('query_context', point);
        console.log('✅ Success (Unexpected if ID is invalid)');

    } catch (error) {
        console.log('❌ Caught expected error:', error.message);
        if (error.response) {
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.message.includes('Bad Request') || (error.response && error.response.status === 400)) {
            console.log('✅ Hypothesis Confirmed: Qdrant rejected the non-UUID string ID.');
        }
    }
}

testInvalidId();
