import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Container, Rocket, AlertTriangle, Activity, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  useEffect(() => {
    fetchStats();

    // WebSocket for live metrics
    const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setLiveConnected(true));
    socket.on('disconnect', () => setLiveConnected(false));

    socket.on('metrics:update', (serverStats) => {
      setStats((prev) => prev ? { ...prev, servers: serverStats } : prev);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard loading">Loading...</div>;

  const cards = [
    {
      title: 'Servers',
      icon: Server,
      value: stats?.servers?.total_servers ?? 0,
      subtitle: `${stats?.servers?.online_servers ?? 0} online`,
      color: 'blue',
      path: '/servers',
    },
    {
      title: 'Containers',
      icon: Container,
      value: stats?.containers?.total_containers ?? 0,
      subtitle: `${stats?.containers?.running_containers ?? 0} running`,
      color: 'purple',
      path: '/containers',
    },
    {
      title: 'Deployments',
      icon: Rocket,
      value: stats?.deployments?.total_deployments ?? 0,
      subtitle: `${stats?.deployments?.recent_deployments ?? 0} this week`,
      color: 'green',
      path: '/deployments',
    },
    {
      title: 'Active Alerts',
      icon: AlertTriangle,
      value: stats?.alerts?.active_alerts ?? 0,
      subtitle: `${stats?.alerts?.critical_alerts ?? 0} critical`,
      color: 'red',
      path: '/alerts',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Monitor your infrastructure at a glance</p>
        </div>
        <div className="header-actions">
          {/* Live indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', borderRadius: '20px',
            background: liveConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${liveConnected ? 'var(--success)' : 'var(--error)'}`,
            fontSize: '0.75rem',
          }}>
            {liveConnected
              ? <><Wifi size={12} style={{ color: 'var(--success)' }} /><span style={{ color: 'var(--success)' }}>Live</span></>
              : <><WifiOff size={12} style={{ color: 'var(--error)' }} /><span style={{ color: 'var(--error)' }}>Offline</span></>
            }
          </div>
          <button className="btn-secondary" onClick={fetchStats}>
            <Activity size={18} />
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`stat-card ${card.color} scale-in`}
            style={{ animationDelay: `${index * 0.1}s`, cursor: 'pointer' }}
            onClick={() => navigate(card.path)}
          >
            <div className="stat-icon">
              <card.icon size={24} />
            </div>
            <div className="stat-content">
              <h3>{card.title}</h3>
              <div className="stat-value">{card.value}</div>
              <p className="stat-subtitle">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2>Getting Started</h2>
          <div className="getting-started">
            {[
              { step: 1, title: 'Add Servers', desc: 'Connect your servers via SSH to start monitoring', path: '/servers' },
              { step: 2, title: 'Chat with AI', desc: 'Ask questions about your infrastructure in natural language', path: '/chat' },
              { step: 3, title: 'Deploy & Monitor', desc: 'Deploy applications and set up alerts', path: '/deployments' },
            ].map(({ step, title, desc, path }) => (
              <div key={step} className="step" style={{ cursor: 'pointer' }} onClick={() => navigate(path)}>
                <div className="step-number">{step}</div>
                <div className="step-content">
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Features</h2>
          <div className="features-grid">
            {[
              { icon: Server, label: 'Server Management', path: '/servers' },
              { icon: Container, label: 'Docker Integration', path: '/containers' },
              { icon: Rocket, label: 'Automated Deployment', path: '/deployments' },
              { icon: AlertTriangle, label: 'Smart Alerts', path: '/alerts' },
            ].map(({ icon: Icon, label, path }) => (
              <div key={label} className="feature" onClick={() => navigate(path)}>
                <Icon size={20} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
