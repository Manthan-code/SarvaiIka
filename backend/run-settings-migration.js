const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function runSettingsMigration() {
  let client;
  try {
    console.log('Running settings table migration...');
    
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    client = await pool.connect();
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./src/db/supabase/migrations/add_background_image_id_to_settings.sql', 'utf8');
    
    console.log('Executing migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('Migration completed successfully!');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'settings' 
      AND column_name = 'background_image_id'
      AND table_schema = 'public'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ background_image_id column added successfully');
      console.log(`📊 Column details:`, result.rows[0]);
    } else {
      console.log('❌ Column addition verification failed');
    }
    
    // Check if the index was created
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'settings' 
      AND indexname = 'idx_settings_background_image_id'
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('✅ Index idx_settings_background_image_id created successfully');
    } else {
      console.log('❌ Index creation verification failed');
    }
    
  } catch (error) {
    console.error('Migration script failed:', error);
    console.error('Error details:', error.message);
    if (error.detail) {
      console.error('Error detail:', error.detail);
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}

runSettingsMigration();