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

module.exports = router;