require('dotenv').config();
const qdrant = require('./src/db/qdrant/client');

async function inspect() {
    console.log('--- Inspecting Qdrant Collections ---');
    try {
        const response = await qdrant.getCollections();
        const collections = response.collections;

        console.log(`Found ${collections.length} collections.`);

        for (const col of collections) {
            const info = await qdrant.getCollection(col.name);
            console.log(`\nCollection: ${col.name}`);
            console.log(`  Status: ${info.status}`);
            console.log(`  Vectors Count: ${info.vectors_count}`);
            console.log(`  Vector Config:`, JSON.stringify(info.config.params.vectors, null, 2));
        }

    } catch (error) {
        console.error('Error inspecting collections:', error);
    }
}

inspect();
