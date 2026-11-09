import React, { useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
      return {};
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const role = user.role || 'employee';

  const roleBadgeStyle = useMemo(() => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'manager':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  }, [role]);

  const navLinks = useMemo(() => {
    const links = [];

    if (role === 'admin') {
      links.push(
        { path: '/admin', label: 'Admin Console', icon: '⚙️' },
        { path: '/manager', label: 'Manager Portal', icon: '🛡️' },
        { path: '/audit', label: 'Audit Logs', icon: '📋' },
        { path: '/employee', label: 'Employee View', icon: '👤' }
      );
    } else if (role === 'manager') {
      links.push(
        { path: '/manager', label: 'Manager Portal', icon: '🛡️' },
        { path: '/audit', label: 'Audit Logs', icon: '📋' },
        { path: '/employee', label: 'Employee Portal', icon: '👤' }
      );
    } else {
      links.push(
        { path: '/employee', label: 'My JIT Access', icon: '👤' }
      );
    }

    return links;
  }, [role]);

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-750 sticky top-0 z-40 px-6 py-3.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & System Status */}
        <div className="flex items-center gap-3">
          <Link
            to={role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/employee'}
            className="flex items-center gap-2.5 text-white hover:text-blue-400 transition"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-base shadow-inner">
              🔒
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-tight">
                Zero-Trust Bastion
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Port 2222 • PAM Gateway
              </span>
            </div>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Gateway Active
          </span>
        </div>

        {/* Dynamic Role Navigation Links */}
        <nav className="flex items-center gap-1.5 flex-wrap">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Identity & Logout Action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-bold text-white leading-tight">
                {user.name || 'User'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${roleBadgeStyle}`}
              >
                {role}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {user.email || 'user@example.com'}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
            title="Sign out of your session"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
