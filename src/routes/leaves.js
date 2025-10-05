const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Apply for new leave
router.post('/', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const { leave_type, start_date, end_date, reason } = req.body;
    
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'leave_type, start_date, end_date required' });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const total_days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const id = uuidv4();
    await pool.query(
      'INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, leave_type, start_date, end_date, total_days, reason || null, 'pending_rm']
    );

    res.status(201).json({ id, message: 'Leave request submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my leave history
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const [rows] = await pool.query(
      'SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY applied_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific leave details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const [rows] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ? AND employee_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update leave (draft status only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const { leave_type, start_date, end_date, reason } = req.body;
    
    // Check if leave exists and is in draft status
    const [existing] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ? AND employee_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    if (existing[0].status !== 'draft') {
      return res.status(400).json({ error: 'Can only update draft leave requests' });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const total_days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    await pool.query(
      'UPDATE leave_requests SET leave_type = ?, start_date = ?, end_date = ?, total_days = ?, reason = ? WHERE id = ?',
      [leave_type, start_date, end_date, total_days, reason || null, req.params.id]
    );

    res.json({ message: 'Leave request updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel leave request
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Check if leave exists
    const [existing] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ? AND employee_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!existing.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    if (existing[0].status === 'approved') {
      return res.status(400).json({ error: 'Cannot cancel approved leave' });
    }

    await pool.query(
      'UPDATE leave_requests SET status = ? WHERE id = ?',
      ['cancelled', req.params.id]
    );

    res.json({ message: 'Leave request cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve leave request
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const { comments } = req.body;
    const leaveId = req.params.id;

    // Get leave request details
    const [leaveRows] = await pool.query(
      'SELECT lr.*, e.reporting_manager_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?',
      [leaveId]
    );

    if (!leaveRows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveRows[0];
    let newStatus = '';
    let approverType = '';

    // Check authorization and determine next status
    if (req.user.role === 'reporting_manager' && leave.reporting_manager_id === req.user.id && leave.status === 'pending_rm') {
      newStatus = 'pending_hr';
      approverType = 'reporting_manager';
    } else if (req.user.role === 'hr_manager' && leave.status === 'pending_hr') {
      newStatus = 'approved';
      approverType = 'hr_manager';
    } else {
      return res.status(403).json({ error: 'Not authorized to approve this leave request' });
    }

    // Update leave status
    await pool.query('UPDATE leave_requests SET status = ? WHERE id = ?', [newStatus, leaveId]);

    // Record approval
    const approvalId = uuidv4();
    await pool.query(
      'INSERT INTO leave_approvals (id, leave_request_id, approver_id, approver_type, action, comments) VALUES (?, ?, ?, ?, ?, ?)',
      [approvalId, leaveId, req.user.id, approverType, 'approve', comments || null]
    );

    res.json({ message: `Leave request approved. Status: ${newStatus}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject leave request
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const { comments } = req.body;
    const leaveId = req.params.id;

    if (!comments) {
      return res.status(400).json({ error: 'Comments required for rejection' });
    }

    // Get leave request details
    const [leaveRows] = await pool.query(
      'SELECT lr.*, e.reporting_manager_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?',
      [leaveId]
    );

    if (!leaveRows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveRows[0];
    let approverType = '';

    // Check authorization
    if (req.user.role === 'reporting_manager' && leave.reporting_manager_id === req.user.id && leave.status === 'pending_rm') {
      approverType = 'reporting_manager';
    } else if (req.user.role === 'hr_manager' && leave.status === 'pending_hr') {
      approverType = 'hr_manager';
    } else {
      return res.status(403).json({ error: 'Not authorized to reject this leave request' });
    }

    // Update leave status to rejected
    await pool.query('UPDATE leave_requests SET status = ? WHERE id = ?', ['rejected', leaveId]);

    // Record rejection
    const approvalId = uuidv4();
    await pool.query(
      'INSERT INTO leave_approvals (id, leave_request_id, approver_id, approver_type, action, comments) VALUES (?, ?, ?, ?, ?, ?)',
      [approvalId, leaveId, req.user.id, approverType, 'reject', comments]
    );

    res.json({ message: 'Leave request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View complete approval trail
router.get('/:id/approval-history', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    const leaveId = req.params.id;

    // Get leave request with employee details
    const [leaveRows] = await pool.query(
      `SELECT lr.*, e.name as employee_name, e.employee_code, e.reporting_manager_id 
       FROM leave_requests lr 
       JOIN employees e ON lr.employee_id = e.id 
       WHERE lr.id = ?`,
      [leaveId]
    );

    if (!leaveRows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveRows[0];

    // Check if user has access to view this leave
    const hasAccess = leave.employee_id === req.user.id || 
                     leave.reporting_manager_id === req.user.id || 
                     req.user.role === 'hr_manager';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get approval history
    const [approvals] = await pool.query(
      `SELECT la.*, e.name as approver_name, e.role as approver_role 
       FROM leave_approvals la 
       JOIN employees e ON la.approver_id = e.id 
       WHERE la.leave_request_id = ? 
       ORDER BY la.timestamp ASC`,
      [leaveId]
    );

    res.json({
      leave_request: leave,
      approval_history: approvals
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;