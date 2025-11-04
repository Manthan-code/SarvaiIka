const qdrantClient = require('../db/qdrant/client');

const COLLECTION_NAME = 'user_embeddings';
const VECTOR_SIZE = 1536; // Default OpenAI embedding size

/**
 * Initialize the user embeddings collection if it doesn't exist
 */
async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      col => col.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      console.log(`📦 Creating collection: ${COLLECTION_NAME}`);
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine'
        }
      });
      console.log(`✅ Collection ${COLLECTION_NAME} created successfully`);
    }
  } catch (error) {
    console.error('Failed to ensure collection exists:', error);
    throw error;
  }
}

/**
 * Store user input as a point in the embeddings collection
 * @param {string} userId - User identifier
 * @param {string} input - User input text
 * @param {number[]} embeddingVector - Embedding vector (assumed to be generated externally)
 */
async function storeEmbedding(userId, input, embeddingVector) {
  try {
    await ensureCollection();

    const pointId = `${userId}_${Date.now()}`;
    
    const point = {
      id: pointId,
      vector: embeddingVector,
      payload: {
        userId,
        input,
        timestamp: Date.now()
      }
    };

    await qdrantClient.upsert(COLLECTION_NAME, {
      points: [point]
    });

    console.log(`✅ Stored embedding for user ${userId}`);
    return { success: true, pointId };
  } catch (error) {
    console.error('Failed to store embedding:', error);
    throw error;
  }
}

/**
 * Search for similar inputs for a specific user
 * @param {string} userId - User identifier
 * @param {number[]} embeddingVector - Query embedding vector
 * @param {number} topK - Number of top results to return (default: 3)
 * @returns {Array} Array of similar inputs with scores
 */
async function searchSimilar(userId, embeddingVector, topK = 3) {
  try {
    await ensureCollection();

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: embeddingVector,
      limit: topK,
      filter: {
        must: [
          {
            key: 'userId',
            match: { value: userId }
          }
        ]
      },
      with_payload: true,
      with_vector: false
    });

    // Transform results to a cleaner format
    const similarInputs = searchResult.map(result => ({
      input: result.payload.input,
      score: result.score,
      timestamp: result.payload.timestamp,
      pointId: result.id
    }));

    console.log(`🔍 Found ${similarInputs.length} similar inputs for user ${userId}`);
    return similarInputs;
  } catch (error) {
    console.error('Failed to search similar inputs:', error);
    throw error;
  }
}

/**
 * Get all embeddings for a specific user
 * @param {string} userId - User identifier
 * @returns {Array} Array of user's stored inputs
 */
async function getUserEmbeddings(userId) {
  try {
    await ensureCollection();

    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'userId',
            match: { value: userId }
          }
        ]
      },
      with_payload: true,
      with_vector: false,
      limit: 100
    });

    return scrollResult.points.map(point => ({
      input: point.payload.input,
      timestamp: point.payload.timestamp,
      pointId: point.id
    }));
  } catch (error) {
    console.error('Failed to get user embeddings:', error);
    throw error;
  }
}

/**
 * Delete embeddings for a specific user
 * @param {string} userId - User identifier
 */
async function deleteUserEmbeddings(userId) {
  try {
    await ensureCollection();

    const userEmbeddings = await getUserEmbeddings(userId);
    const pointIds = userEmbeddings.map(embedding => embedding.pointId);

    if (pointIds.length > 0) {
      await qdrantClient.delete(COLLECTION_NAME, {
        points: pointIds
      });
      console.log(`🗑️ Deleted ${pointIds.length} embeddings for user ${userId}`);
    }

    return { success: true, deletedCount: pointIds.length };
  } catch (error) {
    console.error('Failed to delete user embeddings:', error);
    throw error;
  }
}

module.exports = {
  storeEmbedding,
  searchSimilar,
  getUserEmbeddings,
  deleteUserEmbeddings
};