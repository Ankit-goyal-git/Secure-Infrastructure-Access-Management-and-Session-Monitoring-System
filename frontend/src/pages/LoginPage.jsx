import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

const DEMO_ACCOUNTS = [
  {
    role: 'Employee',
    name: 'Rahul (DevOps)',
    email: 'rahul@example.com',
    password: 'rahulPass123!',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: '👤',
    destination: '/employee',
  },
  {
    role: 'Manager',
    name: 'Bob (Lead)',
    email: 'boss@example.com',
    password: 'bobManager789$',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: '🛡️',
    destination: '/manager',
  },
  {
    role: 'Admin',
    name: 'Alice (SecOps)',
    email: 'admin@example.com',
    password: 'adminMaster999@',
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: '⚙️',
    destination: '/admin',
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuickRole, setActiveQuickRole] = useState(null);
  const navigate = useNavigate();

  // 1-Click demo switcher is enabled in development or when explicitly configured via VITE_ENABLE_DEMO_LOGIN=true
  const isDemoEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  const executeLogin = async (loginEmail, loginPassword) => {
    setError('');
    setIsLoading(true);

    try {
      const { token, user } = await authService.login(loginEmail, loginPassword);
      
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'manager') {
        navigate('/manager');
      } else {
        navigate('/employee');
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Authentication failed. Please verify credentials.'
      );
    } finally {
      setIsLoading(false);
      setActiveQuickRole(null);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeLogin(email, password);
  };

  const handleQuickSign = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setActiveQuickRole(acc.role);
    executeLogin(acc.email, acc.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 font-sans relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[450px] h-[300px] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-slate-700/80 relative z-10">
        {/* Header Branding */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-3 shadow-inner">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Zero-Trust Bastion</h2>
          <p className="text-slate-400 mt-1 text-xs">
            Ephemeral Just-In-Time Access & Session Gateway
          </p>
        </div>

        {/* 1-Click Demo Role Switcher Bar (Automatically disabled in production builds) */}
        {isDemoEnabled && (
          <>
            <div className="mb-6 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>⚡</span>
                  <span>1-Click Demo Login (Dev Mode)</span>
                </span>
                <span className="text-[10px] text-slate-500">Auto-routes to role</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = activeQuickRole === acc.role;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleQuickSign(acc)}
                      disabled={isLoading}
                      className={`p-2 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer group hover:scale-[1.02] ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                          : 'bg-slate-900/90 hover:bg-slate-850 border-slate-750 hover:border-slate-600'
                      }`}
                      title={`Sign in instantly as ${acc.name} (${acc.role})`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">{acc.icon}</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono font-semibold uppercase ${acc.badge}`}
                        >
                          {acc.role}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <div className="text-[11px] font-bold text-white group-hover:text-blue-300 truncate">
                          {acc.name.split(' ')[0]}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate font-mono">
                          {acc.email.split('@')[0]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                or enter credentials
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>
          </>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-3 mb-5 text-xs font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Standard Credentials Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition focus:outline-none cursor-pointer"
                tabIndex="-1"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-blue-600/30 text-sm cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading && <span className="animate-spin text-sm">↻</span>}
            <span>{isLoading ? 'Authenticating...' : 'Sign In with Password'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs">
          <Link
            to="/register"
            className="text-slate-400 hover:text-blue-400 transition"
          >
            Need an employee account? <span className="underline">Register here</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
