const mysql = require('mysql2/promise');

const config = {
  user: "hari",
  password: "root",  
  server: "localhost",              
  port: 3306,
  database: "db",               
  options: {
    encrypt: false,                 
    trustServerCertificate: true,   
  },
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
