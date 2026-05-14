import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database file
const dbPath = path.join(__dirname, '../../devopsmind.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
async function initDatabase() {
  try {
    console.log('🔄 Initializing SQLite database...');

    // Create tables
    db.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT
      );

      -- Servers table
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        auth_type TEXT DEFAULT 'password',
        password TEXT,
        private_key TEXT,
        environment TEXT,
        tags TEXT,
        status TEXT DEFAULT 'unknown',
        last_check TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Server metrics table
      CREATE TABLE IF NOT EXISTS server_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        cpu_usage REAL,
        memory_usage REAL,
        memory_total INTEGER,
        memory_used INTEGER,
        disk_usage REAL,
        disk_total INTEGER,
        disk_used INTEGER,
        network_rx INTEGER,
        network_tx INTEGER,
        load_average REAL,
        uptime INTEGER,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_server_metrics_server_time ON server_metrics(server_id, timestamp DESC);

      -- Containers table
      CREATE TABLE IF NOT EXISTS containers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        container_id TEXT NOT NULL,
        name TEXT NOT NULL,
        image TEXT,
        status TEXT,
        ports TEXT,
        created_at TEXT,
        started_at TEXT,
        last_check TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      -- Deployments table
      CREATE TABLE IF NOT EXISTS deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        user_id INTEGER,
        repository_url TEXT,
        branch TEXT,
        commit_hash TEXT,
        commit_message TEXT,
        environment TEXT,
        status TEXT,
        deployment_type TEXT,
        build_log TEXT,
        error_message TEXT,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        duration INTEGER,
        FOREIGN KEY (server_id) REFERENCES servers(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Alerts table
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        alert_type TEXT NOT NULL,
        severity TEXT DEFAULT 'warning',
        message TEXT NOT NULL,
        threshold_value REAL,
        current_value REAL,
        status TEXT DEFAULT 'active',
        triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TEXT,
        resolved_at TEXT,
        acknowledged_by INTEGER,
        notification_sent INTEGER DEFAULT 0,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (acknowledged_by) REFERENCES users(id)
      );

      -- Alert rules table
      CREATE TABLE IF NOT EXISTS alert_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        rule_name TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL NOT NULL,
        duration INTEGER DEFAULT 300,
        severity TEXT DEFAULT 'warning',
        notification_channels TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      -- Chat conversations table
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Chat messages table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER,
        user_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Logs table
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        container_id INTEGER,
        log_level TEXT,
        source TEXT,
        message TEXT NOT NULL,
        metadata TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_logs_server_time ON logs(server_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(log_level);

      -- Database connections table
      CREATE TABLE IF NOT EXISTS database_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        db_type TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        database_name TEXT,
        username TEXT,
        password TEXT,
        connection_string TEXT,
        ssl_enabled INTEGER DEFAULT 0,
        environment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Query history table
      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        database_id INTEGER,
        user_id INTEGER,
        query_text TEXT NOT NULL,
        query_type TEXT,
        execution_time INTEGER,
        rows_affected INTEGER,
        success INTEGER,
        error_message TEXT,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Security scans table
      CREATE TABLE IF NOT EXISTS security_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        scan_type TEXT,
        status TEXT,
        findings TEXT,
        severity_summary TEXT,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        triggered_by INTEGER,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (triggered_by) REFERENCES users(id)
      );

      -- Cost tracking table
      CREATE TABLE IF NOT EXISTS cost_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        provider TEXT,
        resource_type TEXT,
        resource_name TEXT,
        cost REAL,
        currency TEXT DEFAULT 'USD',
        billing_period_start TEXT,
        billing_period_end TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      -- API keys table
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        key_name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        permissions TEXT,
        last_used TEXT,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        revoked INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Audit log table
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
    `);

    // Create default admin user if not exists
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

    if (!adminExists) {
      const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('hex');
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `).run('admin', 'admin@devopsmind.local', passwordHash, 'admin');

      console.log('✅ Default admin user created');
      if (!process.env.ADMIN_PASSWORD) {
        console.log(`🔑 Generated admin password: ${adminPassword}  ← SAVE THIS`);
      }
    }

    // Create default guest user if not exists
    const guestExists = db.prepare('SELECT id FROM users WHERE username = ?').get('guest');

    if (!guestExists) {
      const guestPassword = process.env.GUEST_PASSWORD || crypto.randomBytes(12).toString('hex');
      const passwordHash = await bcrypt.hash(guestPassword, 12);
      db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `).run('guest', 'guest@devopsmind.local', passwordHash, 'user');

      console.log('✅ Default guest user created');
      if (!process.env.GUEST_PASSWORD) {
        console.log(`🔑 Generated guest password: ${guestPassword}  ← SAVE THIS`);
      }
    }

    console.log('✅ SQLite database initialized successfully!');

    // Seed demo data
    const { seedDemoData } = await import('./seed-data.js');
    await seedDemoData();
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Query helper function (compatible with pg interface)
function query(text, params = []) {
  try {
    // Convert PostgreSQL $1, $2 syntax to SQLite ?
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');

    // Determine if it's a SELECT or other query
    if (text.trim().toUpperCase().startsWith('SELECT')) {
      const stmt = db.prepare(sqliteQuery);
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    } else if (text.trim().toUpperCase().startsWith('INSERT') && text.includes('RETURNING')) {
      // Handle INSERT ... RETURNING
      const queryWithoutReturning = sqliteQuery.replace(/RETURNING.*/i, '');
      const stmt = db.prepare(queryWithoutReturning);
      const result = stmt.run(...params);
      const lastId = result.lastInsertRowid;
      const selectStmt = db.prepare(`SELECT * FROM ${getTableName(text)} WHERE id = ?`);
      const rows = [selectStmt.get(lastId)];
      return { rows, rowCount: rows.length };
    } else {
      const stmt = db.prepare(sqliteQuery);
      const result = stmt.run(...params);
      return { rows: [], rowCount: result.changes };
    }
  } catch (error) {
    console.error('Query error:', { text, error: error.message });
    throw error;
  }
}

function getTableName(sql) {
  const match = sql.match(/INTO\s+(\w+)/i);
  return match ? match[1] : null;
}

// Get a client (for compatibility with pg)
async function getClient() {
  return {
    query,
    release: () => {},
  };
}

export { db, query, getClient, initDatabase };
