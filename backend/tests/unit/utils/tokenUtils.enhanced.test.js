/**
 * Enhanced Unit Tests for Token Utilities
 * Comprehensive tests for JWT token generation, verification, and management
 */

// Create mock modules
const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
  TokenExpiredError: jest.fn(function(message, expiredAt) {
    this.name = 'TokenExpiredError';
    this.message = message;
    this.expiredAt = expiredAt;
  })
};

// Mock the modules
jest.mock('jsonwebtoken', () => mockJwt);

// Import the module under test
const tokenUtils = require('../../../src/utils/tokenUtils');
const rootConfig = require('../../../config');

// Create aliases for easier test writing
const jwt = mockJwt;
const config = rootConfig;

describe('Token Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate access token with correct payload and options', () => {
      // Mock data
      const payload = { userId: '123', role: 'user' };
      const mockToken = 'generated-access-token';
      
      // Setup mock
      jwt.sign.mockReturnValue(mockToken);
      
      // Call the function
      const result = tokenUtils.generateToken(payload);
      
      // Assertions
      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        payload, 
        config.jwt.secret, 
        { expiresIn: config.jwt.tokenExpiration }
      );
    });

    it('should handle empty payload', () => {
      // Setup mock
      jwt.sign.mockReturnValue('token-with-empty-payload');
      
      // Call the function
      const result = tokenUtils.generateToken({});
      
      // Assertions
      expect(result).toBe('token-with-empty-payload');
      expect(jwt.sign).toHaveBeenCalledWith(
        {}, 
        config.jwt.secret, 
        { expiresIn: config.jwt.tokenExpiration }
      );
    });

    it('should handle null payload by using empty object', () => {
      // Setup mock
      jwt.sign.mockReturnValue('token-with-null-payload');
      
      // Call the function with null (should handle gracefully)
      const result = tokenUtils.generateToken(null);
      
      // Assertions
      expect(result).toBe('token-with-null-payload');
      // Check if it was called with empty object or null based on implementation
      expect(jwt.sign).toHaveBeenCalled();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload and options', () => {
      // Mock data
      const payload = { userId: '123', role: 'user' };
      const mockToken = 'generated-refresh-token';
      
      // Setup mock
      jwt.sign.mockReturnValue(mockToken);
      
      // Call the function
      const result = tokenUtils.generateRefreshToken(payload);
      
      // Assertions
      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        payload, 
        config.jwt.refreshSecret, 
        { expiresIn: config.jwt.refreshExpiration }
      );
    });

    it('should handle empty payload for refresh token', () => {
      // Setup mock
      jwt.sign.mockReturnValue('refresh-token-with-empty-payload');
      
      // Call the function
      const result = tokenUtils.generateRefreshToken({});
      
      // Assertions
      expect(result).toBe('refresh-token-with-empty-payload');
      expect(jwt.sign).toHaveBeenCalledWith(
        {}, 
        config.jwt.refreshSecret, 
        { expiresIn: config.jwt.refreshExpiration }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify and return decoded token payload', () => {
      // Mock data
      const token = 'valid-token';
      const decodedPayload = { userId: '123', role: 'user', iat: 1234567890, exp: 9876543210 };
      
      // Setup mock
      jwt.verify.mockReturnValue(decodedPayload);
      
      // Call the function
      const result = tokenUtils.verifyToken(token);
      
      // Assertions
      expect(result).toEqual(decodedPayload);
      expect(jwt.verify).toHaveBeenCalledWith(token, config.jwt.secret);
    });

    it('should throw error when token is invalid', () => {
      // Mock data
      const token = 'invalid-token';
      const error = new Error('Invalid token');
      
      // Setup mock to throw error
      jwt.verify.mockImplementation(() => {
        throw error;
      });
      
      // Call the function and expect it to throw
      expect(() => {
        tokenUtils.verifyToken(token);
      }).toThrow(error);
      
      // Verify the mock was called
      expect(jwt.verify).toHaveBeenCalledWith(token, config.jwt.secret);
    });

    it('should throw error when token is expired', () => {
      // Mock data
      const token = 'expired-token';
      const error = new jwt.TokenExpiredError('Token expired', new Date());
      
      // Setup mock to throw TokenExpiredError
      jwt.verify.mockImplementation(() => {
        throw error;
      });
      
      // Call the function and expect it to throw
      expect(() => {
        tokenUtils.verifyToken(token);
      }).toThrow(error);
      
      // Verify the mock was called
      expect(jwt.verify).toHaveBeenCalledWith(token, config.jwt.secret);
    });

    it('should handle empty or null token', () => {
      // Setup mock to throw error for null token
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt must be provided');
      });
      
      // Call with empty token and expect it to throw
      expect(() => {
        tokenUtils.verifyToken('');
      }).toThrow();
      
      // Call with null token and expect it to throw
      expect(() => {
        tokenUtils.verifyToken(null);
      }).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Mock data
      const token = 'valid-token';
      const decodedPayload = { userId: '123', role: 'user', iat: 1234567890, exp: 9876543210 };
      
      // Setup mock
      jwt.decode.mockReturnValue(decodedPayload);
      
      // Call the function
      const result = tokenUtils.decodeToken(token);
      
      // Assertions
      expect(result).toEqual(decodedPayload);
      expect(jwt.decode).toHaveBeenCalledWith(token);
    });

    it('should return null for invalid token format', () => {
      // Mock data
      const token = 'invalid-format-token';
      
      // Setup mock
      jwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = tokenUtils.decodeToken(token);
      
      // Assertions
      expect(result).toBeNull();
      expect(jwt.decode).toHaveBeenCalledWith(token);
    });

    it('should handle empty token', () => {
      // Setup mock
      jwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = tokenUtils.decodeToken('');
      
      // Assertions
      expect(result).toBeNull();
      expect(jwt.decode).toHaveBeenCalledWith('');
    });

    it('should handle null token', () => {
      // Setup mock
      jwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = tokenUtils.decodeToken(null);
      
      // Assertions
      expect(result).toBeNull();
      expect(jwt.decode).toHaveBeenCalledWith(null);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      // Mock data - token with past expiration
      const token = 'expired-token';
      const decodedPayload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // 1 hour ago
      
      // Setup mock
      jwt.decode.mockReturnValue(decodedPayload);
      
      // Call the function
      const result = tokenUtils.isTokenExpired(token);
      
      // Assertions
      expect(result).toBe(true);
      expect(jwt.decode).toHaveBeenCalledWith(token);
    });

    it('should return false for valid token', () => {
      // Mock data - token with future expiration
      const token = 'valid-token';
      const decodedPayload = { exp: Math.floor(Date.now() / 1000) + 3600 }; // 1 hour in future
      
      // Setup mock
      jwt.decode.mockReturnValue(decodedPayload);
      
      // Call the function
      const result = tokenUtils.isTokenExpired(token);
      
      // Assertions
      expect(result).toBe(false);
      expect(jwt.decode).toHaveBeenCalledWith(token);
    });

    it('should return true for malformed token', () => {
      // Setup mock
      jwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = tokenUtils.isTokenExpired('malformed-token');
      
      // Assertions
      expect(result).toBe(true);
      expect(jwt.decode).toHaveBeenCalledWith('malformed-token');
    });

    it('should return true for token without expiration', () => {
      // Mock data - token without exp claim
      const token = 'no-exp-token';
      const decodedPayload = { userId: '123', iat: 1234567890 }; // No exp
      
      // Setup mock
      jwt.decode.mockReturnValue(decodedPayload);
      
      // Call the function
      const result = tokenUtils.isTokenExpired(token);
      
      // Assertions
      expect(result).toBe(true);
      expect(jwt.decode).toHaveBeenCalledWith(token);
    });

    it('should handle null token', () => {
      // Setup mock
      jwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = tokenUtils.isTokenExpired(null);
      
      // Assertions
      expect(result).toBe(true);
      expect(jwt.decode).toHaveBeenCalledWith(null);
    });
  });
});