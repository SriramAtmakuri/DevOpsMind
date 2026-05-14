import { NodeSSH } from 'node-ssh';
import { query } from '../database/init.js';
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET)
  .digest(); // 32 bytes

class SSHService {
  constructor() {
    this.connections = new Map(); // Cache active connections
  }

  // Get or create SSH connection
  async getConnection(serverId) {
    if (this.connections.has(serverId)) {
      const conn = this.connections.get(serverId);
      if (conn.isConnected()) {
        return conn;
      }
    }

    const result = await query(
      'SELECT * FROM servers WHERE id = $1',
      [serverId]
    );

    if (result.rows.length === 0) {
      throw new Error('Server not found');
    }

    const server = result.rows[0];
    const ssh = new NodeSSH();

    const config = {
      host: server.ip_address,
      port: server.port,
      username: server.username,
    };

    if (server.auth_type === 'password') {
      config.password = this.decrypt(server.password);
    } else {
      config.privateKey = this.decrypt(server.private_key);
    }

    try {
      await ssh.connect(config);
      this.connections.set(serverId, ssh);
      return ssh;
    } catch (error) {
      throw new Error(`Failed to connect to server: ${error.message}`);
    }
  }

  // Execute command on server
  async executeCommand(serverId, command) {
    const ssh = await this.getConnection(serverId);
    try {
      const result = await ssh.execCommand(command);
      return {
        success: result.code === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        code: 1,
      };
    }
  }

  // Get system metrics
  async getSystemMetrics(serverId) {
    const commands = {
      cpu: "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1",
      memory: "free | grep Mem | awk '{print ($3/$2) * 100.0}'",
      disk: "df -h / | tail -1 | awk '{print $5}' | sed 's/%//'",
      uptime: "cat /proc/uptime | awk '{print $1}'",
      load: "cat /proc/loadavg | awk '{print $1}'",
    };

    const results = {};
    for (const [key, cmd] of Object.entries(commands)) {
      const result = await this.executeCommand(serverId, cmd);
      results[key] = result.success ? parseFloat(result.stdout.trim()) : 0;
    }

    // Get detailed memory info
    const memInfo = await this.executeCommand(
      serverId,
      "free -b | grep Mem | awk '{print $2,$3}'"
    );
    const [memTotal, memUsed] = memInfo.stdout.trim().split(' ').map(Number);

    // Get detailed disk info
    const diskInfo = await this.executeCommand(
      serverId,
      "df -B1 / | tail -1 | awk '{print $2,$3}'"
    );
    const [diskTotal, diskUsed] = diskInfo.stdout.trim().split(' ').map(Number);

    return {
      cpu_usage: results.cpu || 0,
      memory_usage: results.memory || 0,
      memory_total: memTotal || 0,
      memory_used: memUsed || 0,
      disk_usage: results.disk || 0,
      disk_total: diskTotal || 0,
      disk_used: diskUsed || 0,
      load_average: results.load || 0,
      uptime: results.uptime || 0,
    };
  }

  // Get running processes
  async getProcesses(serverId, limit = 20) {
    const command = `ps aux --sort=-%cpu | head -n ${limit + 1}`;
    const result = await this.executeCommand(serverId, command);

    if (!result.success) {
      return [];
    }

    const lines = result.stdout.trim().split('\n');
    const processes = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 11) {
        processes.push({
          user: parts[0],
          pid: parts[1],
          cpu: parseFloat(parts[2]),
          memory: parseFloat(parts[3]),
          command: parts.slice(10).join(' '),
        });
      }
    }

    return processes;
  }

  // Check if server is reachable
  async checkConnection(serverId) {
    try {
      const ssh = await this.getConnection(serverId);
      const result = await ssh.execCommand('echo "ok"');
      return result.code === 0;
    } catch (error) {
      return false;
    }
  }

  // Read log file
  async readLogs(serverId, logPath, lines = 100) {
    const command = `tail -n ${lines} ${logPath}`;
    const result = await this.executeCommand(serverId, command);
    return result.success ? result.stdout : '';
  }

  // Get network connections
  async getNetworkConnections(serverId) {
    const command = "netstat -tuln | grep LISTEN";
    const result = await this.executeCommand(serverId, command);

    if (!result.success) {
      return [];
    }

    const lines = result.stdout.trim().split('\n');
    const connections = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const address = parts[3].split(':');
        connections.push({
          protocol: parts[0],
          port: address[address.length - 1],
          address: address.slice(0, -1).join(':') || '*',
        });
      }
    }

    return connections;
  }

  // Check SSL certificates
  async checkSSLCert(domain) {
    const command = `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates`;
    const result = await this.executeCommand(1, command); // Use any server or local

    if (!result.success) {
      return null;
    }

    const lines = result.stdout.split('\n');
    const dates = {};

    for (const line of lines) {
      if (line.startsWith('notBefore=')) {
        dates.notBefore = line.substring(10);
      } else if (line.startsWith('notAfter=')) {
        dates.notAfter = line.substring(9);
      }
    }

    return dates;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(text) {
    const buf = Buffer.from(text, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // Close connection
  closeConnection(serverId) {
    if (this.connections.has(serverId)) {
      const conn = this.connections.get(serverId);
      conn.dispose();
      this.connections.delete(serverId);
    }
  }

  // Close all connections
  closeAll() {
    for (const [serverId, conn] of this.connections) {
      conn.dispose();
    }
    this.connections.clear();
  }
}

export default new SSHService();
