const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "viz_uploads",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDB(retries = 10) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255),
        status ENUM('UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED'),
        final_hash VARCHAR(64)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        upload_id VARCHAR(255),
        chunk_index INT,
        status VARCHAR(20),
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (upload_id, chunk_index)
      )
    `);
    console.log(" Database tables initialized");
  } catch (err) {
    if (retries > 0) {
      console.error(` DB Connection failed. Retrying in 3s... (${retries} left)`);
      await new Promise(res => setTimeout(res, 3000));
      return initDB(retries - 1);
    }
    throw err;
  }
}

module.exports = { pool, initDB };