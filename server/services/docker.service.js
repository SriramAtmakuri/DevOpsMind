import Docker from 'dockerode';
import sshService from './ssh.service.js';

class DockerService {
  constructor() {
    this.dockerInstances = new Map();
  }

  // Get Docker instance (local or remote via SSH)
  getDockerInstance(serverId = null) {
    if (!serverId) {
      // Local Docker
      if (!this.dockerInstances.has('local')) {
        this.dockerInstances.set('local', new Docker());
      }
      return this.dockerInstances.get('local');
    }

    // Remote Docker via SSH (would require SSH tunnel setup)
    if (!this.dockerInstances.has(serverId)) {
      // For remote servers, we'll execute docker commands via SSH
      return null;
    }
    return this.dockerInstances.get(serverId);
  }

  // List all containers
  async listContainers(serverId = null, all = true) {
    // For demo purposes, fetch from database instead of Docker API
    try {
      const { db } = await import('../database/sqlite-init.js');

      let query = 'SELECT * FROM containers';
      let params = [];

      if (serverId) {
        query += ' WHERE server_id = ?';
        params.push(serverId);
      }

      query += ' ORDER BY created_at DESC';

      const containers = db.prepare(query).all(...params);
      return containers;
    } catch (error) {
      throw new Error(`Failed to list containers: ${error.message}`);
    }
  }

  // List containers via SSH
  async listContainersSSH(serverId, all = true) {
    const flag = all ? '-a' : '';
    const command = `docker ps ${flag} --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"`;
    const result = await sshService.executeCommand(serverId, command);

    if (!result.success) {
      throw new Error(`Failed to list containers: ${result.stderr}`);
    }

    const lines = result.stdout.trim().split('\n').filter(line => line);
    return lines.map(line => {
      const [id, name, image, status, ports] = line.split('|');
      return { id, name, image, status, ports };
    });
  }

  // Get container stats
  async getContainerStats(containerId, serverId = null) {
    if (serverId) {
      return await this.getContainerStatsSSH(containerId, serverId);
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage -
                       stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage -
                          stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) *
                         stats.cpu_stats.online_cpus * 100;

      const memUsage = stats.memory_stats.usage;
      const memLimit = stats.memory_stats.limit;
      const memPercent = (memUsage / memLimit) * 100;

      return {
        cpu: cpuPercent.toFixed(2),
        memory: memPercent.toFixed(2),
        memoryUsage: memUsage,
        memoryLimit: memLimit,
        networkRx: stats.networks?.eth0?.rx_bytes || 0,
        networkTx: stats.networks?.eth0?.tx_bytes || 0,
      };
    } catch (error) {
      throw new Error(`Failed to get container stats: ${error.message}`);
    }
  }

  // Get container stats via SSH
  async getContainerStatsSSH(containerId, serverId) {
    const command = `docker stats ${containerId} --no-stream --format "{{.CPUPerc}}|{{.MemPerc}}|{{.MemUsage}}"`;
    const result = await sshService.executeCommand(serverId, command);

    if (!result.success) {
      throw new Error(`Failed to get stats: ${result.stderr}`);
    }

    const [cpu, mem, memUsage] = result.stdout.trim().split('|');
    return {
      cpu: cpu.replace('%', ''),
      memory: mem.replace('%', ''),
      memoryUsage: memUsage,
    };
  }

  // Get container logs
  async getContainerLogs(containerId, tail = 100, serverId = null) {
    if (serverId) {
      return await this.getContainerLogsSSH(containerId, tail, serverId);
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      return logs.toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  // Get container logs via SSH
  async getContainerLogsSSH(containerId, tail, serverId) {
    const command = `docker logs ${containerId} --tail ${tail} --timestamps`;
    const result = await sshService.executeCommand(serverId, command);
    return result.success ? result.stdout : result.stderr;
  }

  // Start container
  async startContainer(containerId, serverId = null) {
    if (serverId) {
      const command = `docker start ${containerId}`;
      const result = await sshService.executeCommand(serverId, command);
      return result.success;
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      await container.start();
      return true;
    } catch (error) {
      throw new Error(`Failed to start container: ${error.message}`);
    }
  }

  // Stop container
  async stopContainer(containerId, serverId = null) {
    if (serverId) {
      const command = `docker stop ${containerId}`;
      const result = await sshService.executeCommand(serverId, command);
      return result.success;
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      await container.stop();
      return true;
    } catch (error) {
      throw new Error(`Failed to stop container: ${error.message}`);
    }
  }

  // Restart container
  async restartContainer(containerId, serverId = null) {
    if (serverId) {
      const command = `docker restart ${containerId}`;
      const result = await sshService.executeCommand(serverId, command);
      return result.success;
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      await container.restart();
      return true;
    } catch (error) {
      throw new Error(`Failed to restart container: ${error.message}`);
    }
  }

  // Remove container
  async removeContainer(containerId, force = false, serverId = null) {
    if (serverId) {
      const forceFlag = force ? '-f' : '';
      const command = `docker rm ${forceFlag} ${containerId}`;
      const result = await sshService.executeCommand(serverId, command);
      return result.success;
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      await container.remove({ force });
      return true;
    } catch (error) {
      throw new Error(`Failed to remove container: ${error.message}`);
    }
  }

  // Execute command in container
  async execInContainer(containerId, command, serverId = null) {
    if (serverId) {
      const cmd = `docker exec ${containerId} ${command}`;
      return await sshService.executeCommand(serverId, cmd);
    }

    try {
      const docker = this.getDockerInstance();
      const container = docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: command.split(' '),
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start();
      let output = '';

      return new Promise((resolve, reject) => {
        stream.on('data', data => {
          output += data.toString();
        });

        stream.on('end', () => {
          resolve({ success: true, stdout: output, stderr: '' });
        });

        stream.on('error', error => {
          reject(error);
        });
      });
    } catch (error) {
      throw new Error(`Failed to execute command: ${error.message}`);
    }
  }

  // Build image from Dockerfile
  async buildImage(contextPath, imageName, serverId = null) {
    if (serverId) {
      const command = `cd ${contextPath} && docker build -t ${imageName} .`;
      return await sshService.executeCommand(serverId, command);
    }

    try {
      const docker = this.getDockerInstance();
      const stream = await docker.buildImage(
        { context: contextPath, src: ['Dockerfile'] },
        { t: imageName }
      );

      return new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    } catch (error) {
      throw new Error(`Failed to build image: ${error.message}`);
    }
  }

  // List images
  async listImages(serverId = null) {
    if (serverId) {
      const command = 'docker images --format "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}"';
      const result = await sshService.executeCommand(serverId, command);

      if (!result.success) {
        return [];
      }

      const lines = result.stdout.trim().split('\n').filter(line => line);
      return lines.map(line => {
        const [name, id, size] = line.split('|');
        return { name, id, size };
      });
    }

    try {
      const docker = this.getDockerInstance();
      const images = await docker.listImages();

      return images.map(image => ({
        name: image.RepoTags?.[0] || '<none>',
        id: image.Id.substring(7, 19),
        size: this.formatBytes(image.Size),
        created: image.Created,
      }));
    } catch (error) {
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }

  // Helper: Format ports
  formatPorts(ports) {
    if (!ports || ports.length === 0) return '';
    return ports.map(p => {
      if (p.PublicPort) {
        return `${p.PublicPort}:${p.PrivatePort}`;
      }
      return `${p.PrivatePort}`;
    }).join(', ');
  }

  // Helper: Format bytes
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new DockerService();
