const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const QUOTAS = { casual: 12, sick: 10, vacation: 18 };

router.get('/me', authMiddleware, async (req, res) => {
  const conn = await connectDB();
  try {
    const [rows] = await conn.query(
      'SELECT id, employee_code, name, email, department, role FROM employees WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await conn.end();
  }
});

router.get('/me/leave-balance', authMiddleware, async (req, res) => {
  const conn = await connectDB();
  try {
    const [rows] = await conn.query(
      `SELECT leave_type, SUM(total_days) AS used
       FROM leave_requests
       WHERE employee_id = ? AND status = 'approved' AND YEAR(start_date) = YEAR(CURDATE())
       GROUP BY leave_type`,
      [req.user.id]
    );
    const used = { casual: 0, sick: 0, vacation: 0 };
    rows.forEach(r => { used[r.leave_type] = Number(r.used || 0); });
    res.json({
      casualLeave: { total: QUOTAS.casual, used: used.casual, remaining: QUOTAS.casual - used.casual },
      sickLeave: { total: QUOTAS.sick, used: used.sick, remaining: QUOTAS.sick - used.sick },
      vacationLeave: { total: QUOTAS.vacation, used: used.vacation, remaining: QUOTAS.vacation - used.vacation }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await conn.end();
  }
});

module.exports = router;
