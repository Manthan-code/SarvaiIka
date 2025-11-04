// === QDRANT CLIENT ===
// File: src/qdrant/client.js

const dotenv = require('dotenv');
dotenv.config();

// Use mock client during testing
if (process.env.NODE_ENV === 'test') {
  module.exports = require('./mockClient');
} else {
  const { QdrantClient } = require('@qdrant/js-client-rest');
  
  // Initialize Qdrant client
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || '', // Optional
    checkCompatibility: false, // Suppress compatibility warnings
  });

  // Utility functions
  const createCollection = async (collectionName, vectorSize = 1536) => {
    try {
      await qdrant.collections.create({
        collection_name: collectionName,
        vectors: { size: vectorSize, distance: 'Cosine' },
      });
      console.log(`Collection "${collectionName}" created successfully.`);
    } catch (err) {
      if (err.response?.status === 409) {
        console.log(`Collection "${collectionName}" already exists.`);
      } else {
        console.error('Error creating collection:', err);
      }
    }
  };

  const addVector = async (collectionName, vector, payload = {}) => {
    try {
      const response = await qdrant.points.upsert({
        collection_name: collectionName,
        points: [
          {
            id: Date.now(), // or any unique ID logic
            vector,
            payload,
          },
        ],
      });
      return response;
    } catch (err) {
      console.error('Error adding vector:', err);
    }
  };

  const searchVector = async (collectionName, vector, top = 5) => {
    try {
      const response = await qdrant.points.search({
        collection_name: collectionName,
        vector,
        limit: top,
      });
      return response;
    } catch (err) {
      console.error('Error searching vector:', err);
    }
  };

  module.exports = qdrant;
  module.exports.createCollection = createCollection;
  module.exports.addVector = addVector;
  module.exports.searchVector = searchVector;
}
