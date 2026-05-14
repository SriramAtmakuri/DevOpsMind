import express from 'express';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Get all alerts
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const result = await query(
      `SELECT a.*, s.name as server_name
       FROM alerts a
       LEFT JOIN servers s ON a.server_id = s.id
       WHERE a.status = $1
       ORDER BY a.triggered_at DESC`,
      [status]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert
router.post('/:id/acknowledge', async (req, res) => {
  try {
    await query(
      `UPDATE alerts
       SET status = 'acknowledged',
           acknowledged_at = CURRENT_TIMESTAMP,
           acknowledged_by = $1
       WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Alert acknowledged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve alert
router.post('/:id/resolve', async (req, res) => {
  try {
    await query(
      `UPDATE alerts
       SET status = 'resolved',
           resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Alert resolved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alert rules
router.get('/rules', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;

    let sql = 'SELECT * FROM alert_rules';
    const params = [];

    if (serverId) {
      sql += ' WHERE server_id = $1';
      params.push(serverId);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create alert rule
router.post('/rules', async (req, res) => {
  try {
    const {
      serverId,
      ruleName,
      metricType,
      condition,
      threshold,
      duration = 300,
      severity = 'warning',
      notificationChannels = [],
    } = req.body;

    const result = await query(
      `INSERT INTO alert_rules (
        server_id, rule_name, metric_type, condition,
        threshold, duration, severity, notification_channels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        serverId,
        ruleName,
        metricType,
        condition,
        threshold,
        duration,
        severity,
        notificationChannels,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alert rule
router.put('/rules/:id', async (req, res) => {
  try {
    const { threshold, enabled, notificationChannels } = req.body;

    const result = await query(
      `UPDATE alert_rules
       SET threshold = COALESCE($1, threshold),
           enabled = COALESCE($2, enabled),
           notification_channels = COALESCE($3, notification_channels)
       WHERE id = $4
       RETURNING *`,
      [threshold, enabled, notificationChannels, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete alert rule
router.delete('/rules/:id', async (req, res) => {
  try {
    await query('DELETE FROM alert_rules WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert rule deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
