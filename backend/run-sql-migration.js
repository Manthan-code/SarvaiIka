const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function runSQLMigration() {
  let client;
  try {
    console.log('🔧 Running SQL migration to fix background images constraint...');
    
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    client = await pool.connect();
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./src/db/supabase/migrations/fix_background_images_tiers.sql', 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the constraint was updated
    const constraintResult = await client.query(`
      SELECT conname, consrc 
      FROM pg_constraint 
      WHERE conname = 'background_images_tier_required_check'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✅ Constraint updated successfully:');
      console.log('Constraint name:', constraintResult.rows[0].conname);
      console.log('Constraint definition:', constraintResult.rows[0].consrc);
    }
    
    // Check current tier distribution
    const tierResult = await client.query(`
      SELECT tier_required, COUNT(*) as count 
      FROM background_images 
      GROUP BY tier_required 
      ORDER BY tier_required
    `);
    
    console.log('📊 Current tier distribution:');
    tierResult.rows.forEach(row => {
      console.log(`  ${row.tier_required}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

runSQLMigration();