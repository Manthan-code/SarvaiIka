/**
 * Unit Tests for Token Utilities
 * Tests for JWT token generation, verification, and management
 */

// Create mock modules
const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn()
};

const mockConfig = {
  jwt: {
    secret: 'test-secret',
    refreshSecret: 'refresh-secret',
    tokenExpiration: '1h',
    refreshExpiration: '7d'
  }
};

// Mock the modules
jest.mock('jsonwebtoken', () => mockJwt);
jest.mock('../../../config', () => mockConfig);

// Import after mocking
const tokenUtils = require('../../../utils/tokenUtils');

// Create alias for easier test writing
const mockTokenUtils = tokenUtils;

describe('Token Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate access token with correct payload and options', () => {
      // Mock data
      const payload = { userId: '123' };
      const mockToken = 'generated-access-token';
      
      // Setup mock
      mockJwt.sign.mockReturnValue(mockToken);
      
      // Call the function
      const result = mockTokenUtils.generateToken(payload);
      
      // Assertions
      expect(result).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        payload,
        mockConfig.jwt.secret,
        { expiresIn: mockConfig.jwt.tokenExpiration }
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload and options', () => {
      // Mock data
      const payload = { userId: '123' };
      const mockToken = 'generated-refresh-token';
      
      // Setup mock
      mockJwt.sign.mockReturnValue(mockToken);
      
      // Call the function
      const result = mockTokenUtils.generateRefreshToken(payload);
      
      // Assertions
      expect(result).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        payload,
        mockConfig.jwt.refreshSecret,
        { expiresIn: mockConfig.jwt.refreshExpiration }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify and return decoded token payload', () => {
      // Mock data
      const token = 'valid-token';
      const decodedToken = { userId: '123', iat: 1000, exp: 2000 };
      
      // Setup mock
      mockJwt.verify.mockReturnValue(decodedToken);
      
      // Call the function
      const result = mockTokenUtils.verifyToken(token);
      
      // Assertions
      expect(result).toEqual(decodedToken);
      expect(mockJwt.verify).toHaveBeenCalledWith(token, mockConfig.jwt.secret);
    });

    it('should throw error when token is invalid', () => {
      // Mock data
      const token = 'invalid-token';
      
      // Setup mock
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      // Call and assertions
      expect(() => mockTokenUtils.verifyToken(token)).toThrow('Invalid token');
      expect(mockJwt.verify).toHaveBeenCalledWith(token, mockConfig.jwt.secret);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Mock data
      const token = 'any-token';
      const decodedToken = { userId: '123', iat: 1000, exp: 2000 };
      
      // Setup mock
      mockJwt.decode.mockReturnValue(decodedToken);
      
      // Call the function
      const result = mockTokenUtils.decodeToken(token);
      
      // Assertions
      expect(result).toEqual(decodedToken);
      expect(mockJwt.decode).toHaveBeenCalledWith(token);
    });

    it('should return null for invalid token format', () => {
      // Setup mock
      mockJwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = mockTokenUtils.decodeToken('malformed-token');
      
      // Assertions
      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      // Mock data - token expired 1 hour ago
      const expiredToken = 'expired-token';
      const now = Math.floor(Date.now() / 1000);
      const decodedToken = { exp: now - 3600 };
      
      // Setup mock
      mockJwt.decode.mockReturnValue(decodedToken);
      
      // Call the function
      const result = mockTokenUtils.isTokenExpired(expiredToken);
      
      // Assertions
      expect(result).toBe(true);
    });

    it('should return false for valid token', () => {
      // Mock data - token expires 1 hour from now
      const validToken = 'valid-token';
      const now = Math.floor(Date.now() / 1000);
      const decodedToken = { exp: now + 3600 };
      
      // Setup mock
      mockJwt.decode.mockReturnValue(decodedToken);
      
      // Call the function
      const result = mockTokenUtils.isTokenExpired(validToken);
      
      // Assertions
      expect(result).toBe(false);
    });

    it('should return true for malformed token', () => {
      // Setup mock
      mockJwt.decode.mockReturnValue(null);
      
      // Call the function
      const result = mockTokenUtils.isTokenExpired('malformed-token');
      
      // Assertions
      expect(result).toBe(true);
    });
  });
});