import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: '1rem',
          color: 'var(--text-secondary)', padding: '2rem',
        }}>
          <AlertTriangle size={48} style={{ color: 'var(--error)' }} />
          <h2 style={{ color: 'var(--text-primary)' }}>Something went wrong</h2>
          <p style={{ fontSize: '0.875rem', textAlign: 'center', maxWidth: '400px' }}>
            {this.state.error.message}
          </p>
          <button
            className="btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
