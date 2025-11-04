/**
 * Tests for Health Check Middleware
 */

const { jest } = require('@jest/globals');
const healthCheck = require('../../../src/middleware/healthCheck');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }], rowCount: 1 }),
    end: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('redis', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  }))
}));

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn().mockResolvedValue({
      size: 1024,
      isDirectory: () => false,
      isFile: () => true
    }),
    readdir: jest.fn().mockResolvedValue(['file1', 'file2'])
  }
}));

// Mock Express request and response
const mockRequest = () => ({
  query: {},
  params: {},
  body: {}
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Health Check Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 200 OK for /health endpoint', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    await healthCheck.healthCheck(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('status');
    expect(responseData.status).toBe('ok');
  });

  test('should return detailed health info for /health/details endpoint', async () => {
    const req = {
      ...mockRequest(),
      path: '/health/details'
    };
    const res = mockResponse();
    
    await healthCheck.healthCheckDetailed(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('status');
    expect(responseData).toHaveProperty('checks');
    expect(responseData).toHaveProperty('metrics');
  });

  test('should handle database check', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    await healthCheck.checkDatabase(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('status');
    expect(responseData).toHaveProperty('message');
  });

  test('should handle redis check', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    await healthCheck.checkRedis(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('status');
    expect(responseData).toHaveProperty('message');
  });

  test('should handle system check', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    await healthCheck.checkSystem(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('status');
    expect(responseData).toHaveProperty('metrics');
  });

  test('should handle errors gracefully', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    // Force an error
    jest.spyOn(healthCheck, 'runHealthChecks').mockRejectedValueOnce(new Error('Test error'));
    
    await healthCheck.healthCheck(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty('status');
    expect(responseData.status).toBe('error');
  });

  test('should track performance metrics', async () => {
    const req = mockRequest();
    const res = mockResponse();
    
    await healthCheck.trackPerformance(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    
    // Simulate request completion
    res.on = jest.fn().mockImplementation((event, callback) => {
      if (event === 'finish') {
        callback();
      }
      return res;
    });
    
    // Trigger the 'finish' event handler
    res.on('finish', () => {});
    
    // Check that metrics were updated
    expect(healthCheck.getPerformanceMetrics).toBeDefined();
    const metrics = healthCheck.getPerformanceMetrics();
    expect(metrics).toHaveProperty('requestCount');
    expect(metrics.requestCount).toBeGreaterThan(0);
  });
});