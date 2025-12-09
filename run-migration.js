// Run migration to add IsActive column to Requests table
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration() {
  const client = await pool.connect();

  try {
    const migrationPath = path.join(
      __dirname,
      'migrations',
      '004_add_requests_isactive.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 004_add_requests_isactive.sql');
    console.log('SQL:', sql);
    console.log('\n---\n');

    await client.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('Column "IsActive" has been added to "Requests" table');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
