/**
 * Auth Controller Tests
 * Tests for authentication controller functions
 */

const authController = require('../../../src/controllers/authController');
const userService = require('../../../src/services/userService');
const tokenService = require('../../../src/services/tokenService');
const bcrypt = require('bcrypt');

// Mock dependencies
jest.mock('../../../src/services/userService');
jest.mock('../../../src/services/tokenService');
jest.mock('bcrypt');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return user and token on successful login', async () => {
      // Mock data
      const mockUser = { 
        id: '123', 
        email: 'test@example.com', 
        password: 'hashed_password',
        name: 'Test User'
      };
      const mockToken = 'valid-token-123';
      const loginData = { 
        email: 'test@example.com', 
        password: 'password123' 
      };

      // Setup mocks
      userService.findByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.generateToken.mockReturnValue(mockToken);

      // Call the function
      const result = await authController.login(loginData);

      // Assertions
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token', mockToken);
      expect(result.user).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      }));
      expect(result.user).not.toHaveProperty('password');
      expect(userService.findByEmail).toHaveBeenCalledWith(loginData.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password);
      expect(tokenService.generateToken).toHaveBeenCalledWith({ userId: mockUser.id });
    });

    it('should throw error when user not found', async () => {
      // Setup mocks
      userService.findByEmail.mockResolvedValue(null);

      // Call and assertions
      await expect(authController.login({ 
        email: 'nonexistent@example.com', 
        password: 'password123' 
      })).rejects.toThrow('Invalid credentials');
      
      expect(userService.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error when password is incorrect', async () => {
      // Mock data
      const mockUser = { 
        id: '123', 
        email: 'test@example.com', 
        password: 'hashed_password' 
      };

      // Setup mocks
      userService.findByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      // Call and assertions
      await expect(authController.login({ 
        email: 'test@example.com', 
        password: 'wrong_password' 
      })).rejects.toThrow('Invalid credentials');
      
      expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong_password', mockUser.password);
    });
  });

  describe('signup', () => {
    it('should create user and return user with token', async () => {
      // Mock data
      const signupData = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User'
      };
      const hashedPassword = 'hashed_password_123';
      const mockUser = { 
        id: '456', 
        email: signupData.email,
        name: signupData.name
      };
      const mockToken = 'new-token-456';

      // Setup mocks
      userService.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue(hashedPassword);
      userService.create.mockResolvedValue(mockUser);
      tokenService.generateToken.mockReturnValue(mockToken);

      // Call the function
      const result = await authController.signup(signupData);

      // Assertions
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token', mockToken);
      expect(result.user).toEqual(mockUser);
      expect(userService.findByEmail).toHaveBeenCalledWith(signupData.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(signupData.password, expect.any(Number));
      expect(userService.create).toHaveBeenCalledWith({
        email: signupData.email,
        password: hashedPassword,
        name: signupData.name
      });
      expect(tokenService.generateToken).toHaveBeenCalledWith({ userId: mockUser.id });
    });

    it('should throw error when email already exists', async () => {
      // Mock data
      const signupData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User'
      };
      const existingUser = { 
        id: '789', 
        email: signupData.email 
      };

      // Setup mocks
      userService.findByEmail.mockResolvedValue(existingUser);

      // Call and assertions
      await expect(authController.signup(signupData))
        .rejects.toThrow('Email already in use');
      
      expect(userService.findByEmail).toHaveBeenCalledWith(signupData.email);
      expect(userService.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return valid=true and user data when token is valid', async () => {
      // Mock data
      const mockToken = 'valid-token-123';
      const decodedToken = { userId: '123' };
      const mockUser = { 
        id: '123', 
        email: 'test@example.com',
        name: 'Test User'
      };

      // Setup mocks
      tokenService.verifyToken.mockReturnValue(decodedToken);
      userService.findById.mockResolvedValue(mockUser);

      // Call the function
      const result = await authController.verifyToken(mockToken);

      // Assertions
      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual(mockUser);
      expect(tokenService.verifyToken).toHaveBeenCalledWith(mockToken);
      expect(userService.findById).toHaveBeenCalledWith(decodedToken.userId);
    });

    it('should return valid=false when token verification fails', async () => {
      // Mock data
      const mockToken = 'invalid-token';

      // Setup mocks
      tokenService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Call the function
      const result = await authController.verifyToken(mockToken);

      // Assertions
      expect(result).toHaveProperty('valid', false);
      expect(result).not.toHaveProperty('user');
      expect(tokenService.verifyToken).toHaveBeenCalledWith(mockToken);
      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('should return valid=false when user not found', async () => {
      // Mock data
      const mockToken = 'valid-token-unknown-user';
      const decodedToken = { userId: 'unknown' };

      // Setup mocks
      tokenService.verifyToken.mockReturnValue(decodedToken);
      userService.findById.mockResolvedValue(null);

      // Call the function
      const result = await authController.verifyToken(mockToken);

      // Assertions
      expect(result).toHaveProperty('valid', false);
      expect(result).not.toHaveProperty('user');
      expect(tokenService.verifyToken).toHaveBeenCalledWith(mockToken);
      expect(userService.findById).toHaveBeenCalledWith(decodedToken.userId);
    });
  });

  describe('logout', () => {
    it('should invalidate token and return success', async () => {
      // Mock data
      const mockToken = 'token-to-invalidate';
      
      // Setup mocks
      tokenService.invalidateToken.mockResolvedValue(true);

      // Call the function
      const result = await authController.logout(mockToken);

      // Assertions
      expect(result).toHaveProperty('success', true);
      expect(tokenService.invalidateToken).toHaveBeenCalledWith(mockToken);
    });
  });
});