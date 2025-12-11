// Fix existing draft requests - update their status to "Nháp"
const { query } = require('./config/database');

async function fixDrafts() {
  try {
    // 1. Get Draft status ID
    console.log('\n=== Getting Draft Status ID ===');
    const statusResult = await query(
      'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1',
      ['Nháp']
    );
    
    if (!statusResult.rows[0]) {
      console.error('❌ Draft status "Nháp" not found! Please run: node insert-draft-status.js');
      process.exit(1);
    }
    
    const draftStatusId = statusResult.rows[0].StatusID;
    console.log('Draft StatusID:', draftStatusId);

    // 2. Find requests with title containing "Bản nháp" or "nháp"
    console.log('\n=== Finding Draft Requests ===');
    const draftsToFix = await query(
      `SELECT r."RequestID", r."Title", s."StatusName", r."UsersId"
       FROM "Requests" r
       LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
       WHERE (r."Title" LIKE '%Bản nháp%' OR r."Title" LIKE '%nháp%' OR r."Title" LIKE '%draft%')
       AND s."StatusName" != 'Nháp'
       ORDER BY r."RequestID" DESC`
    );
    console.log(`Found ${draftsToFix.rows.length} requests to fix:`, draftsToFix.rows);

    if (draftsToFix.rows.length === 0) {
      console.log('No draft requests to fix.');
      process.exit(0);
    }

    // 3. Update their status to "Nháp"
    console.log('\n=== Updating Status to Draft ===');
    for (const draft of draftsToFix.rows) {
      const result = await query(
        `UPDATE "Requests" 
         SET "StatusID" = $1, "UpdatedAt" = NOW()
         WHERE "RequestID" = $2
         RETURNING "RequestID", "Title"`,
        [draftStatusId, draft.RequestID]
      );
      console.log(`✅ Updated Request #${result.rows[0].RequestID}: ${result.rows[0].Title}`);
    }

    console.log('\n✅ All draft requests have been fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixDrafts();
