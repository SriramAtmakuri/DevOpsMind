import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../database/sqlite-init.js';

const router = express.Router();
router.use(authenticate);

// List logs
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const level = req.query.level;

    let query = 'SELECT * FROM logs';
    let params = [];
    const conditions = [];

    if (serverId) {
      conditions.push('server_id = ?');
      params.push(serverId);
    }

    if (level) {
      conditions.push('log_level = ?');
      params.push(level);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get log by ID
router.get('/:id', async (req, res) => {
  try {
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id);

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
