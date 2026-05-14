import { useState, useEffect } from 'react';
import { FileText, Filter, Download, Search, AlertCircle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import './Logs.css';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterLevel, setFilterLevel] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await api.get('/logs?limit=100');
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const getLevelIcon = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return <AlertCircle size={16} color="var(--error)" />;
      case 'warning':
        return <AlertCircle size={16} color="var(--warning)" />;
      case 'info':
        return <Info size={16} color="var(--info)" />;
      case 'success':
        return <CheckCircle size={16} color="var(--success)" />;
      default:
        return <FileText size={16} color="var(--text-muted)" />;
    }
  };

  const getLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'success':
        return 'success';
      default:
        return 'muted';
    }
  };

  const filteredLogs = logs
    .filter(log => filterLevel === 'all' || log.log_level?.toLowerCase() === filterLevel)
    .filter(log => !searchTerm || log.message?.toLowerCase().includes(searchTerm.toLowerCase()) || log.source?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="logs-page">
      <div className="page-header">
        <div>
          <h1>System Logs</h1>
          <p>Real-time log monitoring and analysis ({filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'})</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="logs-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterLevel === 'all' ? 'active' : ''}`}
            onClick={() => setFilterLevel('all')}
          >
            All ({logs.length})
          </button>
          <button
            className={`filter-btn ${filterLevel === 'error' ? 'active' : ''}`}
            onClick={() => setFilterLevel('error')}
          >
            <AlertCircle size={14} />
            Errors ({logs.filter(l => l.log_level === 'error').length})
          </button>
          <button
            className={`filter-btn ${filterLevel === 'warning' ? 'active' : ''}`}
            onClick={() => setFilterLevel('warning')}
          >
            <AlertCircle size={14} />
            Warnings ({logs.filter(l => l.log_level === 'warning').length})
          </button>
          <button
            className={`filter-btn ${filterLevel === 'info' ? 'active' : ''}`}
            onClick={() => setFilterLevel('info')}
          >
            <Info size={14} />
            Info ({logs.filter(l => l.log_level === 'info').length})
          </button>
          <button
            className={`filter-btn ${filterLevel === 'debug' ? 'active' : ''}`}
            onClick={() => setFilterLevel('debug')}
          >
            <FileText size={14} />
            Debug ({logs.filter(l => l.log_level === 'debug').length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No logs found</h3>
          <p>{searchTerm || filterLevel !== 'all' ? 'Try adjusting your filters' : 'No logs available yet'}</p>
        </div>
      ) : (
        <div className="logs-container">
          <div className="logs-header">
            <div style={{ flex: '0 0 120px' }}>Time</div>
            <div style={{ flex: '0 0 80px' }}>Level</div>
            <div style={{ flex: '0 0 150px' }}>Source</div>
            <div style={{ flex: 1 }}>Message</div>
          </div>

          <div className="logs-list">
            {filteredLogs.map((log, index) => (
              <div key={log.id || index} className={`log-entry fade-in`} style={{ animationDelay: `${index * 0.02}s` }}>
                <div className="log-time">
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : 'N/A'}
                </div>
                <div className="log-level">
                  <span className={`status-badge ${getLevelColor(log.log_level)}`}>
                    {getLevelIcon(log.log_level)}
                    <span style={{ marginLeft: '4px' }}>
                      {log.log_level ? log.log_level.toUpperCase() : 'INFO'}
                    </span>
                  </span>
                </div>
                <div className="log-source">
                  {log.source || 'system'}
                </div>
                <div className="log-message">
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Logs;
