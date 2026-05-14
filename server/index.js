import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { initDatabase } from './database/init.js';
import metricsService from './services/metrics.service.js';
import { authenticate } from './middleware/auth.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import serversRoutes from './routes/servers.routes.js';
import chatRoutes from './routes/chat.routes.js';
import containersRoutes from './routes/containers.routes.js';
import deploymentsRoutes from './routes/deployments.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import logsRoutes from './routes/logs.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/containers', containersRoutes);
app.use('/api/deployments', deploymentsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/logs', logsRoutes);

// Dashboard statistics endpoint
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const { query } = await import('./database/init.js');
    const serverStats = await metricsService.getServerStatistics();
    const alertStats = await metricsService.getAlertStatistics();

    const containerStats = await query(`
      SELECT
        COUNT(*) as total_containers,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_containers
      FROM containers
    `);

    const deploymentStats = await query(`
      SELECT
        COUNT(*) as total_deployments,
        COUNT(CASE WHEN started_at > datetime('now', '-7 days') THEN 1 END) as recent_deployments
      FROM deployments
    `);

    res.json({
      servers: serverStats,
      alerts: alertStats,
      containers: containerStats.rows[0],
      deployments: deploymentStats.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} (user: ${socket.userId})`);

  socket.on('subscribe:server', (serverId) => {
    socket.join(`server:${serverId}`);
  });

  socket.on('unsubscribe:server', (serverId) => {
    socket.leave(`server:${serverId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Broadcast metrics updates every 10 seconds
setInterval(async () => {
  try {
    const serverStats = await metricsService.getServerStatistics();
    io.emit('metrics:update', serverStats);
  } catch (error) {
    logger.error('Error broadcasting metrics:', error);
  }
}, 10000);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.message}`, err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize and start server
async function start() {
  try {
    logger.info('Starting DevOpsMind...');

    await initDatabase();
    logger.info('Database initialized');

    metricsService.start();
    logger.info('Metrics collection started');

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      metricsService.stop();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      metricsService.stop();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { io };
