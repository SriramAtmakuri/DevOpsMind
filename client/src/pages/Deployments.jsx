import { useState, useEffect } from 'react';
import { Rocket, CheckCircle, XCircle, Clock, GitBranch, RefreshCw, Plus, X } from 'lucide-react';
import api from '../api/axios';
import { toast } from '../store/toastStore';
import './Servers.css';

function Deployments() {
  const [deployments, setDeployments] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [logsModal, setLogsModal] = useState(null);
  const [deployModal, setDeployModal] = useState(false);
  const [deployForm, setDeployForm] = useState({
    repositoryUrl: '', branch: 'main', serverId: '', environment: 'production', deploymentType: 'docker',
  });
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    fetchDeployments();
    fetchServers();
  }, []);

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/deployments');
      setDeployments(response.data);
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers');
      setServers(response.data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const handleViewLogs = (deployment) => {
    setLogsModal(deployment);
  };

  const handleRedeploy = async (deploymentId) => {
    if (!confirm('Redeploy from previous successful version?')) return;
    setActionLoading(prev => ({ ...prev, [deploymentId]: true }));
    try {
      const response = await api.post(`/deployments/${deploymentId}/rollback`);
      if (response.data.success) {
        await fetchDeployments();
        toast.success('Rollback initiated successfully');
      }
    } catch (error) {
      toast.error('Rollback failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [deploymentId]: false }));
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    setDeploying(true);
    try {
      await api.post('/deployments/deploy', deployForm);
      setDeployModal(false);
      setDeployForm({ repositoryUrl: '', branch: 'main', serverId: '', environment: 'production', deploymentType: 'docker' });
      await fetchDeployments();
      toast.success('Deployment started');
    } catch (error) {
      toast.error('Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'success': return <CheckCircle size={18} style={{ color: 'var(--success)' }} />;
      case 'failed': return <XCircle size={18} style={{ color: 'var(--error)' }} />;
      case 'in_progress': return <Clock size={18} style={{ color: 'var(--warning)' }} />;
      default: return <Clock size={18} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'in_progress': return 'warning';
      default: return 'muted';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="servers-page">
      <div className="page-header">
        <div>
          <h1>Deployments</h1>
          <p>View and manage application deployments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={fetchDeployments}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setDeployModal(true)}>
            <Plus size={18} />
            New Deployment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading deployments...</div>
      ) : deployments.length === 0 ? (
        <div className="empty-state">
          <Rocket size={48} />
          <h3>No deployments yet</h3>
          <p>Create your first deployment to get started</p>
          <button className="btn-primary" onClick={() => setDeployModal(true)}>
            <Plus size={18} />
            New Deployment
          </button>
        </div>
      ) : (
        <div className="servers-grid">
          {deployments.map((deployment, index) => (
            <div
              key={deployment.id}
              className="server-card scale-in"
              style={{ animationDelay: `${index * 0.09}s` }}
            >
              <div className="server-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getStatusIcon(deployment.status)}
                  <div>
                    <h3>#{deployment.id} — {deployment.environment || 'N/A'}</h3>
                    <p className="server-ip">{deployment.server_name || `Server ${deployment.server_id}`}</p>
                  </div>
                </div>
                <span className={`status-badge ${getStatusColor(deployment.status)}`}>
                  {deployment.status}
                </span>
              </div>

              <div className="server-info">
                <div className="info-item">
                  <span className="label">Repository</span>
                  <span className="value" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {deployment.repository_url ? deployment.repository_url.split('/').pop() : 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Branch</span>
                  <span className="value">
                    <GitBranch size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    {deployment.branch || 'main'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Commit</span>
                  <span className="value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {deployment.commit_hash ? deployment.commit_hash.slice(0, 7) : 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Duration</span>
                  <span className="value">{formatDuration(deployment.duration)}</span>
                </div>
                <div className="info-item">
                  <span className="label">By</span>
                  <span className="value">{deployment.username || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Started</span>
                  <span className="value" style={{ fontSize: '0.75rem' }}>
                    {deployment.started_at ? new Date(deployment.started_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {deployment.commit_message && (
                <div style={{
                  marginTop: '0.75rem', padding: '0.75rem',
                  backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px',
                  fontSize: '0.75rem', color: 'var(--text-secondary)',
                }}>
                  <strong>Commit:</strong> {deployment.commit_message}
                </div>
              )}

              {deployment.error_message && (
                <div style={{
                  marginTop: '0.75rem', padding: '0.75rem',
                  backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px',
                  fontSize: '0.75rem', color: 'var(--error)',
                }}>
                  <strong>Error:</strong> {deployment.error_message}
                </div>
              )}

              <div className="server-actions" style={{ marginTop: '1rem' }}>
                {deployment.build_log && (
                  <button className="btn-small" onClick={() => handleViewLogs(deployment)}>
                    View Logs
                  </button>
                )}
                <button
                  className="btn-small"
                  onClick={() => handleRedeploy(deployment.id)}
                  disabled={actionLoading[deployment.id]}
                >
                  <Rocket size={14} />
                  {actionLoading[deployment.id] ? 'Rolling back...' : 'Rollback'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Build Logs Modal */}
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
              <h3>Build Logs — Deployment #{logsModal.id}</h3>
              <button className="btn-small" onClick={() => setLogsModal(null)}>
                <X size={16} /> Close
              </button>
            </div>
            <pre style={{
              flex: 1, overflow: 'auto', background: 'var(--bg-primary)', padding: '1rem',
              borderRadius: '8px', fontSize: '0.75rem', fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)',
            }}>
              {logsModal.build_log || 'No build logs available'}
            </pre>
          </div>
        </div>
      )}

      {/* New Deployment Modal */}
      {deployModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setDeployModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem',
              width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>New Deployment</h3>
              <button className="btn-small" onClick={() => setDeployModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleDeploy} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Repository URL', key: 'repositoryUrl', placeholder: 'https://github.com/user/repo', required: true },
                { label: 'Branch', key: 'branch', placeholder: 'main' },
              ].map(({ label, key, placeholder, required }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</label>
                  <input
                    type="text"
                    value={deployForm[key]}
                    onChange={(e) => setDeployForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required={required}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.875rem',
                    }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Server</label>
                <select
                  value={deployForm.serverId}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, serverId: e.target.value }))}
                  required
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontSize: '0.875rem',
                  }}
                >
                  <option value="">Select server...</option>
                  {servers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Environment</label>
                  <select
                    value={deployForm.environment}
                    onChange={(e) => setDeployForm(prev => ({ ...prev, environment: e.target.value }))}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.875rem',
                    }}
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Type</label>
                  <select
                    value={deployForm.deploymentType}
                    onChange={(e) => setDeployForm(prev => ({ ...prev, deploymentType: e.target.value }))}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.875rem',
                    }}
                  >
                    <option value="docker">Docker</option>
                    <option value="direct">Direct</option>
                    <option value="kubernetes">Kubernetes</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={deploying} style={{ marginTop: '0.5rem' }}>
                <Rocket size={16} />
                {deploying ? 'Deploying...' : 'Deploy'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Deployments;
