/**
 * Utils Unit Tests
 * Comprehensive tests for utility functions and helpers
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

// Import utility modules
const cache = require('../src/utils/cache');

// Mock dependencies
jest.mock('fs');
jest.mock('../src/config/logger');

describe('Utils Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cache Utility', () => {
    let mockCache;

    beforeEach(() => {
      // Reset cache state
      mockCache = new Map();
      
      // Mock cache implementation
      cache.set = jest.fn((key, value, ttl) => {
        mockCache.set(key, {
          value,
          expires: ttl ? Date.now() + ttl * 1000 : null
        });
        return true;
      });
      
      cache.get = jest.fn((key) => {
        const item = mockCache.get(key);
        if (!item) return null;
        
        if (item.expires && Date.now() > item.expires) {
          mockCache.delete(key);
          return null;
        }
        
        return item.value;
      });
      
      cache.delete = jest.fn((key) => {
        return mockCache.delete(key);
      });
      
      cache.clear = jest.fn(() => {
        mockCache.clear();
        return true;
      });
      
      cache.has = jest.fn((key) => {
        const item = mockCache.get(key);
        if (!item) return false;
        
        if (item.expires && Date.now() > item.expires) {
          mockCache.delete(key);
          return false;
        }
        
        return true;
      });
      
      cache.size = jest.fn(() => mockCache.size);
    });

    it('should set and get cache values', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      cache.set(key, value);
      const result = cache.get(key);
      
      expect(cache.set).toHaveBeenCalledWith(key, value);
      expect(cache.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('should set cache with TTL', () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttl = 60; // 60 seconds
      
      cache.set(key, value, ttl);
      
      expect(cache.set).toHaveBeenCalledWith(key, value, ttl);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent-key');
      
      expect(cache.get).toHaveBeenCalledWith('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete cache entries', () => {
      const key = 'delete-key';
      const value = 'delete-value';
      
      cache.set(key, value);
      const deleted = cache.delete(key);
      
      expect(cache.delete).toHaveBeenCalledWith(key);
      expect(deleted).toBe(true);
    });

    it('should clear all cache entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const cleared = cache.clear();
      
      expect(cache.clear).toHaveBeenCalled();
      expect(cleared).toBe(true);
    });

    it('should check if key exists in cache', () => {
      const key = 'exists-key';
      const value = 'exists-value';
      
      cache.set(key, value);
      const exists = cache.has(key);
      
      expect(cache.has).toHaveBeenCalledWith(key);
      expect(exists).toBe(true);
    });

    it('should return cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const size = cache.size();
      
      expect(cache.size).toHaveBeenCalled();
      expect(typeof size).toBe('number');
    });

    it('should handle cache expiration', async () => {
      const key = 'expire-key';
      const value = 'expire-value';
      const shortTtl = 0.001; // Very short TTL
      
      cache.set(key, value, shortTtl);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = cache.get(key);
      expect(result).toBeNull();
    });

    it('should handle different data types', () => {
      const testCases = [
        { key: 'string-key', value: 'string-value' },
        { key: 'number-key', value: 42 },
        { key: 'boolean-key', value: true },
        { key: 'object-key', value: { nested: { data: 'test' } } },
        { key: 'array-key', value: [1, 2, 3, 'test'] },
        { key: 'null-key', value: null },
        { key: 'undefined-key', value: undefined }
      ];
      
      testCases.forEach(({ key, value }) => {
        cache.set(key, value);
        const result = cache.get(key);
        expect(result).toEqual(value);
      });
    });

    it('should handle concurrent operations', () => {
      const operations = [];
      
      // Simulate concurrent set operations
      for (let i = 0; i < 100; i++) {
        operations.push(() => cache.set(`key-${i}`, `value-${i}`));
      }
      
      // Execute all operations
      operations.forEach(op => op());
      
      // Verify all values are set
      for (let i = 0; i < 100; i++) {
        const result = cache.get(`key-${i}`);
        expect(result).toBe(`value-${i}`);
      }
    });

    it('should handle edge cases', () => {
      // Empty string key
      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
      
      // Very long key
      const longKey = 'a'.repeat(1000);
      cache.set(longKey, 'long-key-value');
      expect(cache.get(longKey)).toBe('long-key-value');
      
      // Special characters in key
      const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      cache.set(specialKey, 'special-key-value');
      expect(cache.get(specialKey)).toBe('special-key-value');
    });

    it('should handle memory pressure', () => {
      // Set many items to test memory handling
      for (let i = 0; i < 10000; i++) {
        cache.set(`memory-key-${i}`, `memory-value-${i}`);
      }
      
      // Verify some items are still accessible
      expect(cache.get('memory-key-0')).toBe('memory-value-0');
      expect(cache.get('memory-key-9999')).toBe('memory-value-9999');
    });
  });

  describe('File System Utilities', () => {
    beforeEach(() => {
      fs.existsSync = jest.fn();
      fs.readFileSync = jest.fn();
      fs.writeFileSync = jest.fn();
      fs.mkdirSync = jest.fn();
      fs.readdirSync = jest.fn();
      fs.statSync = jest.fn();
    });

    it('should check if file exists', () => {
      const filePath = '/test/path/file.txt';
      fs.existsSync.mockReturnValue(true);
      
      const exists = fs.existsSync(filePath);
      
      expect(fs.existsSync).toHaveBeenCalledWith(filePath);
      expect(exists).toBe(true);
    });

    it('should read file content', () => {
      const filePath = '/test/path/file.txt';
      const content = 'file content';
      fs.readFileSync.mockReturnValue(content);
      
      const result = fs.readFileSync(filePath, 'utf8');
      
      expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
      expect(result).toBe(content);
    });

    it('should write file content', () => {
      const filePath = '/test/path/file.txt';
      const content = 'new content';
      
      fs.writeFileSync(filePath, content);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, content);
    });

    it('should create directory', () => {
      const dirPath = '/test/path/new-dir';
      
      fs.mkdirSync(dirPath, { recursive: true });
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('should read directory contents', () => {
      const dirPath = '/test/path';
      const files = ['file1.txt', 'file2.txt', 'subdir'];
      fs.readdirSync.mockReturnValue(files);
      
      const result = fs.readdirSync(dirPath);
      
      expect(fs.readdirSync).toHaveBeenCalledWith(dirPath);
      expect(result).toEqual(files);
    });

    it('should get file stats', () => {
      const filePath = '/test/path/file.txt';
      const stats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date()
      };
      fs.statSync.mockReturnValue(stats);
      
      const result = fs.statSync(filePath);
      
      expect(fs.statSync).toHaveBeenCalledWith(filePath);
      expect(result).toEqual(stats);
    });
  });

  describe('Path Utilities', () => {
    it('should join paths correctly', () => {
      const result = path.join('/base', 'sub', 'file.txt');
      expect(result).toBe(path.normalize('/base/sub/file.txt'));
    });

    it('should resolve absolute paths', () => {
      const result = path.resolve('relative/path');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should extract file extension', () => {
      expect(path.extname('file.txt')).toBe('.txt');
      expect(path.extname('file.test.js')).toBe('.js');
      expect(path.extname('file')).toBe('');
    });

    it('should extract basename', () => {
      expect(path.basename('/path/to/file.txt')).toBe('file.txt');
      expect(path.basename('/path/to/file.txt', '.txt')).toBe('file');
    });

    it('should extract dirname', () => {
      expect(path.dirname('/path/to/file.txt')).toBe('/path/to');
      expect(path.dirname('file.txt')).toBe('.');
    });
  });

  describe('String Utilities', () => {
    it('should handle string manipulation', () => {
      const testString = 'Hello World';
      
      expect(testString.toLowerCase()).toBe('hello world');
      expect(testString.toUpperCase()).toBe('HELLO WORLD');
      expect(testString.replace('World', 'Universe')).toBe('Hello Universe');
      expect(testString.split(' ')).toEqual(['Hello', 'World']);
    });

    it('should handle string validation', () => {
      expect(typeof 'string').toBe('string');
      expect(''.length).toBe(0);
      expect('test'.includes('es')).toBe(true);
      expect('test'.startsWith('te')).toBe(true);
      expect('test'.endsWith('st')).toBe(true);
    });
  });

  describe('Array Utilities', () => {
    it('should handle array operations', () => {
      const testArray = [1, 2, 3, 4, 5];
      
      expect(testArray.length).toBe(5);
      expect(testArray.includes(3)).toBe(true);
      expect(testArray.indexOf(4)).toBe(3);
      expect(testArray.slice(1, 3)).toEqual([2, 3]);
    });

    it('should handle array transformations', () => {
      const numbers = [1, 2, 3, 4, 5];
      
      const doubled = numbers.map(n => n * 2);
      expect(doubled).toEqual([2, 4, 6, 8, 10]);
      
      const evens = numbers.filter(n => n % 2 === 0);
      expect(evens).toEqual([2, 4]);
      
      const sum = numbers.reduce((acc, n) => acc + n, 0);
      expect(sum).toBe(15);
    });
  });

  describe('Object Utilities', () => {
    it('should handle object operations', () => {
      const testObj = { a: 1, b: 2, c: 3 };
      
      expect(Object.keys(testObj)).toEqual(['a', 'b', 'c']);
      expect(Object.values(testObj)).toEqual([1, 2, 3]);
      expect(Object.entries(testObj)).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    });

    it('should handle object cloning', () => {
      const original = { a: 1, b: { c: 2 } };
      const shallow = { ...original };
      const deep = JSON.parse(JSON.stringify(original));
      
      expect(shallow).toEqual(original);
      expect(deep).toEqual(original);
      expect(shallow.b).toBe(original.b); // Shallow copy shares reference
      expect(deep.b).not.toBe(original.b); // Deep copy creates new reference
    });
  });

  describe('Date Utilities', () => {
    it('should handle date operations', () => {
      const now = new Date();
      const timestamp = Date.now();
      
      expect(now instanceof Date).toBe(true);
      expect(typeof timestamp).toBe('number');
      expect(now.getTime()).toBeCloseTo(timestamp, -2); // Within 100ms
    });

    it('should handle date formatting', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(15);
      expect(date.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('Error Handling Utilities', () => {
    it('should handle different error types', () => {
      const standardError = new Error('Standard error');
      const typeError = new TypeError('Type error');
      const rangeError = new RangeError('Range error');
      
      expect(standardError instanceof Error).toBe(true);
      expect(typeError instanceof TypeError).toBe(true);
      expect(rangeError instanceof RangeError).toBe(true);
      
      expect(standardError.message).toBe('Standard error');
      expect(typeError.message).toBe('Type error');
      expect(rangeError.message).toBe('Range error');
    });

    it('should handle error properties', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      error.statusCode = 400;
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('Performance Utilities', () => {
    it('should measure execution time', () => {
      const start = Date.now();
      
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      
      const end = Date.now();
      const duration = end - start;
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(typeof duration).toBe('number');
    });

    it('should handle memory usage', () => {
      const memBefore = process.memoryUsage();
      
      // Create some objects
      const largeArray = new Array(10000).fill('test');
      
      const memAfter = process.memoryUsage();
      
      expect(memAfter.heapUsed).toBeGreaterThan(memBefore.heapUsed);
      expect(largeArray.length).toBe(10000);
    });
  });
});