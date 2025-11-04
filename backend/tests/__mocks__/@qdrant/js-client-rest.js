/**
 * Mock Qdrant client for backend testing
 * Prevents actual vector database operations and provides test data
 */

class MockQdrantClient {
  constructor(config = {}) {
    this.config = config;
    this.collections = new Map();
    this.points = new Map();
  }

  async getCollections() {
    return {
      collections: Array.from(this.collections.keys()).map(name => ({
        name,
        status: 'green',
        vectors_count: this.points.get(name)?.size || 0
      }))
    };
  }

  async createCollection(collectionName, config) {
    this.collections.set(collectionName, {
      name: collectionName,
      config,
      status: 'green'
    });
    this.points.set(collectionName, new Map());
    return { result: true };
  }

  async deleteCollection(collectionName) {
    const existed = this.collections.has(collectionName);
    this.collections.delete(collectionName);
    this.points.delete(collectionName);
    return { result: existed };
  }

  async getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    return {
      result: {
        ...collection,
        points_count: this.points.get(collectionName)?.size || 0
      }
    };
  }

  async upsert(collectionName, { points }) {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const collectionPoints = this.points.get(collectionName);
    points.forEach(point => {
      collectionPoints.set(point.id, {
        id: point.id,
        vector: point.vector,
        payload: point.payload || {}
      });
    });

    return {
      result: {
        operation_id: Math.floor(Math.random() * 1000000),
        status: 'completed'
      }
    };
  }

  async retrieve(collectionName, { ids }) {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const collectionPoints = this.points.get(collectionName);
    const result = ids.map(id => collectionPoints.get(id)).filter(Boolean);

    return { result };
  }

  async search(collectionName, { vector, limit = 10, filter = null, with_payload = true }) {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const collectionPoints = this.points.get(collectionName);
    const allPoints = Array.from(collectionPoints.values());

    // Mock similarity scoring (random for testing)
    const results = allPoints
      .map(point => ({
        id: point.id,
        score: Math.random(),
        payload: with_payload ? point.payload : undefined,
        vector: point.vector
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { result: results };
  }

  async delete(collectionName, { ids }) {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const collectionPoints = this.points.get(collectionName);
    let deletedCount = 0;

    ids.forEach(id => {
      if (collectionPoints.has(id)) {
        collectionPoints.delete(id);
        deletedCount++;
      }
    });

    return {
      result: {
        operation_id: Math.floor(Math.random() * 1000000),
        status: 'completed'
      }
    };
  }

  async scroll(collectionName, { limit = 10, offset = null, with_payload = true, with_vector = false }) {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const collectionPoints = this.points.get(collectionName);
    const allPoints = Array.from(collectionPoints.values());
    
    const results = allPoints.slice(0, limit).map(point => ({
      id: point.id,
      payload: with_payload ? point.payload : undefined,
      vector: with_vector ? point.vector : undefined
    }));

    return {
      result: {
        points: results,
        next_page_offset: results.length < limit ? null : limit
      }
    };
  }

  async count(collectionName, { filter = null }) {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const collectionPoints = this.points.get(collectionName);
    return {
      result: {
        count: collectionPoints.size
      }
    };
  }

  // Mock reset for tests
  static mockReset() {
    jest.clearAllMocks();
  }

  mockClear() {
    this.collections.clear();
    this.points.clear();
  }
}

module.exports = {
  QdrantClient: MockQdrantClient,
  MockQdrantClient
};