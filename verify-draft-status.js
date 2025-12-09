// Verify Draft status exists in database
const { query } = require('./config/database');

async function verifyDraftStatus() {
  try {
    console.log('\n=== Checking Draft Status ===\n');
    
    const result = await query(
      'SELECT * FROM "Status" WHERE "StatusName" = $1',
      ['Nháp']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Draft status found:');
      console.log(result.rows[0]);
      console.log('\n✅ Draft functionality should work now!');
    } else {
      console.log('❌ Draft status NOT found in database');
      console.log('Please run: node run-single-migration.js 006_add_draft_status.sql');
    }
    
    console.log('\n=== All Statuses ===\n');
    const allStatuses = await query('SELECT "StatusID", "StatusName", "Description", "IsFinal" FROM "Status" ORDER BY "StatusID"');
    console.table(allStatuses.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyDraftStatus();
