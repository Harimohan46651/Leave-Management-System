const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'hari',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  database: process.env.DB_NAME || 'db',
};

async function connectDB() {
  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to MySQL database');
    return connection;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDB };
