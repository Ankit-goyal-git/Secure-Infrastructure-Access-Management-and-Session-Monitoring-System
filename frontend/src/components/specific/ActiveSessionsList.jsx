import React, { useState, useEffect, useMemo } from 'react';
import ConfirmModal from '../common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

const REVOCATION_REASONS = [
  'manager_revocation',
  'Suspicious interactive keystroke pattern detected',
  'Emergency cluster maintenance window initiated',
  'Authorized change window elapsed',
];

export default function ActiveSessionsList({ sessions = [], onRevoke }) {
  const toast = useToast();
  const [remainingSeconds, setRemainingSeconds] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Revocation Modal state
  const [sessionToRevoke, setSessionToRevoke] = useState(null);
  const [revocationReason, setRevocationReason] = useState(REVOCATION_REASONS[0]);
  const [isRevoking, setIsRevoking] = useState(false);

  // Initialize and run high-precision 1-second live countdown
  useEffect(() => {
    const calculateSeconds = () => {
      const initialMap = {};
      sessions.forEach((s) => {
        if (s.expiresAt) {
          const diffSec = Math.max(
            0,
            Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000)
          );
          initialMap[s.id] = diffSec;
        } else if (s.remainingDuration !== undefined) {
          initialMap[s.id] = Number(s.remainingDuration) * 60;
        } else if (s.duration !== undefined) {
          initialMap[s.id] = Number(s.duration) * 60;
        } else {
          initialMap[s.id] = 3600;
        }
      });
      return initialMap;
    };

    setRemainingSeconds(calculateSeconds());

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        const updated = { ...prev };
        let anyChanged = false;
        Object.keys(updated).forEach((id) => {
          if (updated[id] > 0) {
            updated[id] -= 1;
            anyChanged = true;
          }
        });
        return anyChanged ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessions]);

  const formatCountdown = (totalSeconds) => {
    if (totalSeconds <= 0) return '00:00 (Expired)';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins < 10 ? '0' : ''}${remMins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleOpenRevoke = (session) => {
    setSessionToRevoke(session);
    setRevocationReason(REVOCATION_REASONS[0]);
  };

  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke || !onRevoke) return;
    setIsRevoking(true);
    try {
      await onRevoke(sessionToRevoke.id, revocationReason);
      toast.warning(`Session ${String(sessionToRevoke.id).slice(0, 8)} severed and credentials revoked.`);
      setSessionToRevoke(null);
    } catch (err) {
      console.error('Failed to revoke active session:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to revoke session');
    } finally {
      setIsRevoking(false);
    }
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const userName = (s.user?.name || s.userName || '').toLowerCase();
      const userEmail = (s.user?.email || '').toLowerCase();
      const serverName = (s.server?.name || s.serverName || '').toLowerCase();
      const serverHost = (s.server?.host || '').toLowerCase();
      return (
        userName.includes(q) ||
        userEmail.includes(q) ||
        serverName.includes(q) ||
        serverHost.includes(q) ||
        String(s.id).includes(q)
      );
    });
  }, [sessions, searchQuery]);

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-slate-400 text-sm bg-slate-900/60 p-8 rounded-xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
          <span>No active SSH sessions currently executing on target servers.</span>
        </div>
        <span className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          Live Monitoring Active
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Search & Counter Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-white">{sessions.length}</span>
            <span>Active Bastion Connection{sessions.length === 1 ? '' : 's'}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live PTY
            </span>
          </div>

          <div className="relative sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, server, IP..."
              className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th scope="col" className="px-5 py-3.5">User</th>
                <th scope="col" className="px-5 py-3.5">Target Host</th>
                <th scope="col" className="px-5 py-3.5">Connection State</th>
                <th scope="col" className="px-5 py-3.5">Live Countdown</th>
                <th scope="col" className="px-5 py-3.5 text-right">Instant Revoke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-sans">
              {filteredSessions.map((session) => {
                const totalSec = remainingSeconds[session.id] ?? 0;
                const isExpired = totalSec <= 0;
                const isExpiringSoon = totalSec <= 300 && totalSec > 0;

                const userName = session.user?.name || session.userName || session.user?.email || `User #${session.userId || session.id}`;
                const userEmail = session.user?.email;
                const serverName = session.server?.name || session.serverName || `Server #${session.serverId || 'Unknown'}`;
                const serverHost = session.server?.host;
                const isBusy = isRevoking && sessionToRevoke?.id === session.id;

                return (
                  <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                          {userName.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{userName}</div>
                          {userEmail && (
                            <div className="text-xs text-slate-400 font-mono">{userEmail}</div>
                          )}
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Session: {String(session.id).slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-200 text-sm">{serverName}</div>
                      {serverHost && (
                        <span className="inline-block text-xs font-mono text-cyan-400 mt-0.5">
                          {serverHost}:{session.server?.port || 22}
                        </span>
                      )}
                      {session.server?.department && (
                        <span className="block mt-1 text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded w-max border border-slate-700">
                          {session.server.department}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {session.status || 'Active'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-lg border font-semibold tracking-wide ${
                            isExpired
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : isExpiringSoon
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatCountdown(totalSec)}</span>
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenRevoke(session)}
                        disabled={isBusy}
                        className="px-3.5 py-1.5 bg-red-600/15 hover:bg-red-600/25 active:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                        title="Sever active connection immediately"
                      >
                        <span>⛔</span>
                        <span>Revoke</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Active Revocation */}
      {sessionToRevoke && (
        <ConfirmModal
          isOpen={Boolean(sessionToRevoke)}
          onClose={() => setSessionToRevoke(null)}
          onConfirm={handleConfirmRevoke}
          title="Sever Live SSH Session"
          message={`Are you sure you want to actively revoke session ${String(sessionToRevoke.id).slice(0, 8)} on "${sessionToRevoke.server?.name || sessionToRevoke.serverName || 'server'}"? The active SSH socket will be disconnected immediately and credentials permanently wiped.`}
          confirmText="Sever Connection Now"
          variant="danger"
          isLoading={isRevoking}
        >
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-slate-300">
              Revocation Audit Reason:
            </label>
            <div className="flex flex-col gap-1.5">
              {REVOCATION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRevocationReason(reason)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs transition cursor-pointer border ${
                    revocationReason === reason
                      ? 'bg-red-500/15 border-red-500/50 text-red-200 font-semibold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Revocation Note:
              </label>
              <input
                type="text"
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                placeholder="Specify reason..."
              />
            </div>
          </div>
        </ConfirmModal>
      )}
    </>
  );
}
