const express = require('express');
const { requireAuth, optionalAuth } = require('../middlewares/authMiddleware.js');
const supabaseAdmin = require('../db/supabase/admin.js');
const logger = require('../config/logger');
const { pool } = require('../db/supabase/pool.js');
const crypto = require('crypto');

const router = express.Router();

function generateShareUrl(shareId) {
  return `http://localhost:8080/share/${shareId}`;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  // Keep only stable fields and sort chronologically for canonical comparison
  return messages
    .map(m => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function messagesEqual(a, b) {
  const na = normalizeMessages(a);
  const nb = normalizeMessages(b);
  return JSON.stringify(na) === JSON.stringify(nb);
}

async function upsertSharedChat({ chatId, userId, title, messages }) {
  const normalized = normalizeMessages(messages);
  if (!pool) {
    // Fallback to Supabase upsert when pool is not available
    const shareId = 'sc_' + crypto.randomBytes(8).toString('hex');
    const { data: existing, error: findErr } = await supabaseAdmin
      .from('shared_chats')
      .select('id, share_id, messages')
      .eq('chat_id', chatId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (findErr) throw findErr;

    if (existing) {
      if (messagesEqual(existing.messages, normalized)) {
        return { statusCode: 200, shareId: existing.share_id, unchanged: true };
      }
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('shared_chats')
        .update({ messages: normalized, updated_at: new Date().toISOString(), title })
        .eq('id', existing.id)
        .select('share_id')
        .single();
      if (updErr) throw updErr;
      return { statusCode: 200, shareId: updated.share_id, unchanged: false };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('shared_chats')
      .insert({
        share_id: shareId,
        chat_id: chatId,
        owner_id: userId,
        title: title || 'Shared Chat',
        messages: normalized,
        is_public: true
      })
      .select('share_id')
      .single();
    if (insErr) throw insErr;
    return { statusCode: 201, shareId: inserted.share_id, unchanged: false };
  }

  // Use transaction for concurrency safety with graceful fallback
  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    // Fallback to Supabase when direct PG connection fails
    logger.warn('pg pool.connect failed, falling back to Supabase upsert', { error: connErr.message });

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('shared_chats')
      .select('id, share_id, messages')
      .eq('chat_id', chatId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (findErr) throw findErr;

    if (existing) {
      if (messagesEqual(existing.messages, normalized)) {
        return { statusCode: 200, shareId: existing.share_id, unchanged: true };
      }
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('shared_chats')
        .update({ messages: normalized, updated_at: new Date().toISOString(), title })
        .eq('id', existing.id)
        .select('share_id')
        .single();
      if (updErr) throw updErr;
      return { statusCode: 200, shareId: updated.share_id, unchanged: false };
    }

    const shareId = 'sc_' + crypto.randomBytes(8).toString('hex');
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('shared_chats')
      .insert({
        share_id: shareId,
        chat_id: chatId,
        owner_id: userId,
        title: title || 'Shared Chat',
        messages: normalized,
        is_public: true
      })
      .select('share_id')
      .single();
    if (insErr) throw insErr;
    return { statusCode: 201, shareId: inserted.share_id, unchanged: false };
  }

  try {
    await client.query('BEGIN');
    const existingRes = await client.query(
      `SELECT id, share_id, messages FROM public.shared_chats WHERE chat_id = $1 AND owner_id = $2 FOR UPDATE`,
      [chatId, userId]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (messagesEqual(existing.messages, normalized)) {
        await client.query('COMMIT');
        return { statusCode: 200, shareId: existing.share_id, unchanged: true };
      }
      const updateRes = await client.query(
        `UPDATE public.shared_chats SET messages = $1::jsonb, updated_at = NOW(), title = $2 WHERE id = $3 RETURNING share_id`,
        [JSON.stringify(normalized), title || 'Shared Chat', existing.id]
      );
      await client.query('COMMIT');
      return { statusCode: 200, shareId: updateRes.rows[0].share_id, unchanged: false };
    } else {
      const shareId = 'sc_' + crypto.randomBytes(8).toString('hex');
      const insertRes = await client.query(
        `INSERT INTO public.shared_chats (share_id, chat_id, owner_id, title, messages, is_public) VALUES ($1, $2, $3, $4, $5::jsonb, true) RETURNING share_id`,
        [shareId, chatId, userId, title || 'Shared Chat', JSON.stringify(normalized)]
      );
      await client.query('COMMIT');
      return { statusCode: 201, shareId: insertRes.rows[0].share_id, unchanged: false };
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}


// POST /api/share - Conditional share (upsert) accepting chat_id and messages
router.post('/', requireAuth, async (req, res) => {
  try {
    const { chat_id: chatId, messages } = req.body;
    const userId = req.user.id;

    if (!chatId) {
      return res.status(400).json({ error: 'chat_id is required' });
    }
    if (!Array.isArray(messages)) {
      // Fetch messages if not provided
      const { data: fetchedMessages, error: fetchErr } = await supabaseAdmin
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (fetchErr) {
        logger.error('Error fetching chat messages:', fetchErr);
        return res.status(500).json({ error: 'Failed to fetch chat messages' });
      }
      req.body.messages = fetchedMessages || [];
    }

    // Verify chat ownership and get title
    const { data: chat, error: chatErr } = await supabaseAdmin
      .from('chats')
      .select('id, user_id, title')
      .eq('id', chatId)
      .single();

    if (chatErr || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: not your chat' });
    }

    const result = await upsertSharedChat({ chatId, userId, title: chat.title, messages: req.body.messages });

    const url = generateShareUrl(result.shareId);
    // Always return 200 for unchanged cases with payload
    return res.status(result.statusCode).json({ shareId: result.shareId, url, unchanged: !!result.unchanged });
  } catch (error) {
    logger.error('POST /api/share error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/share/chat/:id - Create or update shared snapshot for a chat (conditional)
router.post('/chat/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify chat ownership and get title
    const { data: chat, error: chatError } = await supabaseAdmin
      .from('chats')
      .select('id, user_id, title')
      .eq('id', id)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: not your chat' });
    }

    // Fetch messages for the chat (chronological order)
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      logger.error('Error fetching chat messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch chat messages' });
    }

    const result = await upsertSharedChat({ chatId: id, userId, title: chat.title, messages });

    const url = generateShareUrl(result.shareId);
    // Always return 200 for unchanged cases with payload
    return res.status(result.statusCode).json({ shareId: result.shareId, url, title: chat.title, unchanged: !!result.unchanged });
  } catch (error) {
    logger.error('POST /api/share/chat/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/share/fork/:shareId - Fork a shared chat into a new personal chat
router.post('/fork/:shareId', requireAuth, async (req, res) => {
  try {
    const { shareId } = req.params;
    const userId = req.user.id;

    // Fetch the shared chat snapshot
    const { data: shared, error: sharedError } = await supabaseAdmin
      .from('shared_chats')
      .select('share_id, title, messages, created_at, is_public')
      .eq('share_id', shareId)
      .single();

    if (sharedError || !shared) {
      return res.status(404).json({ error: 'Shared chat not found' });
    }

    if (!shared.is_public) {
      return res.status(403).json({ error: 'This shared chat is not public' });
    }

    // Create a new personal chat for the user and copy messages (existing logic)
    const chatId = crypto.randomUUID();
    const { data: newChat, error: chatInsertError } = await supabaseAdmin
      .from('chats')
      .insert({
        id: chatId,
        user_id: userId,
        title: shared.title || 'Forked Chat',
        total_messages: Array.isArray(shared.messages) ? shared.messages.length : 0
      })
      .select('*')
      .single();

    if (chatInsertError) {
      logger.error('Error creating forked chat:', chatInsertError);
      return res.status(500).json({ error: 'Failed to create forked chat' });
    }

    if (Array.isArray(shared.messages) && shared.messages.length > 0) {
      const messageRows = shared.messages.map(m => ({
        chat_id: newChat.id,
        user_id: userId,
        role: m.role,
        content: m.content,
        created_at: m.created_at
      }));

      const { error: insertMessagesError } = await supabaseAdmin
        .from('chat_messages')
        .insert(messageRows);

      if (insertMessagesError) {
        logger.error('Error inserting forked chat messages:', insertMessagesError);
        try { await supabaseAdmin.from('chats').delete().eq('id', newChat.id); } catch (_) {}
        return res.status(500).json({ error: 'Failed to copy chat messages' });
      }
    }

    return res.status(201).json({
      chatId: newChat.id,
      url: `${process.env.PUBLIC_BASE_URL || 'https://localhost:8080'}/chat/${newChat.id}`,
      title: newChat.title,
      totalMessages: newChat.total_messages,
    });
  } catch (error) {
    logger.error('POST /api/share/fork/:shareId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DEV-ONLY: Seed a demo shared chat for previewing UI
if (process.env.NODE_ENV !== 'production') {
  router.post('/demo', async (req, res) => {
    try {
      const shareId = 'sc_demo_' + crypto.randomBytes(6).toString('hex');
      const messages = [
        { id: 'm1', role: 'user', content: 'Hello! Can you summarize this project?', created_at: new Date().toISOString() },
        { id: 'm2', role: 'assistant', content: 'Sure — this app adds chat sharing and a public view.', created_at: new Date().toISOString() }
      ];

      // Ensure we have a demo user in auth.users
      const demoEmail = 'demo-share@test.local';
      const demoPassword = 'demo123456';
      let demoUserId;

      const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true
      });

      if (createUserError) {
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          logger.error('Error listing auth users:', listError);
          return res.status(500).json({ error: 'Failed to ensure demo user' });
        }
        const existing = list.users.find(u => u.email === demoEmail);
        if (!existing) {
          return res.status(500).json({ error: 'Demo user not found or could not be created' });
        }
        demoUserId = existing.id;
      } else {
        demoUserId = created.user.id;
      }

      const chatId = crypto.randomUUID();
      const { data: newChat, error: chatInsertError } = await supabaseAdmin
        .from('chats')
        .insert({
          id: chatId,
          user_id: demoUserId,
          title: 'Demo Shared Chat',
          total_messages: messages.length
        })
        .select('*')
        .single();

      if (chatInsertError) {
        logger.error('Error creating demo chat:', chatInsertError);
        return res.status(500).json({ error: 'Failed to create demo chat' });
      }

      const { error: insertMessagesError } = await supabaseAdmin
        .from('chat_messages')
        .insert(messages.map(m => ({ ...m, chat_id: newChat.id })));

      if (insertMessagesError) {
        logger.error('Error inserting demo chat messages:', insertMessagesError);
        try { await supabaseAdmin.from('chats').delete().eq('id', newChat.id); } catch (_) {}
        return res.status(500).json({ error: 'Failed to seed demo chat messages' });
      }

      const upsertRes = await upsertSharedChat({ chatId: newChat.id, userId: demoUserId, title: newChat.title, messages });
      const url = generateShareUrl(upsertRes.shareId);

      return res.status(201).json({ shareId: upsertRes.shareId, url });
    } catch (error) {
      logger.error('POST /api/share/demo error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// GET /api/share/:shareId - Publicly fetch a shared chat snapshot
router.get('/:shareId', optionalAuth, async (req, res) => {
  try {
    const { shareId } = req.params;

    const { data: shared, error } = await supabaseAdmin
      .from('shared_chats')
      .select('share_id, title, messages, created_at, expires_at, is_public')
      .eq('share_id', shareId)
      .single();

    if (error || !shared) {
      return res.status(404).json({ error: 'Shared chat not found' });
    }

    if (!shared.is_public) {
      return res.status(403).json({ error: 'This shared chat is not public' });
    }

    if (shared.expires_at && new Date(shared.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This shared chat has expired' });
    }

    return res.status(200).json({
      shareId: shared.share_id,
      title: shared.title,
      messages: Array.isArray(shared.messages) ? shared.messages : [],
      createdAt: shared.created_at
    });
  } catch (error) {
    logger.error('GET /api/share/:shareId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;