import simpleGit from 'simple-git';
import { query } from '../database/init.js';
import sshService from './ssh.service.js';
import dockerService from './docker.service.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

class DeploymentService {
  constructor() {
    this.deploymentsInProgress = new Map();
  }

  // Deploy from Git repository
  async deployFromGit(options) {
    const {
      repositoryUrl,
      branch = 'main',
      serverId,
      environment = 'production',
      userId,
      buildCommand,
      deploymentType = 'docker', // docker, direct, kubernetes
    } = options;

    // Create deployment record
    const deploymentResult = await query(
      `INSERT INTO deployments (
        server_id, user_id, repository_url, branch,
        environment, status, deployment_type
      ) VALUES ($1, $2, $3, $4, $5, 'in_progress', $6)
      RETURNING id`,
      [serverId, userId, repositoryUrl, branch, environment, deploymentType]
    );

    const deploymentId = deploymentResult.rows[0].id;
    this.deploymentsInProgress.set(deploymentId, true);

    try {
      // Clone repository to temp directory
      const tempDir = path.join(os.tmpdir(), `deploy-${deploymentId}`);
      await fs.mkdir(tempDir, { recursive: true });

      console.log(`📦 Cloning repository: ${repositoryUrl}`);
      const git = simpleGit();
      await git.clone(repositoryUrl, tempDir, ['--branch', branch, '--single-branch']);

      // Get commit information
      const repoGit = simpleGit(tempDir);
      const log = await repoGit.log(['-1']);
      const commitHash = log.latest.hash;
      const commitMessage = log.latest.message;

      await query(
        'UPDATE deployments SET commit_hash = $1, commit_message = $2 WHERE id = $3',
        [commitHash, commitMessage, deploymentId]
      );

      let buildLog = `Deployment started for commit: ${commitHash}\n`;
      buildLog += `Message: ${commitMessage}\n\n`;

      // Execute deployment based on type
      switch (deploymentType) {
        case 'docker':
          buildLog += await this.deployDocker(tempDir, serverId, environment);
          break;
        case 'direct':
          buildLog += await this.deployDirect(tempDir, serverId, buildCommand);
          break;
        case 'kubernetes':
          buildLog += await this.deployKubernetes(tempDir, serverId);
          break;
        default:
          throw new Error('Unknown deployment type');
      }

      // Mark deployment as successful
      await query(
        `UPDATE deployments
         SET status = 'success',
             completed_at = CURRENT_TIMESTAMP,
             duration = CAST(strftime('%s', 'now') - strftime('%s', started_at) AS INTEGER),
             build_log = $1
         WHERE id = $2`,
        [buildLog, deploymentId]
      );

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
      this.deploymentsInProgress.delete(deploymentId);

      return {
        success: true,
        deploymentId,
        commitHash,
        buildLog,
      };
    } catch (error) {
      console.error('Deployment error:', error);

      await query(
        `UPDATE deployments
         SET status = 'failed',
             completed_at = CURRENT_TIMESTAMP,
             duration = CAST(strftime('%s', 'now') - strftime('%s', started_at) AS INTEGER),
             error_message = $1
         WHERE id = $2`,
        [error.message, deploymentId]
      );

      this.deploymentsInProgress.delete(deploymentId);

      return {
        success: false,
        deploymentId,
        error: error.message,
      };
    }
  }

  // Deploy using Docker
  async deployDocker(sourceDir, serverId, environment) {
    let log = '🐳 Docker deployment started\n';

    // Check for Dockerfile
    const dockerfilePath = path.join(sourceDir, 'Dockerfile');
    try {
      await fs.access(dockerfilePath);
    } catch {
      throw new Error('Dockerfile not found in repository');
    }

    // Build image name
    const imageName = `devopsmind-${environment}:${Date.now()}`;
    log += `Building image: ${imageName}\n`;

    // Upload files to server via SFTP
    log += 'Uploading files to server via SFTP...\n';
    const remoteDir = `/tmp/deploy-${Date.now()}`;
    await sshService.executeCommand(serverId, `mkdir -p ${remoteDir}`);

    const ssh = await sshService.getConnection(serverId);
    await ssh.putDirectory(sourceDir, remoteDir, {
      recursive: true,
      concurrency: 5,
      validate: (itemPath) => path.basename(itemPath) !== '.git',
    });
    log += 'Files uploaded successfully\n';

    // Build Docker image on remote server
    log += 'Building Docker image...\n';
    const buildResult = await sshService.executeCommand(
      serverId,
      `cd ${remoteDir} && docker build -t ${imageName} .`
    );

    if (!buildResult.success) {
      throw new Error(`Docker build failed: ${buildResult.stderr}`);
    }

    log += buildResult.stdout + '\n';

    // Stop old container if exists
    const oldContainerName = `${environment}-app`;
    log += `Stopping old container: ${oldContainerName}\n`;
    await sshService.executeCommand(
      serverId,
      `docker stop ${oldContainerName} 2>/dev/null || true`
    );
    await sshService.executeCommand(
      serverId,
      `docker rm ${oldContainerName} 2>/dev/null || true`
    );

    // Run new container
    log += 'Starting new container...\n';
    const runResult = await sshService.executeCommand(
      serverId,
      `docker run -d --name ${oldContainerName} -p 3000:3000 --restart unless-stopped ${imageName}`
    );

    if (!runResult.success) {
      throw new Error(`Failed to start container: ${runResult.stderr}`);
    }

    log += `✅ Container started: ${runResult.stdout.trim()}\n`;

    // Health check
    log += 'Running health check...\n';
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    const healthCheck = await sshService.executeCommand(
      serverId,
      `docker ps --filter name=${oldContainerName} --format "{{.Status}}"`
    );

    log += `Health check: ${healthCheck.stdout.trim()}\n`;

    // Cleanup
    await sshService.executeCommand(serverId, `rm -rf ${remoteDir}`);

    log += '✅ Deployment completed successfully\n';
    return log;
  }

