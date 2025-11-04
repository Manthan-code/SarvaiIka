// === MOCK QDRANT CLIENT ===
// File: src/qdrant/mockClient.js

// Mock data store
const mockCollections = {};

const qdrant = {
  collections: {
    create: async ({ collection_name }) => {
      if (mockCollections[collection_name]) {
        const error = { response: { status: 409 } }; // Simulate "collection exists"
        throw error;
      }
      mockCollections[collection_name] = [];
      console.log(`(Mock) Collection "${collection_name}" created successfully.`);
    },
  },

  points: {
    upsert: async ({ collection_name, points }) => {
      if (!mockCollections[collection_name]) {
        throw new Error(`(Mock) Collection "${collection_name}" does not exist.`);
      }
      mockCollections[collection_name].push(...points);
      console.log(`(Mock) Added ${points.length} vector(s) to "${collection_name}".`);
      return { status: 'ok', points: points.length };
    },

    search: async ({ collection_name, vector, limit = 5, filter, with_payload = false }) => {
      if (!mockCollections[collection_name]) {
        throw new Error(`(Mock) Collection "${collection_name}" does not exist.`);
      }
      console.log(`(Mock) Searching top ${limit} vectors in "${collection_name}".`);
      
      let points = mockCollections[collection_name];
      
      // Apply filters if provided
      if (filter && filter.must) {
        points = points.filter(point => {
          return filter.must.every(condition => {
            if (condition.key && condition.match) {
              return point.payload[condition.key] === condition.match.value;
            }
            if (condition.key && condition.range) {
              const value = point.payload[condition.key];
              const { gte, lte } = condition.range;
              return (!gte || value >= gte) && (!lte || value <= lte);
            }
            return true;
          });
        });
      }
      
      // Return filtered points
      return points
        .slice(0, limit)
        .map((p) => ({ id: p.id, score: Math.random(), payload: p.payload }));
    },
  },
};

// Utility functions
const createCollection = async (collectionName, vectorSize = 1536) => {
  try {
    await qdrant.collections.create({ collection_name: collectionName });
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`(Mock) Collection "${collectionName}" already exists.`);
    } else {
      console.error('(Mock) Error creating collection:', err);
    }
  }
};

const addVector = async (collectionName, point) => {
  try {
    // Handle both old format (vector, payload) and new format (point object)
    let pointToAdd;
    if (point.id && point.vector && point.payload !== undefined) {
      // New format: point object
      pointToAdd = point;
    } else {
      // Old format: assume point is vector and second param is payload
      pointToAdd = { id: Date.now(), vector: point, payload: arguments[2] || {} };
    }
    
    return await qdrant.points.upsert({
      collection_name: collectionName,
      points: [pointToAdd],
    });
  } catch (err) {
    console.error('(Mock) Error adding vector:', err);
  }
};

const searchVector = async (collectionName, options) => {
  try {
    // Handle both old and new parameter formats
    if (typeof options === 'object' && options.vector) {
      return await qdrant.points.search({
        collection_name: collectionName,
        ...options
      });
    } else {
      // Legacy format: searchVector(collectionName, vector, top)
      const vector = options;
      const top = arguments[2] || 5;
      return await qdrant.points.search({
        collection_name: collectionName,
        vector,
        limit: top,
      });
    }
  } catch (err) {
    console.error('(Mock) Error searching vector:', err);
  }
};

// Add getCollections method for health checks
qdrant.getCollections = async () => {
  return {
    collections: Object.keys(mockCollections).map(name => ({ name }))
  };
};

module.exports = qdrant;
module.exports.createCollection = createCollection;
module.exports.addVector = addVector;
module.exports.searchVector = searchVector;
