const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function runBackgroundImagesMigration() {
  let client;
  try {
    console.log('Running background images migration...');
    
    // Create PostgreSQL connection
    const pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    client = await pool.connect();
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./migrations/create_background_images_table.sql', 'utf8');
    
    console.log('Executing migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('Migration completed successfully!');
    
    // Verify the table was created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'background_images' 
      AND table_schema = 'public'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ background_images table created successfully');
      
      // Check if default data was inserted
      const countResult = await client.query('SELECT COUNT(*) FROM background_images');
      console.log(`📊 Default records inserted: ${countResult.rows[0].count}`);
    } else {
      console.log('❌ Table creation verification failed');
    }
    
  } catch (error) {
    console.error('Migration script failed:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

runBackgroundImagesMigration();