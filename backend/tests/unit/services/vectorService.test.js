/**
 * Vector Service Unit Tests
 * Comprehensive tests for all vector service methods
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock dependencies
jest.mock('../../../src/db/qdrant/client');
jest.mock('openai');

const vectorService = require('../../../src/services/vectorService');
const qdrantClient = require('../../../src/db/qdrant/client');
const OpenAI = require('openai');

describe('Vector Service Unit Tests', () => {
  let mockQdrant;
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockQdrant = {
      search: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      retrieve: jest.fn(),
      scroll: jest.fn(),
      count: jest.fn(),
      createCollection: jest.fn(),
      deleteCollection: jest.fn(),
      getCollectionInfo: jest.fn()
    };
    
    mockOpenAI = {
      embeddings: {
        create: jest.fn()
      }
    };
    
    qdrantClient.mockReturnValue(mockQdrant);
    OpenAI.mockImplementation(() => mockOpenAI);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text input', async () => {
      const text = 'This is a test text';
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const result = await vectorService.generateEmbedding(text);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: text
      });
      expect(result).toEqual(mockEmbedding);
    });

    it('should handle OpenAI API errors', async () => {
      const text = 'This is a test text';
      
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('OpenAI API Error'));

      await expect(vectorService.generateEmbedding(text))
        .rejects.toThrow('OpenAI API Error');
    });

    it('should handle empty text input', async () => {
      const text = '';
      
      await expect(vectorService.generateEmbedding(text))
        .rejects.toThrow('Text input cannot be empty');
    });

    it('should handle null text input', async () => {
      const text = null;
      
      await expect(vectorService.generateEmbedding(text))
        .rejects.toThrow('Text input cannot be empty');
    });
  });

  describe('storeVector', () => {
    it('should store vector with metadata', async () => {
      const vectorData = {
        id: 'vec_123',
        vector: [0.1, 0.2, 0.3, 0.4, 0.5],
        payload: {
          text: 'Sample text',
          category: 'document',
          timestamp: new Date().toISOString()
        }
      };

      mockQdrant.upsert.mockResolvedValue({ status: 'acknowledged' });

      const result = await vectorService.storeVector('test_collection', vectorData);

      expect(mockQdrant.upsert).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        points: [vectorData]
      });
      expect(result).toEqual({ status: 'acknowledged' });
    });

    it('should store multiple vectors', async () => {
      const vectorsData = [
        {
          id: 'vec_1',
          vector: [0.1, 0.2, 0.3],
          payload: { text: 'Text 1' }
        },
        {
          id: 'vec_2',
          vector: [0.4, 0.5, 0.6],
          payload: { text: 'Text 2' }
        }
      ];

      mockQdrant.upsert.mockResolvedValue({ status: 'acknowledged' });

      const result = await vectorService.storeVectors('test_collection', vectorsData);

      expect(mockQdrant.upsert).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        points: vectorsData
      });
      expect(result).toEqual({ status: 'acknowledged' });
    });

    it('should handle Qdrant storage errors', async () => {
      const vectorData = {
        id: 'vec_123',
        vector: [0.1, 0.2, 0.3],
        payload: { text: 'Sample text' }
      };

      mockQdrant.upsert.mockRejectedValue(new Error('Qdrant storage error'));

      await expect(vectorService.storeVector('test_collection', vectorData))
        .rejects.toThrow('Qdrant storage error');
    });
  });

  describe('searchVectors', () => {
    it('should search for similar vectors', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockResults = [
        {
          id: 'vec_1',
          score: 0.95,
          payload: { text: 'Similar text 1' }
        },
        {
          id: 'vec_2',
          score: 0.87,
          payload: { text: 'Similar text 2' }
        }
      ];

      mockQdrant.search.mockResolvedValue(mockResults);

      const result = await vectorService.searchVectors('test_collection', queryVector, 5);

      expect(mockQdrant.search).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        vector: queryVector,
        limit: 5,
        with_payload: true,
        with_vector: false
      });
      expect(result).toEqual(mockResults);
    });

    it('should search with filters', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const filters = {
        must: [
          { key: 'category', match: { value: 'document' } }
        ]
      };

      const mockResults = [
        {
          id: 'vec_1',
          score: 0.95,
          payload: { text: 'Filtered result', category: 'document' }
        }
      ];

      mockQdrant.search.mockResolvedValue(mockResults);

      const result = await vectorService.searchVectors('test_collection', queryVector, 5, filters);

      expect(mockQdrant.search).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        vector: queryVector,
        limit: 5,
        filter: filters,
        with_payload: true,
        with_vector: false
      });
      expect(result).toEqual(mockResults);
    });

    it('should handle search errors', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      mockQdrant.search.mockRejectedValue(new Error('Search error'));

      await expect(vectorService.searchVectors('test_collection', queryVector))
        .rejects.toThrow('Search error');
    });
  });

  describe('deleteVector', () => {
    it('should delete vector by ID', async () => {
      const vectorId = 'vec_123';

      mockQdrant.delete.mockResolvedValue({ status: 'acknowledged' });

      const result = await vectorService.deleteVector('test_collection', vectorId);

      expect(mockQdrant.delete).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        points_selector: {
          points: [vectorId]
        }
      });
      expect(result).toEqual({ status: 'acknowledged' });
    });

    it('should delete multiple vectors', async () => {
      const vectorIds = ['vec_1', 'vec_2', 'vec_3'];

      mockQdrant.delete.mockResolvedValue({ status: 'acknowledged' });

      const result = await vectorService.deleteVectors('test_collection', vectorIds);

      expect(mockQdrant.delete).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        points_selector: {
          points: vectorIds
        }
      });
      expect(result).toEqual({ status: 'acknowledged' });
    });

    it('should handle deletion errors', async () => {
      const vectorId = 'vec_123';

      mockQdrant.delete.mockRejectedValue(new Error('Deletion error'));

      await expect(vectorService.deleteVector('test_collection', vectorId))
        .rejects.toThrow('Deletion error');
    });
  });

  describe('retrieveVector', () => {
    it('should retrieve vector by ID', async () => {
      const vectorId = 'vec_123';
      const mockVector = {
        id: vectorId,
        vector: [0.1, 0.2, 0.3],
        payload: { text: 'Retrieved text' }
      };

      mockQdrant.retrieve.mockResolvedValue([mockVector]);

      const result = await vectorService.retrieveVector('test_collection', vectorId);

      expect(mockQdrant.retrieve).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        ids: [vectorId],
        with_payload: true,
        with_vector: true
      });
      expect(result).toEqual(mockVector);
    });

    it('should return null when vector not found', async () => {
      const vectorId = 'vec_nonexistent';

      mockQdrant.retrieve.mockResolvedValue([]);

      const result = await vectorService.retrieveVector('test_collection', vectorId);

      expect(result).toBeNull();
    });
  });

  describe('Collection Management', () => {
    it('should create collection', async () => {
      const collectionName = 'new_collection';
      const config = {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      };

      mockQdrant.createCollection.mockResolvedValue({ status: 'ok' });

      const result = await vectorService.createCollection(collectionName, config);

      expect(mockQdrant.createCollection).toHaveBeenCalledWith({
        collection_name: collectionName,
        vectors_config: config.vectors
      });
      expect(result).toEqual({ status: 'ok' });
    });

    it('should delete collection', async () => {
      const collectionName = 'test_collection';

      mockQdrant.deleteCollection.mockResolvedValue({ status: 'ok' });

      const result = await vectorService.deleteCollection(collectionName);

      expect(mockQdrant.deleteCollection).toHaveBeenCalledWith({
        collection_name: collectionName
      });
      expect(result).toEqual({ status: 'ok' });
    });

    it('should get collection info', async () => {
      const collectionName = 'test_collection';
      const mockInfo = {
        status: 'green',
        vectors_count: 1000,
        indexed_vectors_count: 1000,
        points_count: 1000
      };

      mockQdrant.getCollectionInfo.mockResolvedValue(mockInfo);

      const result = await vectorService.getCollectionInfo(collectionName);

      expect(mockQdrant.getCollectionInfo).toHaveBeenCalledWith({
        collection_name: collectionName
      });
      expect(result).toEqual(mockInfo);
    });
  });

  describe('Batch Operations', () => {
    it('should process batch embeddings', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9]
      ];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: mockEmbeddings.map(embedding => ({ embedding }))
      });

      const result = await vectorService.generateBatchEmbeddings(texts);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts
      });
      expect(result).toEqual(mockEmbeddings);
    });

    it('should handle batch processing errors', async () => {
      const texts = ['Text 1', 'Text 2'];

      mockOpenAI.embeddings.create.mockRejectedValue(new Error('Batch processing error'));

      await expect(vectorService.generateBatchEmbeddings(texts))
        .rejects.toThrow('Batch processing error');
    });
  });

  describe('Similarity Search', () => {
    it('should perform semantic search', async () => {
      const query = 'Find similar documents';
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          id: 'doc_1',
          score: 0.95,
          payload: { text: 'Similar document 1' }
        }
      ];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });
      mockQdrant.search.mockResolvedValue(mockResults);

      const result = await vectorService.semanticSearch('test_collection', query, 5);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: query
      });
      expect(mockQdrant.search).toHaveBeenCalledWith({
        collection_name: 'test_collection',
        vector: mockEmbedding,
        limit: 5,
        with_payload: true,
        with_vector: false
      });
      expect(result).toEqual(mockResults);
    });
  });

  describe('Vector Analytics', () => {
    it('should get collection statistics', async () => {
      const collectionName = 'test_collection';
      const mockStats = {
        total_points: 1000,
        indexed_points: 1000,
        collection_status: 'green'
      };

      mockQdrant.count.mockResolvedValue({ count: 1000 });
      mockQdrant.getCollectionInfo.mockResolvedValue({
        status: 'green',
        indexed_vectors_count: 1000
      });

      const result = await vectorService.getCollectionStats(collectionName);

      expect(result).toEqual({
        total_points: 1000,
        indexed_points: 1000,
        status: 'green'
      });
    });
  });
});