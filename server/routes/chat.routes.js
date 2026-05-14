import express from 'express';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth.js';
import aiService from '../services/ai.service.js';

const router = express.Router();
router.use(authenticate);

// Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM chat_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { title = 'New Conversation' } = req.body;

    const result = await query(
      `INSERT INTO chat_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [req.user.id, title]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const ownership = await query(
      'SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await query(
      `SELECT * FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message to AI
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let convId = conversationId;

    // Create conversation if doesn't exist
    if (!convId) {
      const convResult = await query(
        `INSERT INTO chat_conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING id`,
        [req.user.id, message.substring(0, 50)]
      );
      convId = convResult.rows[0].id;
    }

    // Save user message
    await query(
      `INSERT INTO chat_messages (conversation_id, user_id, role, content)
       VALUES ($1, $2, 'user', $3)`,
      [convId, req.user.id, message]
    );

    // Get conversation history
    const historyResult = await query(
      `SELECT role, content FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [convId]
    );

    const messages = historyResult.rows.map(row => ({
      role: row.role,
      content: row.content,
    }));

    // Get AI response
    const aiResponse = await aiService.chat(messages, convId, req.user.id);

    // Save AI message
    await query(
      `INSERT INTO chat_messages (conversation_id, user_id, role, content, metadata)
       VALUES ($1, $2, 'assistant', $3, $4)`,
      [
        convId,
        req.user.id,
        aiResponse.message,
        JSON.stringify({
          toolsUsed: aiResponse.toolsUsed,
          toolResults: aiResponse.toolResults,
        }),
      ]
    );

    // Update conversation timestamp
    await query(
      'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [convId]
    );

    res.json({
      conversationId: convId,
      message: aiResponse.message,
      toolsUsed: aiResponse.toolsUsed,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    await query('DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
