// Direct insert Draft status
const { query } = require('./config/database');

async function insertDraftStatus() {
  try {
    console.log('\n=== Inserting Draft Status ===\n');
    
    // Check if exists first
    const check = await query(
      'SELECT * FROM "Status" WHERE "StatusName" = $1',
      ['Nháp']
    );
    
    if (check.rows.length > 0) {
      console.log('✅ Draft status already exists:');
      console.log(check.rows[0]);
      process.exit(0);
      return;
    }
    
    // Insert new status
    const result = await query(
      `INSERT INTO "Status" ("StatusName", "Description", "IsFinal", "CreatedAt")
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      ['Nháp', 'Yêu cầu đang ở dạng nháp, chưa được gửi chính thức', false]
    );
    
    console.log('✅ Draft status created successfully:');
    console.log(result.rows[0]);
    
    console.log('\n=== All Statuses ===\n');
    const allStatuses = await query('SELECT * FROM "Status" ORDER BY "StatusID"');
    console.table(allStatuses.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

insertDraftStatus();
