import { useToastStore } from '../store/toastStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const COLORS = {
  success: 'var(--success)',
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
};

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            border: `1px solid ${COLORS[t.type]}`,
            borderLeft: `4px solid ${COLORS[t.type]}`,
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            maxWidth: '360px',
            pointerEvents: 'all',
            animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <span style={{ color: COLORS[t.type], flexShrink: 0 }}>{ICONS[t.type]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', flexShrink: 0, padding: '0.1rem',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
