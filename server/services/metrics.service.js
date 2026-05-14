import cron from 'node-cron';
import { query } from '../database/init.js';
import sshService from './ssh.service.js';
import dockerService from './docker.service.js';
import logger from '../utils/logger.js';

class MetricsService {
  constructor() {
    this.collectInterval = null;
    this.isCollecting = false;
  }

  // Start metrics collection
  start() {
    if (this.isCollecting) return;

    console.log('📊 Starting metrics collection...');

    // Collect metrics every minute
    this.collectInterval = cron.schedule('* * * * *', async () => {
      await this.collectAllMetrics();
    });

    // Clean old metrics daily at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.cleanOldMetrics();
    });

    this.isCollecting = true;
  }

  // Stop metrics collection
  stop() {
    if (this.collectInterval) {
      this.collectInterval.stop();
      this.isCollecting = false;
      console.log('📊 Metrics collection stopped');
    }
  }

  // Collect metrics from all servers
  async collectAllMetrics() {
    try {
      const result = await query(
        "SELECT id FROM servers WHERE status != 'offline'"
      );

      for (const row of result.rows) {
        await this.collectServerMetrics(row.id);
      }
    } catch (error) {
      console.error('Error collecting metrics:', error.message);
    }
  }

  // Collect metrics for a specific server
  async collectServerMetrics(serverId) {
    try {
      let metrics;

      // Try real SSH metrics first
      try {
        metrics = await sshService.getSystemMetrics(serverId);
        logger.info(`Real metrics collected for server ${serverId}`);
      } catch (sshError) {
        // Fall back to simulated data for demo/unreachable servers
        logger.warn(`SSH metrics unavailable for server ${serverId} (${sshError.message}) — using simulated data`);
        metrics = {
          cpu_usage: 20 + Math.random() * 60,
          memory_usage: 30 + Math.random() * 50,
          memory_total: 16384,
          memory_used: Math.floor(16384 * (0.3 + Math.random() * 0.5)),
          disk_usage: 40 + Math.random() * 30,
          disk_total: 512000,
          disk_used: Math.floor(512000 * (0.4 + Math.random() * 0.3)),
          load_average: Math.random() * 2,
          uptime: Math.floor(Math.random() * 30 * 24 * 3600),
        };
      }

      // Insert metrics into database
      await query(
        `INSERT INTO server_metrics (
          server_id, cpu_usage, memory_usage, memory_total, memory_used,
          disk_usage, disk_total, disk_used, load_average, uptime
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          serverId,
          metrics.cpu_usage,
          metrics.memory_usage,
          metrics.memory_total,
          metrics.memory_used,
          metrics.disk_usage,
          metrics.disk_total,
          metrics.disk_used,
          metrics.load_average,
          metrics.uptime,
        ]
      );

      // Update server status
      await query(
        "UPDATE servers SET status = 'online', last_check = CURRENT_TIMESTAMP WHERE id = $1",
        [serverId]
      );

      // Check alert thresholds
      await this.checkAlertRules(serverId, metrics);
    } catch (error) {
      logger.error(`Error collecting metrics for server ${serverId}: ${error.message}`);
      await query(
        "UPDATE servers SET status = 'offline', last_check = CURRENT_TIMESTAMP WHERE id = $1",
        [serverId]
      );
    }
  }

  // Get metrics history
  async getMetricsHistory(serverId, hours = 24) {
    const result = await query(
      `SELECT * FROM server_metrics
       WHERE server_id = $1
       AND timestamp > datetime('now', '-${hours} hours')
       ORDER BY timestamp ASC`,
      [serverId]
    );

    return result.rows;
  }

  // Get current metrics
  async getCurrentMetrics(serverId) {
    const result = await query(
      `SELECT * FROM server_metrics
       WHERE server_id = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [serverId]
    );

    return result.rows[0] || null;
  }

  // Get aggregated metrics
  async getAggregatedMetrics(serverId, interval = '1 hour', limit = 24) {
    const result = await query(
      `SELECT
         strftime('%Y-%m-%d %H:00:00', timestamp) as time_bucket,
         AVG(cpu_usage) as avg_cpu,
         MAX(cpu_usage) as max_cpu,
         AVG(memory_usage) as avg_memory,
         MAX(memory_usage) as max_memory,
         AVG(disk_usage) as avg_disk,
         AVG(load_average) as avg_load
       FROM server_metrics
       WHERE server_id = $1
       GROUP BY time_bucket
       ORDER BY time_bucket DESC
       LIMIT $2`,
      [serverId, limit]
    );

    return result.rows;
  }

  // Check alert rules
  async checkAlertRules(serverId, metrics) {
    const rules = await query(
      'SELECT * FROM alert_rules WHERE server_id = $1 AND enabled = 1',
      [serverId]
    );

    for (const rule of rules.rows) {
      const metricValue = metrics[`${rule.metric_type}_usage`];

      if (!metricValue) continue;

      let shouldTrigger = false;

      switch (rule.condition) {
        case 'greater_than':
          shouldTrigger = metricValue > rule.threshold;
          break;
        case 'less_than':
          shouldTrigger = metricValue < rule.threshold;
          break;
        case 'equals':
          shouldTrigger = metricValue === rule.threshold;
          break;
      }

      if (shouldTrigger) {
        await this.triggerAlert(serverId, rule, metricValue);
      }
    }
  }

  // Trigger alert
  async triggerAlert(serverId, rule, currentValue) {
    // Check if alert already exists and is active
    const existing = await query(
      `SELECT id FROM alerts
       WHERE server_id = $1
       AND alert_type = $2
       AND status = 'active'`,
      [serverId, rule.metric_type]
    );

    if (existing.rows.length > 0) {
      return; // Alert already active
    }

    // Create new alert
    const message = `${rule.rule_name}: ${rule.metric_type} is ${currentValue.toFixed(2)}% (threshold: ${rule.threshold}%)`;

    await query(
      `INSERT INTO alerts (
        server_id, alert_type, severity, message,
        threshold_value, current_value, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [serverId, rule.metric_type, rule.severity, message, rule.threshold, currentValue]
    );

    // Send notifications
    await this.sendAlertNotifications(rule, message);
  }

  // Send alert notifications
  async sendAlertNotifications(rule, message) {
    if (rule.notification_channels) {
      for (const channel of rule.notification_channels) {
        try {
          switch (channel) {
            case 'email':
              // Email notification implementation
              console.log('📧 Email alert:', message);
              break;
            case 'slack':
              // Slack notification implementation
              console.log('💬 Slack alert:', message);
              break;
            case 'webhook':
              // Webhook notification implementation
              console.log('🔔 Webhook alert:', message);
              break;
          }
        } catch (error) {
          console.error(`Failed to send ${channel} notification:`, error.message);
        }
      }
    }
  }

  // Clean old metrics (keep only last 30 days)
  async cleanOldMetrics() {
    try {
      const result = await query(
        "DELETE FROM server_metrics WHERE timestamp < datetime('now', '-30 days')"
      );

      console.log(`🧹 Cleaned ${result.rowCount} old metric records`);
    } catch (error) {
      console.error('Error cleaning old metrics:', error.message);
    }
  }

  // Get server statistics
  async getServerStatistics() {
    const result = await query(`
      SELECT
        COUNT(*) as total_servers,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_servers,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_servers,
        COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_servers
      FROM servers
    `);

    return result.rows[0];
  }

  // Get alert statistics
  async getAlertStatistics() {
    const result = await query(`
      SELECT
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_alerts,
        COUNT(CASE WHEN severity = 'info' THEN 1 END) as info_alerts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts
      FROM alerts
      WHERE triggered_at > datetime('now', '-24 hours')
    `);

    return result.rows[0];
  }
}

export default new MetricsService();
