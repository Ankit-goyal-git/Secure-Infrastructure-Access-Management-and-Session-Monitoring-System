import React, { useState, useEffect, useMemo } from 'react';

/**
 * Individual Active Grant Card with dedicated independent countdown timer
 */
function GrantCard({ grant, currentUserId, onExpire }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeRemaining());

  const uId = grant.userId || currentUserId || 1;
  const sId = grant.serverId;
  const sshCommand = `ssh employee_${uId}_server_${sId}@localhost -p 2222`;

  function calculateTimeRemaining() {
    let expiryMs = null;
    if (grant.expiresAt) {
      expiryMs = new Date(grant.expiresAt).getTime();
    } else if (grant.startedAt && grant.requestedDuration) {
      expiryMs = new Date(grant.startedAt).getTime() + grant.requestedDuration * 60 * 1000;
    } else if (grant.createdAt && grant.requestedDuration) {
      expiryMs = new Date(grant.createdAt).getTime() + grant.requestedDuration * 60 * 1000;
    }

    if (!expiryMs || isNaN(expiryMs)) {
      return { totalSeconds: 0, formatted: '00:00', isExpired: false, percent: 100 };
    }

    const now = Date.now();
    const diffMs = expiryMs - now;
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const isExpired = totalSeconds <= 0;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let formatted = '';
    if (hours > 0) {
      formatted = `${hours}h ${minutes}m ${String(seconds).padStart(2, '0')}s`;
    } else {
      formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return { totalSeconds, formatted, isExpired };
  }

  // Independent 1-second interval for this card's countdown timer
  useEffect(() => {
    // Initial check
    const initial = calculateTimeRemaining();
    setTimeLeft(initial);
    if (initial.isExpired) {
      if (onExpire) onExpire(grant.id);
      return;
    }

    const interval = setInterval(() => {
      const updated = calculateTimeRemaining();
      setTimeLeft(updated);
      if (updated.isExpired) {
        clearInterval(interval);
        if (onExpire) onExpire(grant.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [grant.expiresAt, grant.startedAt, grant.createdAt, grant.requestedDuration]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sshCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Determine timer color theme based on urgency
  const timerBadgeClass = useMemo(() => {
    if (timeLeft.isExpired) {
      return 'bg-slate-800 text-slate-500 border-slate-700';
    }
    if (timeLeft.totalSeconds <= 60) {
      return 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse';
    }
    if (timeLeft.totalSeconds <= 300) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
    }
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
  }, [timeLeft.totalSeconds, timeLeft.isExpired]);

  return (
    <div className="bg-gradient-to-br from-slate-800/95 via-slate-800/80 to-slate-900 border-2 border-emerald-500/50 hover:border-emerald-400/80 rounded-xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between gap-4">
      {/* Card Header: Server Name, Target ID & Live Countdown */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <h4 className="text-base font-bold text-white tracking-tight">
              {grant.serverName || `Server #${sId}`}
            </h4>
            <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
              Target #{sId}
            </span>
            {grant.department && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600/50">
                {grant.department}
              </span>
            )}
          </div>

          {/* Independent Live Countdown Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border tracking-wider shrink-0 ${timerBadgeClass}`}
            title="Remaining active JIT access grant time"
          >
            <span>⏱️</span>
            <span>
              {timeLeft.isExpired ? 'EXPIRED' : `${timeLeft.formatted} left`}
            </span>
          </div>
        </div>

        {/* Reason / Purpose metadata */}
        <p className="text-xs text-slate-300 mt-2 line-clamp-2">
          <span className="text-slate-400 font-medium">Purpose:</span>{' '}
          <span className="italic text-slate-200">"{grant.reason || 'General Maintenance'}"</span>
        </p>
      </div>

      {/* Terminal SSH Command Box & Copy Button */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-black/70 border border-emerald-500/40 rounded-lg px-3 py-2 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-nowrap select-all shadow-inner">
            {sshCommand}
          </div>
          <button
            onClick={handleCopy}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              copied
                ? 'bg-emerald-500 text-slate-900 font-extrabold shadow-emerald-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-lg'
            }`}
            title="Copy command to clipboard"
          >
            {copied ? (
              <>
                <span>✓</span>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Connection Guidance Footer */}
        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span>🔑</span>
            <span>Auth: <strong>Web Portal Password</strong></span>
          </span>
          <span className="text-slate-400">
            Total: <strong>{grant.requestedDuration || 30}m</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-Server Active Grants Grid Component
 * Displays a dedicated, independent countdown card for each active approved server grant
 */
export default function ActiveGrantsGrid({ grants = [], currentUserId, onExpire }) {
  if (!grants || grants.length === 0) {
    return null;
  }

  const gridColsClass = useMemo(() => {
    if (grants.length === 1) return 'grid-cols-1';
    if (grants.length === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  }, [grants.length]);

  return (
    <div className="mb-6 p-5 bg-slate-900/90 border-2 border-emerald-500/40 rounded-2xl shadow-2xl backdrop-blur-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-700/80 gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
            Active JIT Grants (Ready to Connect)
          </h3>
          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
            {grants.length} {grants.length === 1 ? 'Server' : 'Servers'} Active
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Temporary bastion access authorized by manager. Connect directly via terminal.
        </p>
      </div>

      {/* Responsive Grid of Cards */}
      <div className={`grid ${gridColsClass} gap-4`}>
        {grants.map((grant) => (
          <GrantCard
            key={grant.id || `${grant.userId}-${grant.serverId}`}
            grant={grant}
            currentUserId={currentUserId}
            onExpire={onExpire}
          />
        ))}
      </div>
    </div>
  );
}
