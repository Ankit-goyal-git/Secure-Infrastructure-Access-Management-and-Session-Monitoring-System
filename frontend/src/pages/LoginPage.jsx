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
  const [authMode, setAuthMode] = useState('otp'); // 'otp' | 'password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP flow states
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'verify'
  const [otpCode, setOtpCode] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuickRole, setActiveQuickRole] = useState(null);
  const navigate = useNavigate();

  // 1-Click demo role switcher is disabled by default for production security.
  const isDemoEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  const routeUser = (user) => {
    if (user.role === 'admin') {
      navigate('/admin');
    } else if (user.role === 'manager') {
      navigate('/manager');
    } else {
      navigate('/employee');
    }
  };

  // Standard Password Login
  const executePasswordLogin = async (loginEmail, loginPassword) => {
    setError('');
    setIsLoading(true);

    try {
      const { token, user } = await authService.login(loginEmail, loginPassword);
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      routeUser(user);
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

  // Step 1: Send Login OTP via Gmail
  const handleSendLoginOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await authService.sendLoginOtp(email);
      setOtpNotice(res.message || `Security code sent to ${email}`);
      if (res.devOtp) setDevOtp(res.devOtp);
      setOtpStep('verify');
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to send verification code. Please check your email.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Login OTP
  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit security code.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { token, user } = await authService.verifyLoginOtp(email, otpCode.trim());
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      routeUser(user);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Verification failed. Invalid or expired code.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSign = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setActiveQuickRole(acc.role);
    executePasswordLogin(acc.email, acc.password);
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
          <h1 className="text-2xl font-bold tracking-tight text-white">PAM Security Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Zero-Trust Infrastructure Access Gateway</p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-start gap-2.5 animate-fadeIn">
            <span className="text-base leading-none">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Auth Mode Toggle */}
        <div className="flex rounded-xl bg-slate-950/70 p-1 mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setAuthMode('otp');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'otp'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📧</span>
            <span>Gmail OTP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'password'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔑</span>
            <span>Password</span>
          </button>
        </div>

        {/* MODE 1: GMAIL OTP LOGIN */}
        {authMode === 'otp' && (
          <>
            {otpStep === 'email' ? (
              <form onSubmit={handleSendLoginOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Work / Gmail Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    We will send a 6-digit one-time passkey directly to your inbox.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Sending Passkey...</span>
                    </>
                  ) : (
                    <span>Send Verification Code 📧</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
                  <p className="font-semibold">{otpNotice}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sent to <strong>{email}</strong>
                  </p>
                </div>

                {devOtp && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono">
                    ⚡ Dev Code: <strong>{devOtp}</strong>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider text-center">
                    Enter 6-Digit Passkey
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-950 border border-blue-500/50 rounded-xl text-2xl font-mono text-center tracking-[0.4em] text-cyan-300 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <span className="text-[11px] text-slate-500 text-center block mt-1.5">
                    Valid for 10 minutes.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify Code & Sign In 🔐</span>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleSendLoginOtp}
                    disabled={isLoading}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('email');
                      setOtpCode('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition"
                  >
                    Change Email
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* MODE 2: STANDARD PASSWORD LOGIN */}
        {authMode === 'password' && (
          <form onSubmit={(e) => { e.preventDefault(); executePasswordLogin(email, password); }} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Work / Gmail Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs focus:outline-none"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In with Password 🔑</span>
              )}
            </button>
          </form>
        )}

        {/* 1-Click Demo Accounts (Only visible when VITE_ENABLE_DEMO_LOGIN=true) */}
        {isDemoEnabled && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                1-Click Demo Roles
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                DEV ONLY
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickSign(acc)}
                  className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer hover:bg-slate-800/80 ${
                    activeQuickRole === acc.role
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <span className="text-base">{acc.icon}</span>
                  <span className="text-[11px] font-semibold text-slate-200">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          Need a new PAM account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition">
            Create account with Gmail OTP
          </Link>
        </div>
      </div>
    </div>
  );
}
