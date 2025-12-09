// Check draft status in database
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkDrafts() {
  const client = await pool.connect();

  try {
    // 1. Check if Draft status exists
    console.log('\n=== Checking Draft Status ===');
    const statusCheck = await client.query(
      'SELECT * FROM "Status" WHERE "StatusName" = $1',
      ['Nháp']
    );
    console.log('Draft status:', statusCheck.rows);

    // 2. Check requests #152, #153, #154
    console.log('\n=== Checking Requests #152, #153, #154 ===');
    const requestsCheck = await client.query(
      `SELECT r."RequestID", r."Title", r."StatusID", s."StatusName" 
       FROM "Requests" r
       LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
       WHERE r."RequestID" IN (152, 153, 154)
       ORDER BY r."RequestID" DESC`
    );
    console.log('Requests:', requestsCheck.rows);

    // 3. Check all requests with Draft status
    console.log('\n=== All Draft Requests ===');
    const draftsCheck = await client.query(
      `SELECT r."RequestID", r."Title", r."UsersId", s."StatusName"
       FROM "Requests" r
       LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
       WHERE s."StatusName" = 'Nháp'
       ORDER BY r."RequestID" DESC`
    );
    console.log('Draft requests:', draftsCheck.rows);

    // 4. Check user ID for admin
    console.log('\n=== Check Admin User ===');
    const userCheck = await client.query(
      'SELECT "Id", "UserName", "Email" FROM "Users" WHERE "UserName" = $1',
      ['admin']
    );
    console.log('Admin user:', userCheck.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDrafts();
