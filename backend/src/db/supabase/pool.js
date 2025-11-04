const { Pool } = require('pg');
const dotenv = require('dotenv');
const logger = require('../../config/logger.js');

dotenv.config();

// Prefer direct database URL if provided
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  logger.warn('No SUPABASE_DB_URL/DATABASE_URL provided. Direct Postgres pool will not be available.');
}

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  : null;

async function query(text, params) {
  if (!pool) throw new Error('Database pool is not configured');
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

module.exports = { pool, query };


