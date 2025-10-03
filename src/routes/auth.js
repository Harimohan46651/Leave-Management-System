const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// register (admin usage / or seed)
router.post('/register', async (req, res) => {
  try {
    const pool = await connectDB();
    const { name, email, password, employee_code, department, role, reporting_manager_id } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'name, email, password required' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await pool.query(
      'INSERT INTO employees (id, employee_code, name, email, password, department, role, reporting_manager_id, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())',
      [id, employee_code || null, name, email, hash, department || null, role || 'employee', reporting_manager_id || null]
    );
    res.status(201).json({ id, message: 'registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// login
router.post('/login', async (req, res) => {
  try {
    const pool = await connectDB();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const [rows] = await pool.query('SELECT * FROM employees WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    }, JWT_SECRET, { expiresIn: '8h' });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
