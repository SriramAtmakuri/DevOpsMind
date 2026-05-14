import { useState, useEffect } from 'react';
import { Server, Plus, Activity, X, RefreshCw, Trash2, Wifi } from 'lucide-react';
import api from '../api/axios';
import { toast } from '../store/toastStore';
import { useNavigate } from 'react-router-dom';
import './Servers.css';

const INIT_FORM = {
  name: '', hostname: '', ip_address: '', port: '22',
  username: '', auth_type: 'password', password: '', private_key: '',
  environment: 'production', tags: '',
};

function Servers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INIT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [checkLoading, setCheckLoading] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers');
      setServers(response.data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        port: parseInt(form.port) || 22,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      await api.post('/servers', payload);
      setShowModal(false);
      setForm(INIT_FORM);
      await fetchServers();
      toast.success('Server added successfully');
    } catch (error) {
      setFormError(error.response?.data?.error || 'Failed to add server');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serverId) => {
    if (!confirm('Delete this server? All associated data will be removed.')) return;
    try {
      await api.delete(`/servers/${serverId}`);
      setServers(prev => prev.filter(s => s.id !== serverId));
      toast.success('Server deleted');
    } catch (error) {
      toast.error('Failed to delete server');
    }
  };

  const handleCheckConnection = async (serverId) => {
    setCheckLoading(prev => ({ ...prev, [serverId]: true }));
    try {
      const res = await api.post(`/servers/${serverId}/check`);
      setServers(prev => prev.map(s =>
        s.id === serverId ? { ...s, status: res.data.status } : s
      ));
      toast[res.data.connected ? 'success' : 'warning'](
        res.data.connected ? 'Server is online' : 'Server is offline'
      );
    } catch {
      setServers(prev => prev.map(s =>
        s.id === serverId ? { ...s, status: 'offline' } : s
      ));
      toast.error('Connection check failed');
    } finally {
      setCheckLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'warning': return 'warning';
      default: return 'muted';
    }
  };

  const inputStyle = {
    padding: '0.5rem 0.75rem', borderRadius: '6px',
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box',
  };

  const labelStyle = { fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', display: 'block' };

  return (
    <div className="servers-page">
      <div className="page-header">
        <div>
          <h1>Servers</h1>
          <p>Manage and monitor your server infrastructure</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={fetchServers}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => { setShowModal(true); setFormError(''); }}>
            <Plus size={18} />
            Add Server
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading servers...</div>
      ) : servers.length === 0 ? (
        <div className="empty-state">
          <Server size={48} />
          <h3>No servers configured</h3>
          <p>Add your first server to start monitoring</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Add Server
          </button>
        </div>
      ) : (
        <div className="servers-grid">
          {servers.map((server, index) => (
            <div
              key={server.id}
              className="server-card fade-in"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="server-header">
                <div>
                  <h3>{server.name}</h3>
                  <p className="server-ip">{server.ip_address}:{server.port}</p>
                </div>
                <span className={`status-badge ${getStatusColor(server.status)}`}>
                  {server.status}
                </span>
              </div>

              <div className="server-info">
                <div className="info-item">
                  <span className="label">Environment</span>
                  <span className="value">{server.environment || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Auth</span>
                  <span className="value">{server.auth_type}</span>
                </div>
                <div className="info-item">
                  <span className="label">User</span>
                  <span className="value">{server.username}</span>
                </div>
                <div className="info-item">
                  <span className="label">Last Check</span>
                  <span className="value">
                    {server.last_check ? new Date(server.last_check).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>

              {server.tags && (() => {
                try {
                  const tags = typeof server.tags === 'string' ? JSON.parse(server.tags) : server.tags;
                  return tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', margin: '0.75rem 0' }}>
                      {tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                          background: 'var(--bg-tertiary)', borderRadius: '4px', color: 'var(--text-muted)',
                        }}>{tag}</span>
                      ))}
                    </div>
                  ) : null;
                } catch { return null; }
              })()}

              <div className="server-actions">
                <button
                  className="btn-small"
                  onClick={() => handleCheckConnection(server.id)}
                  disabled={checkLoading[server.id]}
                >
                  <Wifi size={16} />
                  {checkLoading[server.id] ? 'Checking...' : 'Check'}
                </button>
                <button className="btn-small" onClick={() => navigate('/metrics')}>
                  <Activity size={16} />
                  Metrics
                </button>
                <button
                  className="btn-small"
                  onClick={() => handleDelete(server.id)}
                  style={{ color: 'var(--error)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Server Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem',
              width: '90%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Add Server</h3>
              <button className="btn-small" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Server Name *</label>
                  <input style={inputStyle} required placeholder="Production Web" value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Environment</label>
                  <select style={inputStyle} value={form.environment}
                    onChange={(e) => setForm(p => ({ ...p, environment: e.target.value }))}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Hostname / IP Address *</label>
                  <input style={inputStyle} required placeholder="192.168.1.10 or server.example.com"
                    value={form.ip_address}
                    onChange={(e) => setForm(p => ({ ...p, ip_address: e.target.value, hostname: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input style={{ ...inputStyle, width: '80px' }} type="number" placeholder="22"
                    value={form.port}
                    onChange={(e) => setForm(p => ({ ...p, port: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>SSH Username *</label>
                <input style={inputStyle} required placeholder="ubuntu" value={form.username}
                  onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>Authentication Type</label>
                <select style={inputStyle} value={form.auth_type}
                  onChange={(e) => setForm(p => ({ ...p, auth_type: e.target.value }))}>
                  <option value="password">Password</option>
                  <option value="key">SSH Key</option>
                </select>
              </div>

              {form.auth_type === 'password' ? (
                <div>
                  <label style={labelStyle}>SSH Password *</label>
                  <input style={inputStyle} type="password" required placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Private Key *</label>
                  <textarea
                    style={{ ...inputStyle, height: '100px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem' }}
                    required placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    value={form.private_key}
                    onChange={(e) => setForm(p => ({ ...p, private_key: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Tags (comma-separated)</label>
                <input style={inputStyle} placeholder="web, nginx, production" value={form.tags}
                  onChange={(e) => setForm(p => ({ ...p, tags: e.target.value }))} />
              </div>

              {formError && (
                <div style={{ color: 'var(--error)', fontSize: '0.875rem', padding: '0.5rem 0.75rem',
                  background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: '0.25rem' }}>
                <Server size={16} />
                {saving ? 'Adding server...' : 'Add Server'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Servers;
