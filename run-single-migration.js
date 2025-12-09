// Script to run a single migration file
const fs = require('fs');
const path = require('path');
const { query } = require('./config/database');

async function runMigration(migrationFile) {
  try {
    console.log(`\n🔄 Running migration: ${migrationFile}\n`);

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL by semicolons (but not in comments)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement && statement.trim().length > 0) {
        console.log(`📝 Executing: ${statement.substring(0, 100)}...`);
        await query(statement);
        console.log('✅ Success\n');
      }
    }

    console.log(`\n✅ Migration ${migrationFile} completed successfully!\n`);
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error.message);
    console.error(error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('\n❌ Please provide migration file name');
  console.log('\nUsage: node run-single-migration.js <migration-file>');
  console.log('Example: node run-single-migration.js 006_add_draft_status.sql\n');
  process.exit(1);
}

// Run migration
runMigration(migrationFile);