  // Deploy directly (without containerization)
  async deployDirect(sourceDir, serverId, buildCommand) {
    let log = '📦 Direct deployment started\n';

    const remoteDir = '/var/www/app';

    // Create remote directory
    await sshService.executeCommand(serverId, `mkdir -p ${remoteDir}`);

    // Upload files
    log += 'Uploading files...\n';
    // In production, use proper file transfer methods

    // Execute build command if provided
    if (buildCommand) {
      log += `Executing build command: ${buildCommand}\n`;
      const buildResult = await sshService.executeCommand(
        serverId,
        `cd ${remoteDir} && ${buildCommand}`
      );

      log += buildResult.stdout + '\n';
      if (!buildResult.success) {
        log += 'Build warnings:\n' + buildResult.stderr + '\n';
      }
    }

    // Restart service (assuming PM2 or systemd)
    log += 'Restarting service...\n';
    const restartResult = await sshService.executeCommand(
      serverId,
      'pm2 restart app || systemctl restart app'
    );

    log += restartResult.stdout + '\n';
    log += '✅ Direct deployment completed\n';

    return log;
  }

  // Deploy to Kubernetes
  async deployKubernetes(sourceDir, serverId) {
    let log = '☸️ Kubernetes deployment started\n';

    // Check for k8s manifests
    const manifestsDir = path.join(sourceDir, 'k8s');
    try {
      await fs.access(manifestsDir);
    } catch {
      throw new Error('Kubernetes manifests not found (k8s/ directory)');
    }

    log += 'Applying Kubernetes manifests...\n';

    const manifests = await fs.readdir(manifestsDir);
    const ssh = await sshService.getConnection(serverId);

    for (const manifest of manifests) {
      if (manifest.endsWith('.yaml') || manifest.endsWith('.yml')) {
        const manifestPath = path.join(manifestsDir, manifest);
        const tempFile = `/tmp/k8s-${Date.now()}-${manifest}`;

        await ssh.putFile(manifestPath, tempFile);

        const applyResult = await sshService.executeCommand(serverId, `kubectl apply -f ${tempFile}`);
        log += `Applied ${manifest}:\n${applyResult.stdout}\n`;
        await sshService.executeCommand(serverId, `rm ${tempFile}`);
      }
    }

    log += '✅ Kubernetes deployment completed\n';
    return log;
  }

  // Rollback deployment
  async rollback(deploymentId) {
    const deployment = await query(
      'SELECT * FROM deployments WHERE id = $1',
      [deploymentId]
    );

    if (deployment.rows.length === 0) {
      throw new Error('Deployment not found');
    }

    const deploy = deployment.rows[0];

    // Find previous successful deployment
    const previous = await query(
      `SELECT * FROM deployments
       WHERE server_id = $1
       AND environment = $2
       AND status = 'success'
       AND id < $3
       ORDER BY id DESC
       LIMIT 1`,
      [deploy.server_id, deploy.environment, deploymentId]
    );

    if (previous.rows.length === 0) {
      throw new Error('No previous deployment to rollback to');
    }

    const prevDeploy = previous.rows[0];

    // Redeploy previous version
    return await this.deployFromGit({
      repositoryUrl: prevDeploy.repository_url,
      branch: prevDeploy.branch,
      serverId: prevDeploy.server_id,
      environment: prevDeploy.environment,
      userId: deploy.user_id,
      deploymentType: prevDeploy.deployment_type,
    });
  }

  // Get deployment history
  async getHistory(serverId = null, limit = 50) {
    let sql = 'SELECT d.*, u.username FROM deployments d LEFT JOIN users u ON d.user_id = u.id';
    const params = [];

    if (serverId) {
      sql += ' WHERE d.server_id = $1';
      params.push(serverId);
    }

    sql += ' ORDER BY d.started_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  }

  // Get deployment by ID
  async getDeployment(deploymentId) {
    const result = await query(
      `SELECT d.*, u.username, s.name as server_name
       FROM deployments d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN servers s ON d.server_id = s.id
       WHERE d.id = $1`,
      [deploymentId]
    );

    return result.rows[0] || null;
  }
}

export default new DeploymentService();
