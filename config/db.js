require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vrent_final-database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,       
  decimalNumbers: true     
});

async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    const [[row]] = await conn.query('SELECT DATABASE() AS db');
    console.log(`MySQL connected -> database "${row.db}"`);
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection };
