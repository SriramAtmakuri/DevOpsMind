import { db } from './sqlite-init.js';
import bcrypt from 'bcrypt';

export async function seedDemoData() {
  try {
    console.log('🌱 Seeding demo data...');

    // Check if data already exists
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers').get();
    if (serverCount.count > 0) {
      console.log('✅ Demo data already exists, skipping seed...');
      return;
    }

    // Insert demo servers
    const servers = [
      {
        name: 'Production Web Server',
        hostname: 'prod-web-01.example.com',
        ip_address: '192.168.1.10',
        port: 22,
        username: 'ubuntu',
        auth_type: 'key',
        environment: 'production',
        tags: JSON.stringify(['web', 'nginx', 'production']),
        status: 'online',
        created_by: 1
      },
      {
        name: 'Production API Server',
        hostname: 'prod-api-01.example.com',
        ip_address: '192.168.1.11',
        port: 22,
        username: 'ubuntu',
        auth_type: 'key',
        environment: 'production',
        tags: JSON.stringify(['api', 'nodejs', 'production']),
        status: 'online',
        created_by: 1
      },
      {
        name: 'Staging Server',
        hostname: 'staging-01.example.com',
        ip_address: '192.168.1.20',
        port: 22,
        username: 'ubuntu',
        auth_type: 'password',
        environment: 'staging',
        tags: JSON.stringify(['staging', 'testing']),
        status: 'online',
        created_by: 1
      },
      {
        name: 'Development Server',
        hostname: 'dev-01.example.com',
        ip_address: '192.168.1.30',
        port: 22,
        username: 'developer',
        auth_type: 'password',
        environment: 'development',
        tags: JSON.stringify(['development', 'docker']),
        status: 'online',
        created_by: 1
      },
      {
        name: 'Database Server',
        hostname: 'db-master-01.example.com',
        ip_address: '192.168.1.40',
        port: 22,
        username: 'postgres',
        auth_type: 'key',
        environment: 'production',
        tags: JSON.stringify(['database', 'postgresql', 'production']),
        status: 'warning',
        created_by: 1
      },
      {
        name: 'Redis Cache Server',
        hostname: 'cache-01.example.com',
        ip_address: '192.168.1.50',
        port: 22,
        username: 'redis',
        auth_type: 'key',
        environment: 'production',
        tags: JSON.stringify(['cache', 'redis', 'production']),
        status: 'online',
        created_by: 1
      }
    ];

    const serverIds = [];
    for (const server of servers) {
      const result = db.prepare(`
        INSERT INTO servers (name, hostname, ip_address, port, username, auth_type, environment, tags, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        server.name, server.hostname, server.ip_address, server.port, 
        server.username, server.auth_type, server.environment, server.tags, 
        server.status, server.created_by
      );
      serverIds.push(result.lastInsertRowid);
    }

    console.log(`✅ Inserted ${serverIds.length} demo servers`);

    // Insert metrics for each server (last 24 hours)
    const now = new Date();
    for (const serverId of serverIds) {
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString();
        const cpuUsage = 20 + Math.random() * 60;
        const memoryUsage = 30 + Math.random() * 50;
        const diskUsage = 40 + Math.random() * 30;
        
        db.prepare(`
          INSERT INTO server_metrics (
            server_id, cpu_usage, memory_usage, memory_total, memory_used,
            disk_usage, disk_total, disk_used, load_average, uptime, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          serverId,
          cpuUsage,
          memoryUsage,
          16384, // 16GB total
          Math.floor(16384 * memoryUsage / 100),
          diskUsage,
          512000, // 500GB total
          Math.floor(512000 * diskUsage / 100),
          Math.random() * 2,
          Math.floor(Math.random() * 30 * 24 * 3600), // uptime in seconds
          timestamp
        );
      }
    }

    console.log('✅ Inserted server metrics');

    // Insert demo containers
    const containers = [
      {
        server_id: serverIds[0],
        container_id: 'abc123def456',
        name: 'nginx-proxy',
        image: 'nginx:alpine',
        status: 'running',
        ports: JSON.stringify([{ host: 80, container: 80 }, { host: 443, container: 443 }]),
        created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[1],
        container_id: 'def456ghi789',
        name: 'api-service',
        image: 'node:18-alpine',
        status: 'running',
        ports: JSON.stringify([{ host: 3000, container: 3000 }]),
        created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[1],
        container_id: 'ghi789jkl012',
        name: 'worker-queue',
        image: 'node:18-alpine',
        status: 'running',
        ports: JSON.stringify([]),
        created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[3],
        container_id: 'jkl012mno345',
        name: 'dev-postgres',
        image: 'postgres:15',
        status: 'running',
        ports: JSON.stringify([{ host: 5432, container: 5432 }]),
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[5],
        container_id: 'mno345pqr678',
        name: 'redis-cache',
        image: 'redis:7-alpine',
        status: 'running',
        ports: JSON.stringify([{ host: 6379, container: 6379 }]),
        created_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[2],
        container_id: 'pqr678stu901',
        name: 'staging-app',
        image: 'myapp:staging',
        status: 'running',
        ports: JSON.stringify([{ host: 8080, container: 80 }]),
        created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const container of containers) {
      db.prepare(`
        INSERT INTO containers (server_id, container_id, name, image, status, ports, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        container.server_id, container.container_id, container.name,
        container.image, container.status, container.ports, container.created_at
      );
    }

    console.log(`✅ Inserted ${containers.length} demo containers`);

    // Insert demo deployments
    const deployments = [
      {
        server_id: serverIds[0],
        user_id: 1,
        repository_url: 'https://github.com/company/frontend-app',
        branch: 'main',
        commit_hash: 'abc123def456',
        commit_message: 'Fix: Resolve login redirect issue',
        environment: 'production',
        status: 'success',
        deployment_type: 'docker',
        started_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(now - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
        duration: 300
      },
      {
        server_id: serverIds[1],
        user_id: 1,
        repository_url: 'https://github.com/company/backend-api',
        branch: 'main',
        commit_hash: 'def456ghi789',
        commit_message: 'Feature: Add new authentication endpoint',
        environment: 'production',
        status: 'success',
        deployment_type: 'docker',
        started_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(now - 5 * 60 * 60 * 1000 + 7 * 60 * 1000).toISOString(),
        duration: 420
      },
      {
        server_id: serverIds[2],
        user_id: 2,
        repository_url: 'https://github.com/company/backend-api',
        branch: 'develop',
        commit_hash: 'ghi789jkl012',
        commit_message: 'Test: Update integration tests',
        environment: 'staging',
        status: 'success',
        deployment_type: 'git',
        started_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(now - 8 * 60 * 60 * 1000 + 3 * 60 * 1000).toISOString(),
        duration: 180
      },
      {
        server_id: serverIds[1],
        user_id: 1,
        repository_url: 'https://github.com/company/backend-api',
        branch: 'hotfix',
        commit_hash: 'jkl012mno345',
        commit_message: 'Hotfix: Critical security patch',
        environment: 'production',
        status: 'failed',
        deployment_type: 'docker',
        error_message: 'Docker build failed: Missing environment variables',
        started_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(now - 24 * 60 * 60 * 1000 + 2 * 60 * 1000).toISOString(),
        duration: 120
      },
      {
        server_id: serverIds[3],
        user_id: 2,
        repository_url: 'https://github.com/company/microservice',
        branch: 'feature/new-api',
        commit_hash: 'mno345pqr678',
        commit_message: 'WIP: New payment integration',
        environment: 'development',
        status: 'success',
        deployment_type: 'git',
        started_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(now - 12 * 60 * 60 * 1000 + 4 * 60 * 1000).toISOString(),
        duration: 240
      }
    ];

    for (const deployment of deployments) {
      db.prepare(`
        INSERT INTO deployments (
          server_id, user_id, repository_url, branch, commit_hash, commit_message,
          environment, status, deployment_type, error_message, started_at, completed_at, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deployment.server_id, deployment.user_id, deployment.repository_url,
        deployment.branch, deployment.commit_hash, deployment.commit_message,
        deployment.environment, deployment.status, deployment.deployment_type,
        deployment.error_message || null, deployment.started_at,
        deployment.completed_at, deployment.duration
      );
    }

    console.log(`✅ Inserted ${deployments.length} demo deployments`);

    // Insert demo alerts
    const alerts = [
      {
        server_id: serverIds[4],
        alert_type: 'memory',
        severity: 'warning',
        message: 'Database Server: memory usage is 78.50% (threshold: 75%)',
        threshold_value: 75,
        current_value: 78.5,
        status: 'active',
        triggered_at: new Date(now - 30 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[1],
        alert_type: 'cpu',
        severity: 'critical',
        message: 'Production API Server: CPU usage is 92.30% (threshold: 90%)',
        threshold_value: 90,
        current_value: 92.3,
        status: 'acknowledged',
        triggered_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        acknowledged_at: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
        acknowledged_by: 1
      },
      {
        server_id: serverIds[0],
        alert_type: 'disk',
        severity: 'info',
        message: 'Production Web Server: disk usage is 65.20% (threshold: 80%)',
        threshold_value: 80,
        current_value: 65.2,
        status: 'resolved',
        triggered_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        server_id: serverIds[4],
        alert_type: 'disk',
        severity: 'critical',
        message: 'Database Server: disk usage is 88.90% (threshold: 85%)',
        threshold_value: 85,
        current_value: 88.9,
        status: 'active',
        triggered_at: new Date(now - 10 * 60 * 1000).toISOString()
      }
    ];

    for (const alert of alerts) {
      db.prepare(`
        INSERT INTO alerts (
          server_id, alert_type, severity, message, threshold_value, current_value,
          status, triggered_at, acknowledged_at, acknowledged_by, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        alert.server_id, alert.alert_type, alert.severity, alert.message,
        alert.threshold_value, alert.current_value, alert.status, alert.triggered_at,
        alert.acknowledged_at || null, alert.acknowledged_by || null, alert.resolved_at || null
      );
    }

    console.log(`✅ Inserted ${alerts.length} demo alerts`);

    // Insert demo chat conversations
    const conversationResult = db.prepare(`
      INSERT INTO chat_conversations (user_id, title)
      VALUES (?, ?)
    `).run(1, 'Server Health Check Discussion');

    const conversationId = conversationResult.lastInsertRowid;

    const messages = [
      {
        conversation_id: conversationId,
        user_id: 1,
        role: 'user',
        content: 'Can you check the health of all production servers?'
      },
      {
        conversation_id: conversationId,
        user_id: 1,
        role: 'assistant',
        content: 'I\'ve checked all production servers. Here\'s the status:\n\n✅ Production Web Server - Online (CPU: 45%, Memory: 62%)\n✅ Production API Server - Online (CPU: 38%, Memory: 58%)\n⚠️ Database Server - Warning (CPU: 52%, Memory: 78%, Disk: 89%)\n✅ Redis Cache Server - Online (CPU: 23%, Memory: 41%)\n\nThe Database Server needs attention due to high disk usage.'
      },
      {
        conversation_id: conversationId,
        user_id: 1,
        role: 'user',
        content: 'What should I do about the database server disk usage?'
      },
      {
        conversation_id: conversationId,
        user_id: 1,
        role: 'assistant',
        content: 'Here are recommended actions for the database server:\n\n1. Check and clean old log files\n2. Analyze disk usage: `du -sh /var/lib/postgresql/*`\n3. Review and archive old database backups\n4. Consider enabling log rotation\n5. Monitor database table sizes\n\nWould you like me to help you clean up the logs?'
      }
    ];

    for (const message of messages) {
      db.prepare(`
        INSERT INTO chat_messages (conversation_id, user_id, role, content)
        VALUES (?, ?, ?, ?)
      `).run(
        message.conversation_id, message.user_id, message.role, message.content
      );
    }

    console.log('✅ Inserted demo chat conversation');

    // Insert demo logs
    const logLevels = ['info', 'warning', 'error', 'debug'];
    const logSources = ['nginx', 'api-service', 'database', 'redis', 'worker-queue', 'system'];
    const logMessages = {
      info: [
        'Server started successfully',
        'Connection established to database',
        'Request completed successfully',
        'Cache hit for key: user_session_12345',
        'Health check passed',
        'Background job completed',
        'File uploaded successfully',
        'Email sent to user',
        'User logged in successfully',
        'Configuration loaded'
      ],
      warning: [
        'High memory usage detected: 78%',
        'Slow query detected: 2.5s',
        'Connection pool near capacity',
        'Deprecated API endpoint called',
        'Rate limit approaching threshold',
        'Disk space low: 15% remaining',
        'SSL certificate expires in 30 days',
        'Cache miss rate above normal',
        'Timeout warning: operation took 8s',
        'Retry attempt #3 for failed request'
      ],
      error: [
        'Failed to connect to database',
        'Uncaught exception: TypeError',
        'Authentication failed for user',
        'File not found: /var/log/app.log',
        'Network timeout after 30s',
        'Invalid JSON in request body',
        'Permission denied: /etc/config',
        'Out of memory error',
        'Failed to send email notification',
        'Database query failed: syntax error'
      ],
      debug: [
        'Processing request from 192.168.1.100',
        'Cache lookup for key: product_123',
        'Executing query: SELECT * FROM users',
        'Middleware chain: auth -> validate -> handler',
        'Response time: 125ms',
        'Memory usage: 512MB / 2GB',
        'Active connections: 45',
        'Queue size: 12 jobs',
        'Session ID: sess_abc123def456',
        'Thread pool: 8/16 threads active'
      ]
    };

    const logs = [];
    for (let i = 0; i < 100; i++) {
      const level = logLevels[Math.floor(Math.random() * logLevels.length)];
      const source = logSources[Math.floor(Math.random() * logSources.length)];
      const messageArray = logMessages[level];
      const message = messageArray[Math.floor(Math.random() * messageArray.length)];
      const timestamp = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      const serverId = serverIds[Math.floor(Math.random() * serverIds.length)];

      logs.push({
        server_id: serverId,
        level: level,
        source: source,
        message: message,
        timestamp: timestamp
      });
    }

    // Sort logs by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    for (const log of logs) {
      db.prepare(`
        INSERT INTO logs (server_id, log_level, source, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(log.server_id, log.level, log.source, log.message, log.timestamp);
    }

    console.log(`✅ Inserted ${logs.length} demo logs`);

    console.log('🎉 Demo data seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}
