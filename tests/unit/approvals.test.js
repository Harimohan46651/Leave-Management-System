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
    
    if (req.headers['x-test-user'] === 'manager') {
      req.user = { id: 'manager-id', role: 'reporting_manager' };
    } else if (req.headers['x-test-user'] === 'hr') {
      req.user = { id: 'hr-id', role: 'hr_manager' };
    } else {
      req.user = { id: 'employee-id', role: 'employee' };
    }
    next();
  }
}));

const approvalsRoutes = require('../../src/routes/approvals');

const app = express();
app.use(express.json());
app.use('/approvals', approvalsRoutes);

describe('Approvals Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /approvals/pending', () => {
    it('should return pending approvals for reporting manager', async () => {
      const pendingLeaves = [{
        id: 'leave-1',
        employee_name: 'Test Employee',
        employee_code: 'EMP001',
        status: 'pending_rm'
      }];
      
      mockPool.query.mockResolvedValueOnce([pendingLeaves]);

      const response = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'manager');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('employee_name', 'Test Employee');
    });

    it('should return pending approvals for HR manager', async () => {
      const pendingLeaves = [{
        id: 'leave-1',
        status: 'pending_hr',
        employee_name: 'Test Employee',
        employee_code: 'EMP001'
      }];
      
      mockPool.query.mockResolvedValueOnce([pendingLeaves]);

      const response = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'hr');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('status', 'pending_hr');
    });

    it('should deny access to non-manager users', async () => {
      const response = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied. Manager role required.');
    });

    it('should return 401 for missing authorization', async () => {
      const response = await request(app)
        .get('/approvals/pending');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authorization header missing');
    });
  });

  describe('Authorization Tests', () => {
    it('should allow only managers and HR to access pending approvals', async () => {
      // Test employee access (should fail)
      const employeeResponse = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123');

      expect(employeeResponse.status).toBe(403);

      // Test manager access (should succeed)
      mockPool.query.mockResolvedValueOnce([[]]);
      const managerResponse = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'manager');

      expect(managerResponse.status).toBe(200);

      // Test HR access (should succeed)
      mockPool.query.mockResolvedValueOnce([[]]);
      const hrResponse = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'hr');

      expect(hrResponse.status).toBe(200);
    });
  });

  describe('Database Query Tests', () => {
    it('should query correct table for reporting manager', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'manager');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.reporting_manager_id = ? AND lr.status = \'pending_rm\''),
        ['manager-id']
      );
    });

    it('should query correct table for HR manager', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'hr');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE lr.status = \'pending_hr\''),
        ['hr-id']
      );
    });
  });
});