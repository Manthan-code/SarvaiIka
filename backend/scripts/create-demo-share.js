const { Pool } = require('pg');
const crypto = require('crypto');

require('dotenv').config();

async function createDemoShare() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Missing SUPABASE_DB_URL or DATABASE_URL environment variable');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const shareId = 'sc_demo_' + crypto.randomBytes(6).toString('hex');
  const chatId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const title = 'Demo Shared Chat';
  const messages = [
    { id: 'm1', role: 'user', content: 'Hello! Can you summarize this project?', created_at: new Date().toISOString() },
    { id: 'm2', role: 'assistant', content: 'Sure — this app adds chat sharing and a public view.', created_at: new Date().toISOString() }
  ];

  const insertSQL = `
    INSERT INTO shared_chats (share_id, chat_id, owner_id, title, messages, is_public)
    VALUES ($1, $2, $3, $4, $5::jsonb, true)
    RETURNING share_id, title, created_at
  `;

  try {
    const res = await pool.query(insertSQL, [
      shareId,
      chatId,
      ownerId,
      title,
      JSON.stringify(messages)
    ]);

    const row = res.rows[0];
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
    const url = `${base}/share/${row.share_id}`;
    console.log('✅ Demo share created');
    console.log('shareId:', row.share_id);
    console.log('title:', row.title);
    console.log('createdAt:', row.created_at);
    console.log('url:', url);
  } catch (err) {
    console.error('❌ Failed to create demo share:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createDemoShare();