/**
 * Authentication Routes Tests
 * Tests for login, signup, and token validation endpoints
 */

const request = require('supertest');
const express = require('express');
const authRoutes = require('../../../src/routes/auth');
const authController = require('../../../src/controllers/authController');
const authMiddleware = require('../../../src/middleware/authMiddleware');

// Mock dependencies
jest.mock('../../../src/controllers/authController');
jest.mock('../../../src/middleware/authMiddleware');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup express app for testing
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  describe('POST /auth/login', () => {
    it('should return 200 and token on successful login', async () => {
      // Mock successful login
      const mockUser = { id: '123', email: 'test@example.com', name: 'Test User' };
      const mockToken = 'valid-token-123';
      
      authController.login.mockResolvedValue({ 
        user: mockUser, 
        token: mockToken 
      });

      // Test endpoint
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect('Content-Type', /json/)
        .expect(200);

      // Assertions
      expect(response.body).toHaveProperty('token', mockToken);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toEqual(mockUser);
      expect(authController.login).toHaveBeenCalledWith(
        expect.objectContaining({ 
          email: 'test@example.com', 
          password: 'password123' 
        })
      );
    });

    it('should return 401 on invalid credentials', async () => {
      // Mock failed login
      authController.login.mockRejectedValue(new Error('Invalid credentials'));

      // Test endpoint
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrongpass' })
        .expect('Content-Type', /json/)
        .expect(401);

      // Assertions
      expect(response.body).toHaveProperty('error');
      expect(authController.login).toHaveBeenCalled();
    });
  });

  describe('POST /auth/signup', () => {
    it('should return 201 and user data on successful signup', async () => {
      // Mock successful signup
      const mockUser = { 
        id: '123', 
        email: 'new@example.com', 
        name: 'New User' 
      };
      
      authController.signup.mockResolvedValue({ 
        user: mockUser, 
        token: 'new-token-123' 
      });

      // Test endpoint
      const response = await request(app)
        .post('/auth/signup')
        .send({ 
          email: 'new@example.com', 
          password: 'newpass123', 
          name: 'New User' 
        })
        .expect('Content-Type', /json/)
        .expect(201);

      // Assertions
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual(mockUser);
      expect(authController.signup).toHaveBeenCalledWith(
        expect.objectContaining({ 
          email: 'new@example.com', 
          password: 'newpass123', 
          name: 'New User' 
        })
      );
    });

    it('should return 400 on validation error', async () => {
      // Mock validation error
      authController.signup.mockRejectedValue(new Error('Email already exists'));

      // Test endpoint
      const response = await request(app)
        .post('/auth/signup')
        .send({ 
          email: 'existing@example.com', 
          password: 'pass123' 
        })
        .expect('Content-Type', /json/)
        .expect(400);

      // Assertions
      expect(response.body).toHaveProperty('error');
      expect(authController.signup).toHaveBeenCalled();
    });
  });

  describe('GET /auth/verify', () => {
    it('should return 200 and user data on valid token', async () => {
      // Mock middleware and controller
      const mockUser = { id: '123', email: 'test@example.com' };
      authMiddleware.authenticate.mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });
      
      authController.verifyToken.mockResolvedValue({ 
        valid: true, 
        user: mockUser 
      });

      // Test endpoint
      const response = await request(app)
        .get('/auth/verify')
        .set('Authorization', 'Bearer valid-token')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assertions
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('user');
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(authController.verifyToken).toHaveBeenCalled();
    });

    it('should return 401 on invalid token', async () => {
      // Mock middleware rejection
      authMiddleware.authenticate.mockImplementation((req, res, next) => {
        return res.status(401).json({ error: 'Invalid token' });
      });

      // Test endpoint
      const response = await request(app)
        .get('/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/)
        .expect(401);

      // Assertions
      expect(response.body).toHaveProperty('error');
      expect(authMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 on successful logout', async () => {
      // Mock successful logout
      authController.logout.mockResolvedValue({ success: true });

      // Test endpoint
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assertions
      expect(response.body).toHaveProperty('success', true);
      expect(authController.logout).toHaveBeenCalled();
    });
  });
});