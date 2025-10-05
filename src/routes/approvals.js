const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get leaves pending my approval
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    let query = '';
    
    if (req.user.role === 'reporting_manager') {
      query = `
        SELECT lr.*, e.name as employee_name, e.employee_code 
        FROM leave_requests lr 
        JOIN employees e ON lr.employee_id = e.id 
        WHERE e.reporting_manager_id = ? AND lr.status = 'pending_rm'
        ORDER BY lr.applied_at ASC
      `;
    } else if (req.user.role === 'hr_manager') {
      query = `
        SELECT lr.*, e.name as employee_name, e.employee_code 
        FROM leave_requests lr 
        JOIN employees e ON lr.employee_id = e.id 
        WHERE lr.status = 'pending_hr'
        ORDER BY lr.applied_at ASC
      `;
    } else {
      return res.status(403).json({ error: 'Access denied. Manager role required.' });
    }

    const [rows] = await pool.query(query, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;