import express from 'express';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth.js';
import sshService from '../services/ssh.service.js';
import metricsService from '../services/metrics.service.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all servers
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM servers ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get server by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM servers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new server
router.post('/', async (req, res) => {
  try {
    const {
      name,
      hostname,
      ip_address,
      port = 22,
      username,
      auth_type = 'password',
      password,
      private_key,
      environment,
      tags = [],
    } = req.body;

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'Server name is required' });
    }
    if (!ip_address || String(ip_address).trim().length === 0) {
      return res.status(400).json({ error: 'Hostname/IP address is required' });
    }
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ error: 'Port must be between 1 and 65535' });
    }
    if (!username || String(username).trim().length === 0) {
      return res.status(400).json({ error: 'SSH username is required' });
    }
    if (auth_type === 'password' && !password) {
      return res.status(400).json({ error: 'Password is required for password authentication' });
    }
    if (auth_type === 'key' && !private_key) {
      return res.status(400).json({ error: 'Private key is required for key authentication' });
    }

    // Encrypt sensitive data
    const encryptedPassword = password ? sshService.encrypt(password) : null;
    const encryptedKey = private_key ? sshService.encrypt(private_key) : null;

    const result = await query(
      `INSERT INTO servers (
        name, hostname, ip_address, port, username, auth_type,
        password, private_key, environment, tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        name,
        hostname,
        ip_address,
        port,
        username,
        auth_type,
        encryptedPassword,
        encryptedKey,
        environment,
        tags,
        req.user.id,
      ]
    );

    // Test connection
    const connected = await sshService.checkConnection(result.rows[0].id);
    await query(
      "UPDATE servers SET status = $1 WHERE id = $2",
      [connected ? 'online' : 'offline', result.rows[0].id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update server
router.put('/:id', async (req, res) => {
  try {
    const { name, hostname, ip_address, port, environment, tags } = req.body;

    const result = await query(
      `UPDATE servers
       SET name = COALESCE($1, name),
           hostname = COALESCE($2, hostname),
           ip_address = COALESCE($3, ip_address),
           port = COALESCE($4, port),
           environment = COALESCE($5, environment),
           tags = COALESCE($6, tags)
       WHERE id = $7
       RETURNING *`,
      [name, hostname, ip_address, port, environment, tags, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete server
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM servers WHERE id = $1', [req.params.id]);
    sshService.closeConnection(parseInt(req.params.id));
    res.json({ message: 'Server deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get server metrics
router.get('/:id/metrics', async (req, res) => {
  try {
    const metrics = await metricsService.getCurrentMetrics(parseInt(req.params.id));
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get server metrics history
router.get('/:id/metrics/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const metrics = await metricsService.getMetricsHistory(
      parseInt(req.params.id),
      hours
    );
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command on server
router.post('/:id/execute', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const result = await sshService.executeCommand(parseInt(req.params.id), command);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get server processes
router.get('/:id/processes', async (req, res) => {
  try {
    const processes = await sshService.getProcesses(parseInt(req.params.id));
    res.json(processes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check server connection
router.post('/:id/check', async (req, res) => {
  try {
    const connected = await sshService.checkConnection(parseInt(req.params.id));
    await query(
      "UPDATE servers SET status = $1, last_check = CURRENT_TIMESTAMP WHERE id = $2",
      [connected ? 'online' : 'offline', req.params.id]
    );
    res.json({ connected, status: connected ? 'online' : 'offline' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
