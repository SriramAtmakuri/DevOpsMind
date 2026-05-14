import express from 'express';
import { authenticate } from '../middleware/auth.js';
import dockerService from '../services/docker.service.js';

const router = express.Router();
router.use(authenticate);

// List containers
router.get('/', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const all = req.query.all !== 'false';

    const containers = await dockerService.listContainers(serverId, all);
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container stats
router.get('/:id/stats', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const stats = await dockerService.getContainerStats(req.params.id, serverId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container logs
router.get('/:id/logs', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const tail = parseInt(req.query.tail) || 100;

    const logs = await dockerService.getContainerLogs(req.params.id, tail, serverId);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start container
router.post('/:id/start', async (req, res) => {
  try {
    const serverId = req.body.serverId || null;
    await dockerService.startContainer(req.params.id, serverId);
    res.json({ message: 'Container started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop container
router.post('/:id/stop', async (req, res) => {
  try {
    const serverId = req.body.serverId || null;
    await dockerService.stopContainer(req.params.id, serverId);
    res.json({ message: 'Container stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart container
router.post('/:id/restart', async (req, res) => {
  try {
    const serverId = req.body.serverId || null;
    await dockerService.restartContainer(req.params.id, serverId);
    res.json({ message: 'Container restarted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove container
router.delete('/:id', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const force = req.query.force === 'true';

    await dockerService.removeContainer(req.params.id, force, serverId);
    res.json({ message: 'Container removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command in container
router.post('/:id/exec', async (req, res) => {
  try {
    const { command, serverId = null } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const result = await dockerService.execInContainer(req.params.id, command, serverId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List images
router.get('/images', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const images = await dockerService.listImages(serverId);
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
