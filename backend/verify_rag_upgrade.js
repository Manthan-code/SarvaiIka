const enhancedQdrantService = require('./src/services/enhancedQdrantService');
const qdrantClient = require('./src/db/qdrant/client');
const logger = require('./src/config/logger');

async function testUpgrade() {
    try {
        console.log('--- Starting RAG Upgrade Verification ---');

        // 1. Initialize Service (should trigger collection check/recreation)
        console.log('\n1. Initializing EnhancedQdrantService...');
        await enhancedQdrantService.initialize();
        console.log('✅ Initialization complete');

        // 2. Verify Collection Dimensions
        console.log('\n2. Verifying Collection Dimensions...');
        const collections = ['user_embeddings', 'query_context'];

        for (const name of collections) {
            try {
                const info = await qdrantClient.getCollection(name);
                const size = info.config.params.vectors.size;
                console.log(`   - Collection '${name}': Size ${size}`);

                if (size !== 768) {
                    console.error(`❌ FAIL: Expected 768, got ${size}`);
                } else {
                    console.log(`✅ PASS: ${name} is 768-dim`);
                }
            } catch (err) {
                console.error(`❌ FAIL: Could not get info for ${name}`, err.message);
            }
        }

        // 3. Verify Embedding Generation
        console.log('\n3. Verifying Embedding Generation...');
        const text = "This is a test sentence for embedding verification.";
        const embedding = await enhancedQdrantService.generateEmbedding(text);

        console.log(`   - Generated embedding length: ${embedding.length}`);

        if (embedding.length !== 768) {
            console.error(`❌ FAIL: Expected 768-dim embedding, got ${embedding.length}`);
        } else {
            console.log(`✅ PASS: Embedding is 768-dim`);
        }

        console.log('\n--- Verification Complete ---');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

testUpgrade();
