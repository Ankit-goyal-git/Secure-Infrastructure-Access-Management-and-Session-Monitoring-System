import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-700' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: 'Weak', color: 'bg-red-500', text: 'text-red-400' };
      case 2:
        return { score: 50, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' };
      case 3:
        return { score: 75, label: 'Good', color: 'bg-blue-500', text: 'text-blue-400' };
      case 4:
        return { score: 100, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-400' };
      default:
        return { score: 10, label: 'Too short', color: 'bg-red-500', text: 'text-red-400' };
    }
  }, [password]);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.register(name, email, password);

      if (response?.token && response?.user) {
        localStorage.setItem('jwt_token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));

        if (response.user.role === 'manager') {
          navigate('/manager');
        } else {
          navigate('/employee');
        }
      } else {
        setSuccess('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Registration failed. Please check your information and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 font-sans relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[480px] h-[320px] bg-purple-600/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-slate-700/80 relative z-10">
        {/* Header Branding */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-3 shadow-inner">
            <span className="text-2xl">🛡️</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create JIT Account</h2>
          <p className="text-slate-400 mt-1 text-xs">
            Zero-Trust Bastion Ephemeral Infrastructure Onboarding
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl p-3 mb-5 text-xs font-medium flex items-start gap-2">
            <span className="shrink-0 text-sm">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded-xl p-3 mb-5 text-xs font-medium flex items-start gap-2">
            <span className="shrink-0 text-sm">✓</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-300">Full Name</label>
            <input
              type="text"
              required
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Chen"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-300">Corporate Email</label>
            <input
              type="email"
              required
              className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.chen@enterprise.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              {password && (
                <span className={`text-[10px] font-mono font-bold ${passwordStrength.text}`}>
                  {passwordStrength.label}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                tabIndex="-1"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Password Strength Progress Bar */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Confirm Password</label>
              {passwordsMatch && (
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  ✓ Passwords match
                </span>
              )}
              {passwordsMismatch && (
                <span className="text-[10px] font-mono font-bold text-red-400">
                  ✕ Passwords do not match
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                  passwordsMismatch
                    ? 'border-red-500/70 focus:border-red-500'
                    : passwordsMatch
                    ? 'border-emerald-500/70 focus:border-emerald-500'
                    : 'border-slate-750 focus:border-blue-500'
                }`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                tabIndex="-1"
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Role guidance note */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300">Default Role: Employee</span>
            <p>New accounts are onboarded as Employees. Elevated Manager or SecOps Admin privileges can be granted by an Admin in the Admin Console.</p>
          </div>

          <button
            type="submit"
            disabled={isLoading || passwordsMismatch}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-lg shadow-blue-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <span className="animate-spin text-sm">⟳</span>
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors underline-offset-4 hover:underline"
          >
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
