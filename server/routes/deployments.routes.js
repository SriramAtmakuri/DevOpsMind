import express from 'express';
import { authenticate } from '../middleware/auth.js';
import deploymentService from '../services/deployment.service.js';

const router = express.Router();
router.use(authenticate);

// Get deployment history
router.get('/', async (req, res) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId) : null;
    const limit = parseInt(req.query.limit) || 50;

    const deployments = await deploymentService.getHistory(serverId, limit);
    res.json(deployments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployment by ID
router.get('/:id', async (req, res) => {
  try {
    const deployment = await deploymentService.getDeployment(parseInt(req.params.id));

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json(deployment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deploy from Git
router.post('/deploy', async (req, res) => {
  try {
    const {
      repositoryUrl,
      branch,
      serverId,
      environment,
      buildCommand,
      deploymentType,
    } = req.body;

    if (!repositoryUrl || !serverId) {
      return res.status(400).json({ error: 'Repository URL and server ID are required' });
    }

    const result = await deploymentService.deployFromGit({
      repositoryUrl,
      branch,
      serverId: parseInt(serverId),
      environment,
      userId: req.user.id,
      buildCommand,
      deploymentType,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rollback deployment
router.post('/:id/rollback', async (req, res) => {
  try {
    const result = await deploymentService.rollback(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
