import { pool } from './src/db/supabase/pool.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  try {
    console.log('Running subscription migration...');
    
    if (!pool) {
      console.error('Database pool not available');
      return;
    }
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./src/db/supabase/migrations/2025_add_subscription_to_profiles.sql', 'utf8');
    
    console.log('Migration SQL:', migrationSQL);
    
    // Execute the migration using direct database connection
    const result = await pool.query(migrationSQL);
    
    console.log('Migration completed successfully:', result);
    
    // Verify the columns were added
    const checkResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      AND column_name IN ('subscription_plan', 'subscription_status', 'subscription_ends_at')
    `);
    
    console.log('Added columns:', checkResult.rows);
    
  } catch (error) {
    console.error('Migration script failed:', error);
  }
}

runMigration();