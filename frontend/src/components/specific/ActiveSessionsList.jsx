import React, { useState, useEffect } from 'react';

export default function ActiveSessionsList({ sessions = [], onRevoke }) {
  const [remainingSeconds, setRemainingSeconds] = useState({});
  const [revokingId, setRevokingId] = useState(null);

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

    // 1-second ticking interval for live countdown
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

  const handleRevokeClick = async (sessionId) => {
    if (!onRevoke) return;
    if (!window.confirm('Are you sure you want to actively revoke this session? The active SSH connection will be severed immediately.')) {
      return;
    }
    setRevokingId(sessionId);
    try {
      await onRevoke(sessionId);
    } finally {
      setRevokingId(null);
    }
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-slate-400 text-sm bg-slate-800 p-6 rounded-lg border border-slate-700 flex items-center justify-between">
        <span>No active sessions currently executing on target servers.</span>
        <span className="text-xs text-slate-500 font-mono">Live Monitoring Active</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
          <tr>
            <th scope="col" className="px-5 py-3.5">User</th>
            <th scope="col" className="px-5 py-3.5">Target Server</th>
            <th scope="col" className="px-5 py-3.5">Status</th>
            <th scope="col" className="px-5 py-3.5">Live Countdown</th>
            <th scope="col" className="px-5 py-3.5 text-right">Instant Revoke</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60 font-sans">
          {sessions.map((session) => {
            const totalSec = remainingSeconds[session.id] ?? 0;
            const isExpired = totalSec <= 0;
            const isExpiringSoon = totalSec <= 300 && totalSec > 0;

            const userName = session.user?.name || session.userName || session.user?.email || `User #${session.userId || session.id}`;
            const userEmail = session.user?.email;
            const serverName = session.server?.name || session.serverName || `Server #${session.serverId || 'Unknown'}`;
            const serverHost = session.server?.host;

            return (
              <tr key={session.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-semibold text-white">{userName}</div>
                  {userEmail && (
                    <div className="text-xs text-slate-400">{userEmail}</div>
                  )}
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Session: {String(session.id).slice(0, 8)}...
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className="font-medium text-slate-200">{serverName}</span>
                  {serverHost && (
                    <span className="block text-xs font-mono text-slate-400 mt-0.5">
                      {serverHost}:{session.server?.port || 22}
                    </span>
                  )}
                  {session.accessType && (
                    <span className="inline-block mt-1 text-[11px] font-mono uppercase bg-slate-700/70 text-slate-300 px-1.5 py-0.5 rounded">
                      {session.accessType}
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
                      className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded border font-semibold tracking-wide ${
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
                      {formatCountdown(totalSec)}
                    </span>
                  </div>
                </td>

                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => handleRevokeClick(session.id)}
                    disabled={revokingId === session.id}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white rounded-md transition text-xs font-semibold shadow-md shadow-red-900/20 inline-flex items-center gap-1.5 cursor-pointer"
                    title="Instantly sever TCP connection via Redis Pub/Sub"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    {revokingId === session.id ? 'Severing...' : 'Revoke Session'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
