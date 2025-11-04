/**
 * User Service Tests
 * Tests for user service functions
 */

const userService = require('../../../src/services/userService');
const db = require('../../../src/db');

// Mock dependencies
jest.mock('../../../src/db');

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Mock data
      const userId = '123';
      const mockUser = { 
        id: userId, 
        email: 'test@example.com', 
        name: 'Test User' 
      };

      // Setup mock
      db.users.findById.mockResolvedValue(mockUser);

      // Call the function
      const result = await userService.findById(userId);

      // Assertions
      expect(result).toEqual(mockUser);
      expect(db.users.findById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      // Setup mock
      db.users.findById.mockResolvedValue(null);

      // Call the function
      const result = await userService.findById('nonexistent');

      // Assertions
      expect(result).toBeNull();
      expect(db.users.findById).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      // Mock data
      const email = 'test@example.com';
      const mockUser = { 
        id: '123', 
        email: email, 
        name: 'Test User' 
      };

      // Setup mock
      db.users.findByEmail.mockResolvedValue(mockUser);

      // Call the function
      const result = await userService.findByEmail(email);

      // Assertions
      expect(result).toEqual(mockUser);
      expect(db.users.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null when user not found', async () => {
      // Setup mock
      db.users.findByEmail.mockResolvedValue(null);

      // Call the function
      const result = await userService.findByEmail('nonexistent@example.com');

      // Assertions
      expect(result).toBeNull();
      expect(db.users.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });
  });

  describe('create', () => {
    it('should create and return new user', async () => {
      // Mock data
      const userData = {
        email: 'new@example.com',
        password: 'hashed_password',
        name: 'New User'
      };
      const createdUser = {
        id: '456',
        ...userData
      };

      // Setup mock
      db.users.create.mockResolvedValue(createdUser);

      // Call the function
      const result = await userService.create(userData);

      // Assertions
      expect(result).toEqual(createdUser);
      expect(db.users.create).toHaveBeenCalledWith(userData);
    });
  });

  describe('update', () => {
    it('should update and return user', async () => {
      // Mock data
      const userId = '123';
      const updateData = {
        name: 'Updated Name',
        profile: { bio: 'New bio' }
      };
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Updated Name',
        profile: { bio: 'New bio' }
      };

      // Setup mock
      db.users.update.mockResolvedValue(updatedUser);

      // Call the function
      const result = await userService.update(userId, updateData);

      // Assertions
      expect(result).toEqual(updatedUser);
      expect(db.users.update).toHaveBeenCalledWith(userId, updateData);
    });

    it('should return null when user not found', async () => {
      // Setup mock
      db.users.update.mockResolvedValue(null);

      // Call the function
      const result = await userService.update('nonexistent', { name: 'New Name' });

      // Assertions
      expect(result).toBeNull();
      expect(db.users.update).toHaveBeenCalledWith('nonexistent', { name: 'New Name' });
    });
  });

  describe('delete', () => {
    it('should delete user and return success', async () => {
      // Mock data
      const userId = '123';

      // Setup mock
      db.users.delete.mockResolvedValue(true);

      // Call the function
      const result = await userService.delete(userId);

      // Assertions
      expect(result).toBe(true);
      expect(db.users.delete).toHaveBeenCalledWith(userId);
    });

    it('should return false when user not found', async () => {
      // Setup mock
      db.users.delete.mockResolvedValue(false);

      // Call the function
      const result = await userService.delete('nonexistent');

      // Assertions
      expect(result).toBe(false);
      expect(db.users.delete).toHaveBeenCalledWith('nonexistent');
    });
  });
});