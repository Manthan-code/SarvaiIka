const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function runSharedChatsMigration() {
  let client;
  try {
    console.log('🔧 Running SQL migration for shared_chats...');

    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ Missing SUPABASE_DB_URL or DATABASE_URL environment variable');
      process.exit(1);
    }

    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    client = await pool.connect();

    // Read the migration file (relative to backend directory)
    const migrationSQL = fs.readFileSync('./migrations/create_shared_chats_table.sql', 'utf8');

    console.log('📄 Executing shared_chats migration SQL...');

    // Execute the migration in a transaction
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ shared_chats migration completed successfully!');

    // Verify table existence and policies
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'shared_chats'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Table "shared_chats" exists.');
    } else {
      console.error('❌ Table "shared_chats" not found after migration.');
    }

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

runSharedChatsMigration();