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
    req.user = { id: 'employee-id', role: 'employee' };
    next();
  }
}));

const leavesRoutes = require('../../src/routes/leaves');

const app = express();
app.use(express.json());
app.use('/leaves', leavesRoutes);

describe('Leaves Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /leaves', () => {
    it('should create leave request successfully', async () => {
      mockPool.query
        .mockResolvedValueOnce([[{ used: 0 }]]) // Leave balance check
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert leave

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const response = await request(app)
        .post('/leaves')
        .set('Authorization', 'Bearer token123')
        .send({
          leave_type: 'casual',
          start_date: tomorrow.toISOString().split('T')[0],
          end_date: tomorrow.toISOString().split('T')[0],
          reason: 'Personal work'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Leave request submitted');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should reject past date applications', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .post('/leaves')
        .set('Authorization', 'Bearer token123')
        .send({
          leave_type: 'casual',
          start_date: yesterday.toISOString().split('T')[0],
          end_date: yesterday.toISOString().split('T')[0],
          reason: 'Personal work'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Cannot apply for past dates');
    });

    it('should enforce 1-day notice for casual leave', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/leaves')
        .set('Authorization', 'Bearer token123')
        .send({
          leave_type: 'casual',
          start_date: tomorrow.toISOString().split('T')[0],
          end_date: tomorrow.toISOString().split('T')[0],
          reason: 'Emergency'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Casual leave requires minimum 1 day advance notice');
    });

    it('should check leave balance', async () => {
      mockPool.query.mockResolvedValueOnce([[{ used: 12 }]]); // All casual leave used

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const response = await request(app)
        .post('/leaves')
        .set('Authorization', 'Bearer token123')
        .send({
          leave_type: 'casual',
          start_date: tomorrow.toISOString().split('T')[0],
          end_date: tomorrow.toISOString().split('T')[0],
          reason: 'Personal work'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient leave balance');
    });
  });

  describe('GET /leaves', () => {
    it('should return user leave history', async () => {
      const testLeave = {
        id: 'leave-1',
        employee_id: 'employee-id',
        leave_type: 'casual',
        status: 'pending_rm'
      };
      mockPool.query.mockResolvedValueOnce([[testLeave]]);

      const response = await request(app)
        .get('/leaves')
        .set('Authorization', 'Bearer token123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id', 'leave-1');
    });
  });

  describe('POST /leaves/:id/approve', () => {
    it('should prevent self-approval', async () => {
      mockPool.query.mockResolvedValueOnce([[{
        id: 'leave-1',
        employee_id: 'employee-id',
        reporting_manager_id: 'manager-id'
      }]]);

      const response = await request(app)
        .post('/leaves/leave-1/approve')
        .set('Authorization', 'Bearer token123')
        .send({ comments: 'Self approval attempt' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Cannot approve your own leave request');
    });
  });

  describe('POST /leaves/:id/reject', () => {
    it('should require comments for rejection', async () => {
      const response = await request(app)
        .post('/leaves/leave-1/reject')
        .set('Authorization', 'Bearer token123')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Comments required for rejection');
    });
  });
});