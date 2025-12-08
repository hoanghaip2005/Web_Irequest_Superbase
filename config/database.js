const { Pool } = require('pg');
require('dotenv').config();

// Cấu hình connection pool cho Supabase PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // Cần thiết cho Supabase
  },
  // Cấu hình connection pool tối ưu cho Supabase
  max: 10, // Giảm số connection tối đa
  min: 2, // Số connection tối thiểu
  idleTimeoutMillis: 60000, // 60 giây timeout cho idle connections
  connectionTimeoutMillis: 10000, // 10 giây timeout khi tạo connection mới
  acquireTimeoutMillis: 10000, // 10 giây timeout khi acquire connection từ pool
  statement_timeout: 30000, // 30 giây timeout cho câu query
  query_timeout: 30000, // 30 giây timeout cho query
  keepAlive: true, // Giữ connection alive
  keepAliveInitialDelayMillis: 0,
});

// Event handlers cho pool
pool.on('connect', () => {
  console.log('Connected to Supabase PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Hàm helper để thực hiện query với retry logic
const query = async (text, params, retries = 3) => {
  let lastError;

  for (let i = 0; i < retries; i++) {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      lastError = error;
      console.error(
        `Database query error (attempt ${i + 1}/${retries}):`,
        error.message
      );

      // Nếu là lỗi connection, chờ một chút rồi thử lại
      if (
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.message.includes('timeout')
      ) {
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          continue;
        }
      }

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  throw lastError;
};

// Hàm helper để thực hiện transaction
const transaction = async (queries) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];

    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Test connection với thông tin chi tiết
const testConnection = async () => {
  try {
    console.log('🔗 Testing database connection...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);

    const result = await query(
      'SELECT NOW() as current_time, version() as version'
    );
    console.log('✅ Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    console.log('🔄 Closing database pool...');
    await pool.end();
    console.log('✅ Database pool closed successfully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  gracefulShutdown,
};
