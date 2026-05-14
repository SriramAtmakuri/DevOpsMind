import { useState, useEffect } from 'react';
import { Container, Play, Square, RotateCw, Trash2, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { toast } from '../store/toastStore';
import './Servers.css';

function Containers() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [logsModal, setLogsModal] = useState(null);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/containers');
      setContainers(response.data);
    } catch (error) {
      console.error('Failed to fetch containers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (containerId, action) => {
    setActionLoading(prev => ({ ...prev, [containerId]: action }));
    try {
      await api.post(`/containers/${containerId}/${action}`);
      const statusMap = { start: 'running', stop: 'stopped', restart: 'running' };
      setContainers(prev => prev.map(c =>
        c.container_id === containerId ? { ...c, status: statusMap[action] } : c
      ));
      toast.success(`Container ${action}ed`);
    } catch (error) {
      toast.error(`Failed to ${action} container`);
    } finally {
      setActionLoading(prev => ({ ...prev, [containerId]: null }));
    }
  };

  const handleRemove = async (containerId) => {
    if (!confirm('Remove this container? This cannot be undone.')) return;
    setActionLoading(prev => ({ ...prev, [containerId]: 'remove' }));
    try {
      await api.delete(`/containers/${containerId}`);
      setContainers(prev => prev.filter(c => c.container_id !== containerId));
      toast.success('Container removed');
    } catch (error) {
      toast.error('Failed to remove container');
    } finally {
      setActionLoading(prev => ({ ...prev, [containerId]: null }));
    }
  };

  const handleViewLogs = async (container) => {
    setLogsModal({ container, logs: 'Loading...', loading: true });
    try {
      const response = await api.get(`/containers/${container.container_id}/logs?tail=100`);
      setLogsModal({ container, logs: response.data.logs || 'No logs available', loading: false });
    } catch (error) {
      setLogsModal({ container, logs: `Error: ${error.response?.data?.error || error.message}`, loading: false });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return 'success';
      case 'stopped': case 'exited': return 'error';
      case 'paused': return 'warning';
      default: return 'muted';
    }
  };

  return (
    <div className="servers-page">
      <div className="page-header">
        <div>
          <h1>Containers</h1>
          <p>Manage Docker containers across your infrastructure</p>
        </div>
        <button className="btn-secondary" onClick={fetchContainers}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading containers...</div>
      ) : containers.length === 0 ? (
        <div className="empty-state">
          <Container size={48} />
          <h3>No containers found</h3>
          <p>Deploy your first container to get started</p>
        </div>
      ) : (
        <div className="servers-grid">
          {containers.map((container, index) => {
            const busy = actionLoading[container.container_id];
            const isRunning = container.status?.toLowerCase() === 'running';
            return (
              <div
                key={container.id}
                className="server-card slide-in-right"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="server-header">
                  <div>
                    <h3>{container.name}</h3>
                    <p className="server-ip">{container.image || 'N/A'}</p>
                  </div>
                  <span className={`status-badge ${getStatusColor(container.status)}`}>
                    {container.status || 'unknown'}
                  </span>
                </div>

                <div className="server-info">
                  <div className="info-item">
                    <span className="label">Container ID</span>
                    <span className="value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {container.container_id ? container.container_id.slice(0, 12) : 'N/A'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Ports</span>
                    <span className="value" style={{ fontSize: '0.75rem' }}>
                      {container.ports && typeof container.ports === 'string'
                        ? (() => {
                            try {
                              const ports = JSON.parse(container.ports);
                              return ports.length > 0
                                ? ports.map(p => `${p.host}:${p.container}`).join(', ')
                                : 'None';
                            } catch { return 'None'; }
                          })()
                        : 'None'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Created</span>
                    <span className="value">
                      {container.created_at ? new Date(container.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="server-actions" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                  {!isRunning ? (
                    <button
                      className="btn-small"
                      onClick={() => handleAction(container.container_id, 'start')}
                      disabled={!!busy}
                    >
                      <Play size={14} />
                      {busy === 'start' ? '...' : 'Start'}
                    </button>
                  ) : (
                    <button
                      className="btn-small"
                      onClick={() => handleAction(container.container_id, 'stop')}
                      disabled={!!busy}
                    >
                      <Square size={14} />
                      {busy === 'stop' ? '...' : 'Stop'}
                    </button>
                  )}
                  <button
                    className="btn-small"
                    onClick={() => handleAction(container.container_id, 'restart')}
                    disabled={!!busy}
                  >
                    <RotateCw size={14} />
                    {busy === 'restart' ? '...' : 'Restart'}
                  </button>
                  <button
                    className="btn-small"
                    onClick={() => handleViewLogs(container)}
                    disabled={!!busy}
                  >
                    Logs
                  </button>
                  <button
                    className="btn-small"
                    onClick={() => handleRemove(container.container_id)}
                    disabled={!!busy}
                    style={{ color: 'var(--error)' }}
                  >
                    <Trash2 size={14} />
                    {busy === 'remove' ? '...' : 'Remove'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logsModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setLogsModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem',
              width: '90%', maxWidth: '800px', maxHeight: '80vh', display: 'flex',
              flexDirection: 'column', gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Logs — {logsModal.container.name}</h3>
              <button className="btn-small" onClick={() => setLogsModal(null)}>Close</button>
            </div>
            <pre style={{
              flex: 1, overflow: 'auto', background: 'var(--bg-primary)', padding: '1rem',
              borderRadius: '8px', fontSize: '0.75rem', fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)',
            }}>
              {logsModal.loading ? 'Loading...' : logsModal.logs}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default Containers;
