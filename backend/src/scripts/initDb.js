const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { pool } = require('../db/supabase/pool.js');

dotenv.config();

async function main() {
  try {
    if (!pool) {
      console.error('❌ Missing SUPABASE_DB_URL/DATABASE_URL. Aborting schema init.');
      process.exit(1);
    }

    // __dirname is available in CommonJS
    const schemaPath = path.resolve(__dirname, '../db/supabase/schema/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`Applying schema from: ${schemaPath}`);
    // Ensure required extension exists
    await pool.query('create extension if not exists "uuid-ossp";');
    // Apply full schema
    await pool.query(sql);
    console.log('✅ Schema applied successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to apply schema:', err?.message || err);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();


