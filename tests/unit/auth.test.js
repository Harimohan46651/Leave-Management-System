const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { mockConnectDB, mockPool } = require('../helpers/testSetup');

const JWT_SECRET = process.env.JWT_SECRET || 'secret token';

// Mock dependencies
jest.mock('../../src/db', () => ({
  connectDB: mockConnectDB
}));

const authRoutes = require('../../src/routes/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      mockPool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'employee'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'registered');
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User'
          // Missing email and password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'name, email, password required');
    });
  });

  describe('POST /auth/login', () => {
    it('should login user with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockPool.query.mockResolvedValueOnce([[{
        id: 'user-id',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'employee',
        name: 'Test User'
      }]]);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      
      // Verify token
      const decoded = jwt.verify(response.body.token, JWT_SECRET);
      expect(decoded.email).toBe('test@example.com');
    });

    it('should return 401 for invalid credentials', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'email and password required');
    });
  });
});