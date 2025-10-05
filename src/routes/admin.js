const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Department-wise leave statistics
router.get('/leave-summary', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const pool = await connectDB();
    
    const [summary] = await pool.query(`
      SELECT 
        e.department,
        COUNT(lr.id) as total_requests,
        SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN lr.status IN ('pending_rm', 'pending_hr') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days ELSE 0 END) as total_days_approved,
        AVG(CASE WHEN lr.status = 'approved' THEN lr.total_days END) as avg_days_per_request
      FROM employees e
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id
      WHERE e.department IS NOT NULL
      GROUP BY e.department
      ORDER BY total_requests DESC
    `);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All pending approvals across organization
router.get('/pending-approvals', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const pool = await connectDB();
    
    const [pending] = await pool.query(`
      SELECT 
        lr.id,
        lr.leave_type,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status,
        lr.applied_at,
        e.name as employee_name,
        e.employee_code,
        e.department,
        rm.name as reporting_manager_name,
        CASE 
          WHEN lr.status = 'pending_rm' THEN rm.name
          WHEN lr.status = 'pending_hr' THEN 'HR Team'
          ELSE NULL
        END as pending_with
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees rm ON e.reporting_manager_id = rm.id
      WHERE lr.status IN ('pending_rm', 'pending_hr')
      ORDER BY lr.applied_at ASC
    `);

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;