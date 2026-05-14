-- DevOpsMind Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 22,
    username VARCHAR(255) NOT NULL,
    auth_type VARCHAR(20) DEFAULT 'password', -- password or key
    password TEXT, -- encrypted
    private_key TEXT, -- encrypted
    environment VARCHAR(50), -- production, staging, development
    tags TEXT[], -- array of tags
    status VARCHAR(20) DEFAULT 'unknown', -- online, offline, warning, unknown
    last_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Server metrics table
CREATE TABLE IF NOT EXISTS server_metrics (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    memory_total BIGINT,
    memory_used BIGINT,
    disk_usage DECIMAL(5,2),
    disk_total BIGINT,
    disk_used BIGINT,
    network_rx BIGINT,
    network_tx BIGINT,
    load_average DECIMAL(5,2),
    uptime BIGINT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_server_metrics_server_time ON server_metrics(server_id, timestamp DESC);

-- Containers table
CREATE TABLE IF NOT EXISTS containers (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    container_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255),
    status VARCHAR(50),
    ports TEXT,
    created_at TIMESTAMP,
    started_at TIMESTAMP,
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id),
    user_id INTEGER REFERENCES users(id),
    repository_url VARCHAR(500),
    branch VARCHAR(255),
    commit_hash VARCHAR(255),
    commit_message TEXT,
    environment VARCHAR(50),
    status VARCHAR(50), -- pending, in_progress, success, failed, rolled_back
    deployment_type VARCHAR(50), -- docker, kubernetes, direct
    build_log TEXT,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration INTEGER -- in seconds
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- cpu_high, memory_high, disk_full, service_down
    severity VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
    message TEXT NOT NULL,
    threshold_value DECIMAL(10,2),
    current_value DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active', -- active, acknowledged, resolved
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES users(id),
    notification_sent BOOLEAN DEFAULT FALSE
);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- cpu, memory, disk, custom
    condition VARCHAR(20) NOT NULL, -- greater_than, less_than, equals
    threshold DECIMAL(10,2) NOT NULL,
    duration INTEGER DEFAULT 300, -- seconds before triggering
    severity VARCHAR(20) DEFAULT 'warning',
    notification_channels TEXT[], -- email, slack, webhook
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    metadata JSONB, -- store structured data like commands executed, servers accessed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs table (for application and system logs)
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    container_id INTEGER REFERENCES containers(id) ON DELETE CASCADE,
    log_level VARCHAR(20), -- ERROR, WARN, INFO, DEBUG
    source VARCHAR(255), -- application name or service
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_server_time ON logs(server_id, timestamp DESC);
CREATE INDEX idx_logs_level ON logs(log_level);

-- Database connections table
CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    db_type VARCHAR(50) NOT NULL, -- postgresql, mysql, mongodb, redis
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password TEXT, -- encrypted
    connection_string TEXT, -- encrypted, for MongoDB
    ssl_enabled BOOLEAN DEFAULT FALSE,
    environment VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Query history table
CREATE TABLE IF NOT EXISTS query_history (
    id SERIAL PRIMARY KEY,
    database_id INTEGER REFERENCES database_connections(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    query_text TEXT NOT NULL,
    query_type VARCHAR(20), -- SELECT, INSERT, UPDATE, DELETE
    execution_time INTEGER, -- milliseconds
    rows_affected INTEGER,
    success BOOLEAN,
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security scans table
CREATE TABLE IF NOT EXISTS security_scans (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    scan_type VARCHAR(50), -- ports, ssl, vulnerabilities, packages
    status VARCHAR(20), -- running, completed, failed
    findings JSONB, -- structured findings
    severity_summary JSONB, -- {critical: 2, high: 5, medium: 10, low: 20}
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    triggered_by INTEGER REFERENCES users(id)
);

-- Cost tracking table
CREATE TABLE IF NOT EXISTS cost_tracking (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    provider VARCHAR(50), -- aws, railway, render, digitalocean
    resource_type VARCHAR(100), -- compute, storage, network, database
    resource_name VARCHAR(255),
    cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    billing_period_start DATE,
    billing_period_end DATE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table (for external integrations)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions TEXT[], -- array of permissions
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);

-- Create default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@devopsmind.local', '$2b$10$rX7c3qX0p.JYqXZqXqXqXeKGqXqXqXqXqXqXqXqXqXqXqXqXqXqXq', 'admin')
ON CONFLICT (username) DO NOTHING;
