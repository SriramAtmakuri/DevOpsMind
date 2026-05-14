import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Bell, BellOff, CheckCircle, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';
import { toast } from '../store/toastStore';
import './Servers.css';

const INIT_RULE = {
  serverId: '', ruleName: '', metricType: 'cpu',
  condition: 'greater_than', threshold: 80, severity: 'warning',
};

const inputStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '6px',
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box',
};
const labelStyle = { fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', display: 'block' };

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [actionLoading, setActionLoading] = useState({});
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [servers, setServers] = useState([]);
  const [ruleForm, setRuleForm] = useState(INIT_RULE);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState('');

  useEffect(() => { fetchAlerts(); }, [statusFilter]);
  useEffect(() => { fetchServers(); }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/alerts?status=${statusFilter}`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const res = await api.get('/servers');
      setServers(res.data);
    } catch { /* non-critical */ }
  };

  const handleAcknowledge = async (alertId) => {
    setActionLoading(prev => ({ ...prev, [alertId]: 'ack' }));
    try {
      await api.post(`/alerts/${alertId}/acknowledge`);
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged' } : a
      ));
      toast.success('Alert acknowledged');
    } catch {
      toast.error('Failed to acknowledge alert');
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: null }));
    }
  };

  const handleResolve = async (alertId) => {
    setActionLoading(prev => ({ ...prev, [alertId]: 'resolve' }));
    try {
      await api.post(`/alerts/${alertId}/resolve`);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert resolved');
    } catch {
      toast.error('Failed to resolve alert');
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: null }));
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.serverId) {
      setRuleError('Please select a server');
      return;
    }
    setRuleError('');
    setSavingRule(true);
    try {
      await api.post('/alerts/rules', {
        serverId: parseInt(ruleForm.serverId),
        ruleName: ruleForm.ruleName,
        metricType: ruleForm.metricType,
        condition: ruleForm.condition,
        threshold: parseFloat(ruleForm.threshold),
        severity: ruleForm.severity,
      });
      setShowRuleModal(false);
      setRuleForm(INIT_RULE);
      toast.success('Alert rule created');
    } catch (error) {
      setRuleError(error.response?.data?.error || 'Failed to create rule');
    } finally {
      setSavingRule(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'muted';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <AlertTriangle size={18} />;
      case 'warning': return <Bell size={18} />;
      default: return <BellOff size={18} />;
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'N/A';
    const diffMs = Date.now() - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="servers-page">
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <p>Monitor and manage system alerts</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.875rem',
            }}
          >
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <button className="btn-secondary" onClick={fetchAlerts}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => { setShowRuleModal(true); setRuleError(''); }}>
            <Plus size={16} />
            Create Rule
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={48} style={{ color: 'var(--success)' }} />
          <h3>No {statusFilter} alerts</h3>
          <p>{statusFilter === 'active' ? 'All systems are operating normally' : `No ${statusFilter} alerts found`}</p>
        </div>
      ) : (
        <div className="servers-grid">
          {alerts.map((alert, index) => (
            <div
              key={alert.id}
              className="server-card slide-in-left"
              style={{ animationDelay: `${index * 0.07}s` }}
            >
              <div className="server-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`status-badge ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </span>
                  <div>
                    <h3 style={{ marginBottom: '0.25rem' }}>{alert.alert_type?.toUpperCase() || 'ALERT'}</h3>
                    <p className="server-ip">{alert.server_name || 'Unknown server'}</p>
                  </div>
                </div>
                <span className={`status-badge ${alert.status === 'active' ? 'error' : alert.status === 'acknowledged' ? 'warning' : 'success'}`}>
                  {alert.status}
                </span>
              </div>

              <div style={{
                margin: '1rem 0', padding: '0.75rem',
                backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px',
                fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.5',
              }}>
                {alert.message}
              </div>

              <div className="server-info">
                <div className="info-item">
                  <span className="label">Threshold</span>
                  <span className="value">{alert.threshold_value ?? 'N/A'}%</span>
                </div>
                <div className="info-item">
                  <span className="label">Current</span>
                  <span className="value" style={{
                    color: alert.current_value > alert.threshold_value ? 'var(--error)' : 'var(--success)',
                  }}>
                    {alert.current_value ?? 'N/A'}%
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Triggered</span>
                  <span className="value">{formatTimeAgo(alert.triggered_at)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Severity</span>
                  <span className={`status-badge ${getSeverityColor(alert.severity)}`} style={{ fontSize: '0.7rem' }}>
                    {alert.severity?.toUpperCase()}
                  </span>
                </div>
              </div>

              {alert.status === 'active' && (
                <div className="server-actions" style={{ marginTop: '1rem' }}>
                  <button
                    className="btn-small"
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={actionLoading[alert.id] === 'ack'}
                  >
                    <Bell size={16} />
                    {actionLoading[alert.id] === 'ack' ? 'Acknowledging...' : 'Acknowledge'}
                  </button>
                  <button
                    className="btn-small"
                    onClick={() => handleResolve(alert.id)}
                    disabled={actionLoading[alert.id] === 'resolve'}
                  >
                    <CheckCircle size={16} />
                    {actionLoading[alert.id] === 'resolve' ? 'Resolving...' : 'Resolve'}
                  </button>
                </div>
              )}
              {alert.status === 'acknowledged' && (
                <div className="server-actions" style={{ marginTop: '1rem' }}>
                  <button
                    className="btn-small"
                    onClick={() => handleResolve(alert.id)}
                    disabled={actionLoading[alert.id] === 'resolve'}
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={16} />
                    {actionLoading[alert.id] === 'resolve' ? 'Resolving...' : 'Mark Resolved'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Alert Rule Modal */}
      {showRuleModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowRuleModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem',
              width: '90%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Create Alert Rule</h3>
              <button className="btn-small" onClick={() => setShowRuleModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={labelStyle}>Server *</label>
                <select
                  style={inputStyle}
                  value={ruleForm.serverId}
                  onChange={(e) => setRuleForm(p => ({ ...p, serverId: e.target.value }))}
                  required
                >
                  <option value="">Select server...</option>
                  {servers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Rule Name *</label>
                <input
                  style={inputStyle}
                  required
                  placeholder="High CPU Alert"
                  value={ruleForm.ruleName}
                  onChange={(e) => setRuleForm(p => ({ ...p, ruleName: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Metric</label>
                  <select
                    style={inputStyle}
                    value={ruleForm.metricType}
                    onChange={(e) => setRuleForm(p => ({ ...p, metricType: e.target.value }))}
                  >
                    <option value="cpu">CPU</option>
                    <option value="memory">Memory</option>
                    <option value="disk">Disk</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Condition</label>
                  <select
                    style={inputStyle}
                    value={ruleForm.condition}
                    onChange={(e) => setRuleForm(p => ({ ...p, condition: e.target.value }))}
                  >
                    <option value="greater_than">Greater than</option>
                    <option value="less_than">Less than</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Threshold (%)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm(p => ({ ...p, threshold: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Severity</label>
                  <select
                    style={inputStyle}
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm(p => ({ ...p, severity: e.target.value }))}
                  >
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              {ruleError && (
                <div style={{
                  color: 'var(--error)', fontSize: '0.875rem', padding: '0.5rem 0.75rem',
                  background: 'rgba(239,68,68,0.1)', borderRadius: '6px',
                }}>
                  {ruleError}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={savingRule} style={{ marginTop: '0.25rem' }}>
                <Bell size={16} />
                {savingRule ? 'Creating...' : 'Create Rule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Alerts;
