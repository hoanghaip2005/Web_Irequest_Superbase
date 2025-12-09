// Fix existing draft requests - update their status to "Nháp"
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function fixDrafts() {
  const client = await pool.connect();

  try {
    // 1. Get Draft status ID
    console.log('\n=== Getting Draft Status ID ===');
    const statusResult = await client.query(
      'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1',
      ['Nháp']
    );
    
    if (!statusResult.rows[0]) {
      console.error('❌ Draft status "Nháp" not found! Please run migration 006 first.');
      return;
    }
    
    const draftStatusId = statusResult.rows[0].StatusID;
    console.log('Draft StatusID:', draftStatusId);

    // 2. Find requests with title "Bản nháp chưa có tiêu đề"
    console.log('\n=== Finding Draft Requests ===');
    const draftsToFix = await client.query(
      `SELECT r."RequestID", r."Title", s."StatusName" 
       FROM "Requests" r
       LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
       WHERE r."Title" LIKE '%Bản nháp%' OR r."Title" LIKE '%nháp%'
       ORDER BY r."RequestID" DESC`
    );
    console.log('Found requests to fix:', draftsToFix.rows);

    if (draftsToFix.rows.length === 0) {
      console.log('No draft requests to fix.');
      return;
    }

    // 3. Update their status to "Nháp"
    console.log('\n=== Updating Status to Draft ===');
    for (const draft of draftsToFix.rows) {
      const result = await client.query(
        `UPDATE "Requests" 
         SET "StatusID" = $1, "UpdatedAt" = NOW()
         WHERE "RequestID" = $2
         RETURNING "RequestID", "Title"`,
        [draftStatusId, draft.RequestID]
      );
      console.log(`✅ Updated Request #${result.rows[0].RequestID}: ${result.rows[0].Title}`);
    }

    console.log('\n✅ All draft requests have been fixed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixDrafts();
