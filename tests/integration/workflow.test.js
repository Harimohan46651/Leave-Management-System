const request = require('supertest');
const express = require('express');
const { mockConnectDB, mockPool } = require('../helpers/testSetup');

// Mock all dependencies
jest.mock('../../src/db', () => ({
  connectDB: mockConnectDB
}));

// Mock auth middleware completely
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    const userType = req.headers['x-test-user'] || 'employee';
    if (userType === 'manager') {
      req.user = { id: 'manager-id', role: 'reporting_manager' };
    } else if (userType === 'hr') {
      req.user = { id: 'hr-id', role: 'hr_manager' };
    } else if (userType === 'admin') {
      req.user = { id: 'admin-id', role: 'admin' };
    } else {
      req.user = { id: 'employee-id', role: 'employee' };
    }
    next();
  }
}));

// Create test app
const app = express();
app.use(express.json());

// Add routes
app.use('/leaves', require('../../src/routes/leaves'));
app.use('/approvals', require('../../src/routes/approvals'));
app.use('/admin', require('../../src/routes/admin'));
app.use('/employees', require('../../src/routes/employees'));

describe('Leave Management Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.end.mockResolvedValue();
  });

  describe('Complete Leave Approval Workflow', () => {
    it('should complete full workflow: apply -> manager approve -> hr approve', async () => {
      const leaveId = 'test-leave-id';
      
      // Step 1: Employee applies for leave
      mockPool.query
        .mockResolvedValueOnce([[{ used: 0 }]]) // Balance check
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert leave

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const applyResponse = await request(app)
        .post('/leaves')
        .set('Authorization', 'Bearer token123')
        .send({
          leave_type: 'casual',
          start_date: tomorrow.toISOString().split('T')[0],
          end_date: tomorrow.toISOString().split('T')[0],
          reason: 'Personal work'
        });

      expect(applyResponse.status).toBe(201);

      // Step 2: Manager views pending approvals
      mockPool.query.mockResolvedValueOnce([[{
        id: leaveId,
        employee_name: 'Test Employee',
        status: 'pending_rm'
      }]]);

      const pendingResponse = await request(app)
        .get('/approvals/pending')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'manager');

      expect(pendingResponse.status).toBe(200);
      expect(pendingResponse.body[0]).toHaveProperty('status', 'pending_rm');

      // Step 3: Manager approves leave
      mockPool.query
        .mockResolvedValueOnce([[{
          id: leaveId,
          employee_id: 'employee-id',
          reporting_manager_id: 'manager-id',
          status: 'pending_rm'
        }]]) // Get leave details
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Update status
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert approval

      const managerApproveResponse = await request(app)
        .post(`/leaves/${leaveId}/approve`)
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'manager')
        .send({ comments: 'Approved by manager' });

      expect(managerApproveResponse.status).toBe(200);
      expect(managerApproveResponse.body.message).toContain('pending_hr');

      // Step 4: HR approves leave
      mockPool.query
        .mockResolvedValueOnce([[{
          id: leaveId,
          employee_id: 'employee-id',
          reporting_manager_id: 'manager-id',
          status: 'pending_hr'
        }]]) // Get leave details
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Update status
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert approval

      const hrApproveResponse = await request(app)
        .post(`/leaves/${leaveId}/approve`)
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'hr')
        .send({ comments: 'Final approval by HR' });

      expect(hrApproveResponse.status).toBe(200);
      expect(hrApproveResponse.body.message).toContain('approved');
    });

    it('should handle rejection workflow', async () => {
      const leaveId = 'test-leave-id';

      // Manager rejects leave
      mockPool.query
        .mockResolvedValueOnce([[{
          id: leaveId,
          employee_id: 'employee-id',
          reporting_manager_id: 'manager-id',
          status: 'pending_rm'
        }]]) // Get leave details
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Update status
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert rejection

      const rejectResponse = await request(app)
        .post(`/leaves/${leaveId}/reject`)
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'manager')
        .send({ comments: 'Insufficient staffing' });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.message).toBe('Leave request rejected');
    });
  });

  describe('Admin Dashboard Integration', () => {
    it('should provide complete admin overview', async () => {
      // Test leave summary
      mockPool.query.mockResolvedValueOnce([[
        { department: 'IT', total_requests: 10, approved: 8, rejected: 1, pending: 1 }
      ]]);

      const summaryResponse = await request(app)
        .get('/admin/leave-summary')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(summaryResponse.status).toBe(200);
      expect(summaryResponse.body[0]).toHaveProperty('department', 'IT');

      // Test pending approvals
      mockPool.query.mockResolvedValueOnce([[
        { id: 'leave-1', status: 'pending_rm', employee_name: 'John Doe' }
      ]]);

      const pendingResponse = await request(app)
        .get('/admin/pending-approvals')
        .set('Authorization', 'Bearer token123')
        .set('x-test-user', 'admin');

      expect(pendingResponse.status).toBe(200);
      expect(pendingResponse.body[0]).toHaveProperty('status', 'pending_rm');
    });
  });

  describe('Employee Self-Service Integration', () => {
    it('should provide complete employee experience', async () => {
      // Get profile
      mockPool.query.mockResolvedValueOnce([[{
        id: 'employee-id',
        name: 'Test Employee',
        email: 'employee@test.com'
      }]]);

      const profileResponse = await request(app)
        .get('/employees/me')
        .set('Authorization', 'Bearer token123');

      expect(profileResponse.status).toBe(200);

      // Get leave balance
      mockPool.query.mockResolvedValueOnce([[
        { leave_type: 'casual', used: 5 }
      ]]);

      const balanceResponse = await request(app)
        .get('/employees/me/leave-balance')
        .set('Authorization', 'Bearer token123');

      expect(balanceResponse.status).toBe(200);
      expect(balanceResponse.body.casualLeave.remaining).toBe(7);

      // Get leave history
      mockPool.query.mockResolvedValueOnce([[
        { id: 'leave-1', status: 'approved', leave_type: 'casual' }
      ]]);

      const historyResponse = await request(app)
        .get('/leaves')
        .set('Authorization', 'Bearer token123');

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body[0]).toHaveProperty('status', 'approved');
    });
  });
});