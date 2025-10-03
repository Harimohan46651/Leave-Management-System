const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',   // use host instead of server
  user: process.env.DB_USER || 'hari',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  database: process.env.DB_NAME || 'leave_management',
  // mysql2 createPool handles concurrency; no SQL Server options required
};

let pool = null;

async function connectDB() {
  if (pool) return pool;
  try {
    pool = mysql.createPool({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    // quick ping to check
    await pool.query('SELECT 1');
    console.log('Connected to MySQL database');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDB };
