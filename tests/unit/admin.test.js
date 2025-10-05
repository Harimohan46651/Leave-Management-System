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
    
    if (req.headers['x-test-user'] === 'admin') {
      req.user = { id: 'admin-id', role: 'admin' };
    } else {
      req.user = { id: 'employee-id', role: 'employee' };
    }
    next();
  }
}));

const adminRoutes = require('../../src/routes/admin');

const app = express();
app.use(express.json());
app.use('/admin', adminRoutes);

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/leave-summary', () => {
    it('should return department-wise leave statistics for admin', async () => {
      const mockSummary = [
        {
          department: 'IT',
          total_requests: 15,
          approved: 12,
          rejected: 2,
          pending: 1,
          total_days_approved: 45,
          avg_days_per_request: 3.75
        },
        {
          department: 'HR',
          total_requests: 8,
          approved: 7,
          rejected: 0,
          pending: 1,
          total_days_approved: 21,
          avg_days_per_request: 3.0
        }
      ];

      mockPool.query.mockResolvedValueOnce([mockSummary]);

      const response = await request(app)
        .get('/admin/leave-summary')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('department', 'IT');
      expect(response.body[0]).toHaveProperty('total_requests', 15);
      expect(response.body[0]).toHaveProperty('approved', 12);
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/admin/leave-summary')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Admin access required');
    });

    it('should return 401 for missing authorization', async () => {
      const response = await request(app)
        .get('/admin/leave-summary');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authorization header missing');
    });
  });

  describe('GET /admin/pending-approvals', () => {
    it('should return all pending approvals for admin', async () => {
      const mockPendingApprovals = [
        {
          id: 'leave-1',
          leave_type: 'casual',
          start_date: '2024-02-01',
          end_date: '2024-02-03',
          total_days: 3,
          reason: 'Personal work',
          status: 'pending_rm',
          applied_at: '2024-01-15T10:30:00.000Z',
          employee_name: 'John Doe',
          employee_code: 'EMP001',
          department: 'IT',
          reporting_manager_name: 'Jane Smith',
          pending_with: 'Jane Smith'
        },
        {
          id: 'leave-2',
          leave_type: 'vacation',
          start_date: '2024-02-10',
          end_date: '2024-02-15',
          total_days: 6,
          reason: 'Family vacation',
          status: 'pending_hr',
          applied_at: '2024-01-16T14:20:00.000Z',
          employee_name: 'Alice Johnson',
          employee_code: 'EMP002',
          department: 'Marketing',
          reporting_manager_name: 'Bob Wilson',
          pending_with: 'HR Team'
        }
      ];

      mockPool.query.mockResolvedValueOnce([mockPendingApprovals]);

      const response = await request(app)
        .get('/admin/pending-approvals')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('status', 'pending_rm');
      expect(response.body[0]).toHaveProperty('pending_with', 'Jane Smith');
      expect(response.body[1]).toHaveProperty('status', 'pending_hr');
      expect(response.body[1]).toHaveProperty('pending_with', 'HR Team');
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/admin/pending-approvals')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Admin access required');
    });
  });

  describe('Database Query Tests', () => {
    it('should execute correct query for leave summary', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      await request(app)
        .get('/admin/leave-summary')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY e.department')
      );
    });

    it('should execute correct query for pending approvals', async () => {
      mockPool.query.mockResolvedValueOnce([[]]);

      await request(app)
        .get('/admin/pending-approvals')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE lr.status IN (\'pending_rm\', \'pending_hr\')')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/admin/leave-summary')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Database connection failed');
    });
  });
});