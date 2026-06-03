import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Activity, Wifi, WifiOff, BarChart3, Settings,
} from 'lucide-react';
import { useAuditContext } from '../context/AuditContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  matchPaths: string[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, matchPaths: ['/'] },
  { to: '/audits', label: 'Audit History', icon: Activity, matchPaths: ['/audits'] },
  { to: '/stats', label: 'Statistics', icon: BarChart3, matchPaths: ['/stats'] },
  { to: '/settings', label: 'Settings', icon: Settings, matchPaths: ['/settings'] },
];

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const { isConnected } = useAuditContext();

  const isActive = (item: NavItem) => {
    if (item.to === '/') return location.pathname === '/';
    return item.matchPaths.some((p) => location.pathname.startsWith(p));
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Sidebar ── */}
      <aside
        className="fixed top-0 left-0 h-screen flex flex-col glass-strong z-30"
        style={{ width: 'var(--sidebar-width)' }}
      >
        {/* Logo */}
        <div className="px-6 pt-7 pb-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Shield size={20} className="text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{
                  borderColor: 'var(--bg-primary)',
                  background: isConnected ? 'var(--success)' : 'var(--danger)',
                }}
              />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Src-Audit
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: 'var(--text-tertiary)' }}>
                AI Code Audit
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-muted)' }}>
            Navigation
          </p>
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? 'var(--accent-glow)' : 'transparent',
                  color: active ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="px-4 py-4 mx-3 mb-4 rounded-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            {isConnected ? (
              <Wifi size={14} style={{ color: 'var(--success)' }} />
            ) : (
              <WifiOff size={14} style={{ color: 'var(--danger)' }} />
            )}
            <span className="text-xs font-semibold"
              style={{ color: isConnected ? 'var(--success)' : 'var(--danger)' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Real-time audit updates
          </p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        className="flex-1 min-h-screen"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
