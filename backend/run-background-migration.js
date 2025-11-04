const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function runBackgroundImagesMigration() {
  try {
    console.log('Running background images migration...');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./src/db/supabase/migrations/create_background_images_table.sql', 'utf8');
    
    console.log('Migration SQL loaded, executing...');
    
    // Execute the migration using direct database connection
    const result = await pool.query(migrationSQL);
    
    console.log('Background images migration completed successfully!');
    console.log('Tables and data created:');
    console.log('- background_images table');
    console.log('- Default background images inserted');
    console.log('- Settings table updated with background_image_id column');
    
  } catch (error) {
    console.error('Background images migration failed:', error);
    console.error('Error details:', error.message);
    if (error.detail) {
      console.error('Error detail:', error.detail);
    }
  } finally {
    await pool.end();
  }
}

runBackgroundImagesMigration();