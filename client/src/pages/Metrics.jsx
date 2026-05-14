import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { Activity, Cpu, HardDrive, TrendingUp, RefreshCw, Server } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/axios';
import './Servers.css';

const METRIC_LINES = [
  { key: 'cpu_usage',    label: 'CPU %',    color: '#6366f1' },
  { key: 'memory_usage', label: 'Memory %', color: '#8b5cf6' },
  { key: 'disk_usage',   label: 'Disk %',   color: '#3b82f6' },
];

function MetricBadge({ value }) {
  const color = value > 80 ? 'var(--error)' : value > 60 ? 'var(--warning)' : 'var(--success)';
  return (
    <span style={{
      fontSize: '0.8rem', fontWeight: 600, color,
      background: `${color}22`, padding: '0.2rem 0.5rem', borderRadius: '4px',
    }}>
      {value?.toFixed(1)}%
    </span>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.8rem',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function Metrics() {
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hours, setHours] = useState(24);

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get('/servers');
      const withMetrics = await Promise.all(
        res.data.map(async (s) => {
          try {
            const m = await api.get(`/servers/${s.id}/metrics`);
            return { ...s, metrics: m.data };
          } catch { return { ...s, metrics: null }; }
        })
      );
      setServers(withMetrics);
      if (!selected && withMetrics.length > 0) {
        setSelected(withMetrics[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selected]);

  const fetchHistory = useCallback(async (serverId, h) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/servers/${serverId}/metrics/history?hours=${h}`);
      const formatted = res.data.map((r) => ({
        ...r,
        time: format(new Date(r.timestamp), 'HH:mm'),
        cpu_usage: parseFloat(r.cpu_usage?.toFixed(1)),
        memory_usage: parseFloat(r.memory_usage?.toFixed(1)),
        disk_usage: parseFloat(r.disk_usage?.toFixed(1)),
      }));
      setHistory(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchServers().finally(() => setLoadingServers(false));
    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, [fetchServers]);

  useEffect(() => {
    if (selected) fetchHistory(selected.id, hours);
  }, [selected, hours, fetchHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServers();
    if (selected) await fetchHistory(selected.id, hours);
    setRefreshing(false);
  };

  const getStatusColor = (v) => v > 80 ? 'error' : v > 60 ? 'warning' : 'success';

  if (loadingServers) return <div className="loading-state" style={{ height: '100%' }}>Loading metrics...</div>;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: '0' }}>

      {/* Server list — left panel */}
      <div style={{
        width: '260px', flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)',
      }}>
        <div style={{
          padding: '1rem', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Servers</h2>
          <button
            className="btn-small"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {servers.map((server) => {
            const m = server.metrics;
            const isSelected = selected?.id === server.id;
            return (
              <div
                key={server.id}
                onClick={() => setSelected(server)}
                style={{
                  padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.4rem',
                  background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {server.name}
                  </span>
                  <span className={`status-badge ${server.status === 'online' ? 'success' : 'error'}`} style={{ fontSize: '0.65rem' }}>
                    {server.status}
                  </span>
                </div>
                {m && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      CPU <MetricBadge value={m.cpu_usage} />
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      MEM <MetricBadge value={m.memory_usage} />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel — right */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <Server size={48} />
            <h3>Select a server</h3>
            <p>Choose a server from the list to view metrics</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-secondary)',
            }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{selected.name}</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selected.ip_address} · {selected.environment}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  style={{
                    padding: '0.4rem 0.6rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontSize: '0.8rem',
                  }}
                >
                  <option value={1}>Last 1h</option>
                  <option value={6}>Last 6h</option>
                  <option value={24}>Last 24h</option>
                </select>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Current metrics summary */}
              {selected.metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: 'CPU Usage', value: selected.metrics.cpu_usage, icon: <Cpu size={20} color="var(--primary)" /> },
                    { label: 'Memory', value: selected.metrics.memory_usage, icon: <HardDrive size={20} color="var(--secondary)" /> },
                    { label: 'Disk', value: selected.metrics.disk_usage, icon: <Activity size={20} color="var(--info)" /> },
                    { label: 'Load Avg', value: null, raw: selected.metrics.load_average?.toFixed(2), icon: <TrendingUp size={20} color="var(--warning)" /> },
                  ].map(({ label, value, raw, icon }) => (
                    <div key={label} style={{
                      background: 'var(--bg-secondary)', borderRadius: '10px', padding: '1rem',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {icon}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
                      </div>
                      {value != null ? (
                        <>
                          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            {value?.toFixed(1)}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>%</span>
                          </div>
                          <div style={{
                            width: '100%', height: '6px', background: 'var(--bg-tertiary)',
                            borderRadius: '3px', overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.min(value, 100)}%`, height: '100%',
                              background: `var(--${getStatusColor(value)})`,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {raw ?? 'N/A'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Charts */}
              {loadingHistory ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No history data available yet
                </div>
              ) : (
                <>
                  {/* Combined area chart */}
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '1.25rem', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Resource Usage — Last {hours}h
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          {METRIC_LINES.map(({ key, color }) => (
                            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} />
                        {METRIC_LINES.map(({ key, label, color }) => (
                          <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={label}
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#grad-${key})`}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Individual line charts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    {METRIC_LINES.map(({ key, label, color }) => (
                      <div key={key} style={{
                        background: 'var(--bg-secondary)', borderRadius: '10px',
                        padding: '1rem', border: '1px solid var(--border)',
                      }}>
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{label}</h4>
                        <ResponsiveContainer width="100%" height={100}>
                          <LineChart data={history} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                              type="monotone"
                              dataKey={key}
                              name={label}
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
