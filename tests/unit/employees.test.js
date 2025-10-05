const request = require('supertest');
const express = require('express');
const { mockConnectDB, mockPool } = require('../helpers/testSetup');

// Mock dependencies
jest.mock('../../src/db', () => ({
  connectDB: mockConnectDB
}));

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authorization header missing' });
    req.user = {
      id: 'test-employee-id',
      name: 'Test Employee',
      email: 'employee@test.com',
      role: 'employee'
    };
    next();
  }
}));

const employeesRoutes = require('../../src/routes/employees');

const app = express();
app.use(express.json());
app.use('/employees', employeesRoutes);

describe('Employees Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.end.mockResolvedValue();
  });

  describe('GET /employees/me', () => {
    it('should return current user profile', async () => {
      const userProfile = {
        id: 'test-employee-id',
        employee_code: 'EMP001',
        name: 'Test Employee',
        email: 'employee@test.com',
        department: 'IT',
        role: 'employee'
      };

      mockPool.query.mockResolvedValueOnce([[userProfile]]);

      const response = await request(app)
        .get('/employees/me')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-employee-id');
      expect(response.body).toHaveProperty('name', 'Test Employee');
      expect(response.body).toHaveProperty('email', 'employee@test.com');
    });

    it('should return 401 for missing authorization', async () => {
      const response = await request(app)
        .get('/employees/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authorization header missing');
    });

    it('should handle database errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/employees/me')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /employees/me/leave-balance', () => {
    it('should return leave balance with no used leaves', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/employees/me/leave-balance')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('casualLeave');
      expect(response.body).toHaveProperty('sickLeave');
      expect(response.body).toHaveProperty('vacationLeave');
      
      expect(response.body.casualLeave).toEqual({
        total: 12,
        used: 0,
        remaining: 12
      });
      expect(response.body.sickLeave).toEqual({
        total: 10,
        used: 0,
        remaining: 10
      });
      expect(response.body.vacationLeave).toEqual({
        total: 18,
        used: 0,
        remaining: 18
      });
    });

    it('should return leave balance with used leaves', async () => {
      const usedLeaves = [
        { leave_type: 'casual', used: 5 },
        { leave_type: 'sick', used: 2 },
        { leave_type: 'vacation', used: 10 }
      ];

      mockPool.query.mockResolvedValueOnce([usedLeaves]);

      const response = await request(app)
        .get('/employees/me/leave-balance')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(200);
      expect(response.body.casualLeave).toEqual({
        total: 12,
        used: 5,
        remaining: 7
      });
      expect(response.body.sickLeave).toEqual({
        total: 10,
        used: 2,
        remaining: 8
      });
      expect(response.body.vacationLeave).toEqual({
        total: 18,
        used: 10,
        remaining: 8
      });
    });

    it('should handle partial leave data', async () => {
      const usedLeaves = [
        { leave_type: 'casual', used: 3 }
      ];

      mockPool.query.mockResolvedValueOnce([usedLeaves]);

      const response = await request(app)
        .get('/employees/me/leave-balance')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(200);
      expect(response.body.casualLeave).toEqual({
        total: 12,
        used: 3,
        remaining: 9
      });
      expect(response.body.sickLeave).toEqual({
        total: 10,
        used: 0,
        remaining: 10
      });
      expect(response.body.vacationLeave).toEqual({
        total: 18,
        used: 0,
        remaining: 18
      });
    });

    it('should query correct data for current year', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      await request(app)
        .get('/employees/me/leave-balance')
        .set('Authorization', 'Bearer token123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('YEAR(start_date) = YEAR(CURDATE())'),
        ['test-employee-id']
      );
    });

    it('should handle database errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/employees/me/leave-balance')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Database connection failed');
    });
  });

  describe('Database Connection Management', () => {
    it('should close database connection after successful request', async () => {
      const userProfile = {
        id: 'test-employee-id',
        name: 'Test Employee',
        email: 'employee@test.com'
      };
      mockPool.query.mockResolvedValueOnce([[userProfile]]);

      await request(app)
        .get('/employees/me')
        .set('Authorization', 'Bearer token123');

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should close database connection after error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await request(app)
        .get('/employees/me')
        .set('Authorization', 'Bearer token123');

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});