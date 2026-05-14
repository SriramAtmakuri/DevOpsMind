import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Server,
  Container,
  Rocket,
  AlertTriangle,
  Activity,
  FileText,
  LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import './Layout.css';

function Layout() {
  const { user, logout } = useAuthStore();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
    { to: '/servers', icon: Server, label: 'Servers' },
    { to: '/containers', icon: Container, label: 'Containers' },
    { to: '/deployments', icon: Rocket, label: 'Deployments' },
    { to: '/alerts', icon: AlertTriangle, label: 'Alerts' },
    { to: '/metrics', icon: Activity, label: 'Metrics' },
    { to: '/logs', icon: FileText, label: 'Logs' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>DevOpsMind</h1>
          <span className="beta-badge">AI</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
