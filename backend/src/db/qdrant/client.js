// === QDRANT CLIENT ===
// File: src/db/qdrant/client.js

const dotenv = require('dotenv');
dotenv.config();

const { randomUUID } = require('crypto');

if (process.env.NODE_ENV === 'test') {
  module.exports = require('./mockClient');
} else {
  const { QdrantClient } = require('@qdrant/js-client-rest');

  console.log('[QDRANT] Initializing Qdrant client…');

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || '',
    checkCompatibility: false,
  });

  console.log('[QDRANT] Client ready');

  // ============================
  // ADD VECTOR
  // ============================
  const addVector = async (collectionName, point) => {
    try {
      // Ensure point has an ID
      const pointWithId = {
        ...point,
        id: point.id || randomUUID()
      };

      const response = await qdrant.upsert(collectionName, {
        wait: true,
        points: [pointWithId],
      });
      return response;
    } catch (err) {
      console.error('[QDRANT] Error adding vector:', err.message);
      throw err;
    }
  };

  // ============================
  // SEARCH VECTOR
  // ============================
  const searchVector = async (collectionName, queryObject) => {
    try {
      // queryObject contains { vector, limit, filter, with_payload, score_threshold, ... }
      // qdrant.search expects (collection_name, search_points)
      const response = await qdrant.search(collectionName, queryObject);
      return response;
    } catch (err) {
      console.error('[QDRANT] Error searching vector:', err.message);
      throw err;
    }
  };

  // Attach helper methods (expected by enhancedQdrantService)
  qdrant.addVector = addVector;
  qdrant.searchVector = searchVector;

  module.exports = qdrant;
}
