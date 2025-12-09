// Check Status table structure
const { query } = require('./config/database');

async function checkStatusTable() {
  try {
    console.log('\n=== Status Table Structure ===\n');
    
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Status'
      ORDER BY ordinal_position
    `);
    
    console.table(result.rows);
    
    console.log('\n=== Current Status Records ===\n');
    const statuses = await query('SELECT * FROM "Status" ORDER BY "StatusID"');
    console.table(statuses.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStatusTable();
