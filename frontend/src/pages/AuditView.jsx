import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auditService } from '../services/auditService';
import AsciinemaPlayerModal from '../components/specific/AsciinemaPlayerModal';

export default function AuditView() {
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'timeline' | 'alerts'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const data = await auditService.getAuditEvents();
      setAuditLogs(Array.isArray(data) ? data : data?.events || []);
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
      if (!isBackground) setAuditLogs([]);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(true), 4000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenReplay = (sessionData) => {
    setSelectedSession(sessionData);
    setIsPlayerOpen(true);
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Helper for human-readable relative time
  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group events by session ID to produce clear unique interactive sessions
  const groupedSessions = useMemo(() => {
    const map = new Map();

    for (const log of auditLogs) {
      const sid = log.session_id;
      if (!sid) continue;

      if (!map.has(sid)) {
        map.set(sid, {
          sessionId: sid,
          userId: log.user_id,
          serverId: log.server_id,
          rawUserId: log.raw_user_id,
          rawServerId: log.raw_server_id,
          startedAt: log.timestamp,
          endedAt: null,
          hasRecording: Boolean(log.has_recording),
          isEnded: false,
          commands: [],
          alerts: [],
          events: [],
        });
      }

      const sess = map.get(sid);
      sess.events.push(log);

      if (log.has_recording) sess.hasRecording = true;

      const evType = String(log.event_type || '');
      if (evType === 'SESSION_STARTED') {
        sess.startedAt = log.timestamp;
      } else if (evType === 'SESSION_ENDED' || evType === 'SESSION_RECORDED') {
        sess.isEnded = true;
        sess.endedAt = log.timestamp;
        if (evType === 'SESSION_RECORDED') sess.hasRecording = true;
      } else if (evType.includes('COMMAND_ALLOWED')) {
        const cmd = log.metadata?.command || log.metadata?.cmd;
        if (cmd && !sess.commands.includes(cmd)) sess.commands.push(cmd);
      } else if (evType.includes('COMMAND_BLOCKED') || evType.includes('ALERT') || evType.includes('FAILED')) {
        const cmd = log.metadata?.command || log.metadata?.reason || 'Security Alert';
        sess.alerts.push(cmd);
      }

      // Update earliest/latest timestamps
      if (new Date(log.timestamp) < new Date(sess.startedAt)) {
        sess.startedAt = log.timestamp;
      }
      if (sess.endedAt && new Date(log.timestamp) > new Date(sess.endedAt)) {
        sess.endedAt = log.timestamp;
      }
    }

    // Convert map to array and sort by most recent activity first
    const list = Array.from(map.values()).sort(
      (a, b) => new Date(b.endedAt || b.startedAt) - new Date(a.endedAt || a.startedAt)
    );

    return list;
  }, [auditLogs]);

  // Filtered lists
  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return groupedSessions;
    const q = searchTerm.toLowerCase();
    return groupedSessions.filter(
      (s) =>
        s.sessionId.toLowerCase().includes(q) ||
        String(s.userId).toLowerCase().includes(q) ||
        String(s.serverId).toLowerCase().includes(q) ||
        s.commands.some((c) => c.toLowerCase().includes(q))
    );
  }, [groupedSessions, searchTerm]);

  const securityAlerts = useMemo(() => {
    return auditLogs.filter(
      (log) =>
        String(log.event_type).includes('BLOCKED') ||
        String(log.event_type).includes('ALERT') ||
        String(log.event_type).includes('FAILED')
    );
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return auditLogs;
    const q = searchTerm.toLowerCase();
    return auditLogs.filter(
      (log) =>
        (log.session_id && log.session_id.toLowerCase().includes(q)) ||
        String(log.user_id).toLowerCase().includes(q) ||
        String(log.server_id).toLowerCase().includes(q) ||
        String(log.event_type).toLowerCase().includes(q) ||
        JSON.stringify(log.metadata || {}).toLowerCase().includes(q)
    );
  }, [auditLogs, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-slate-800 gap-4 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Security Audit & Session Replays</span>
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review terminal keystrokes, policy enforcement actions, and active/completed SSH proxy sessions.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <Link
            to="/manager"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <span>👔</span>
            <span>Manager Portal</span>
          </Link>
          <button
            onClick={() => fetchLogs(false)}
            className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Refresh logs immediately"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'sessions'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>🎥</span>
              <span>Session Replays</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'sessions' ? 'bg-blue-500/40 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {groupedSessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>📜</span>
              <span>Event Log</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'timeline' ? 'bg-blue-500/40 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {auditLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'alerts'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>🚨</span>
              <span>Security Alerts</span>
              {securityAlerts.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'alerts' ? 'bg-red-500/40 text-white' : 'bg-red-500/20 text-red-400'
                }`}>
                  {securityAlerts.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search user, server, command..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              Updated {formatRelativeTime(lastSynced.toISOString())}
            </span>
          </div>
        </div>

        {/* TAB 1: SESSION REPLAYS VIEW */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <p>
                Interactive SSH terminal sessions recorded in Asciinema (.cast) format. Sessions are automatically saved when an employee types <code className="text-emerald-400 bg-slate-800 px-1 rounded">exit</code>.
              </p>
              <span>{filteredSessions.length} total sessions</span>
            </div>

            {isLoading && groupedSessions.length === 0 ? (
              <div className="text-slate-400 py-16 text-center bg-slate-900 rounded-xl border border-slate-800">
                <span className="animate-spin inline-block mr-2">⟳</span> Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-slate-500 py-16 text-center bg-slate-900 rounded-xl border border-slate-800">
                <p className="text-sm font-medium text-slate-400">No session recordings match your criteria.</p>
                <p className="text-xs text-slate-500 mt-1">Connect via SSH using an approved access grant to start a recorded session.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((sess, index) => {
                  const isLatest = index === 0 && !searchTerm;
                  const canReplay = sess.hasRecording;

                  return (
                    <div
                      key={sess.sessionId}
                      className={`p-5 rounded-xl border transition-all ${
                        isLatest
                          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Session Metadata */}
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center flex-wrap gap-2.5">
                            {isLatest && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-sm">
                                <span>🌟</span>
                                <span>Latest Session</span>
                              </span>
                            )}

                            {sess.hasRecording ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Recorded & Ready
                              </span>
                            ) : sess.isEnded ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                Disconnected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                Live Active Session
                              </span>
                            )}

                            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                              <span>ID:</span>
                              <span className="text-slate-300">{sess.sessionId.substring(0, 8)}...</span>
                              <button
                                onClick={() => handleCopyId(sess.sessionId)}
                                className="text-slate-500 hover:text-slate-300 transition text-[10px] ml-0.5 cursor-pointer"
                                title="Copy full Session UUID"
                              >
                                {copiedId === sess.sessionId ? '✓' : '📋'}
                              </button>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Employee</span>
                              <span className="text-white font-medium">{sess.userId}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Target Server</span>
                              <span className="text-cyan-400 font-mono font-medium">{sess.serverId}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Activity</span>
                              <span className="text-slate-300">
                                {formatRelativeTime(sess.endedAt || sess.startedAt)} ({new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                          </div>

                          {/* Commands Run in this Session */}
                          {sess.commands.length > 0 && (
                            <div className="pt-2 flex items-center flex-wrap gap-1.5">
                              <span className="text-[11px] text-slate-500 font-mono">Commands:</span>
                              {sess.commands.slice(0, 5).map((cmd, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90"
                                >
                                  {cmd}
                                </span>
                              ))}
                              {sess.commands.length > 5 && (
                                <span className="text-[10px] text-slate-500 italic">
                                  +{sess.commands.length - 5} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Security Alert Warnings */}
                          {sess.alerts.length > 0 && (
                            <div className="pt-1 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-semibold flex items-center gap-1">
                                <span>⚠️</span>
                                <span>{sess.alerts.length} Blocked Command Attempt(s)</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 border-slate-800/80 pt-3 md:pt-0">
                          {canReplay ? (
                            <button
                              onClick={() => handleOpenReplay({ id: sess.sessionId, user_id: sess.userId, server_id: sess.serverId })}
                              className={`px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition cursor-pointer ${
                                isLatest
                                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-900/40 ring-1 ring-emerald-400/40'
                                  : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-900/30'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              <span>Watch Replay</span>
                            </button>
                          ) : !sess.isEnded ? (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                                Session Live
                              </span>
                              <span className="block text-[10px] text-slate-500 mt-1">
                                Saved upon disconnect
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic px-3 py-1.5">
                              No keystrokes recorded
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FORENSIC RAW EVENT LOG */}
        {activeTab === 'timeline' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Detailed sequential audit events logged across the gateway and internal services.</span>
              <span>{filteredLogs.length} events</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="uppercase bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Target Server</th>
                    <th className="px-4 py-3">Result & Payload</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-500">
                        No events match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isAlert =
                        String(log.event_type).includes('BLOCKED') ||
                        String(log.event_type).includes('ALERT') ||
                        String(log.event_type).includes('FAILED');

                      return (
                        <tr key={log.event_id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                            {formatRelativeTime(log.timestamp)}
                            <span className="block text-[10px] text-slate-600">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                                isAlert
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : log.event_type === 'SESSION_RECORDED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {String(log.event_type).replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">
                            {log.user_id}
                          </td>
                          <td className="px-4 py-3 text-cyan-400 font-mono whitespace-nowrap">
                            {log.server_id}
                          </td>
                          <td className="px-4 py-3 max-w-md">
                            <span
                              className={`font-mono font-bold mr-2 text-[11px] ${
                                log.result === 'ALLOWED'
                                  ? 'text-emerald-400'
                                  : log.result === 'BLOCKED'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              [{log.result}]
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono break-all">
                              {log.metadata
                                ? JSON.stringify(log.metadata).replace(/["{}]/g, '').replace(/:/g, ': ')
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {log.has_recording ? (
                              <button
                                onClick={() =>
                                  handleOpenReplay({
                                    id: log.session_id,
                                    user_id: log.user_id,
                                    server_id: log.server_id,
                                  })
                                }
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition cursor-pointer"
                              >
                                Replay
                              </button>
                            ) : log.session_id ? (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Session Log
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600">System</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SECURITY ALERTS ONLY */}
        {activeTab === 'alerts' && (
          <div className="bg-slate-900 rounded-xl border border-red-900/30 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-red-900/30 bg-red-950/10 flex justify-between items-center text-xs text-red-300">
              <span className="flex items-center gap-1.5 font-semibold">
                <span>🚨</span>
                <span>Security Violations & Blocked Commands</span>
              </span>
              <span>{securityAlerts.length} total alerts</span>
            </div>

            <div className="divide-y divide-slate-800">
              {securityAlerts.length === 0 ? (
                <div className="text-slate-500 py-16 text-center">
                  <span className="text-2xl block mb-2">🛡️</span>
                  <p className="text-sm font-medium text-slate-400">Zero security violations recorded.</p>
                  <p className="text-xs text-slate-500 mt-1">All commands executed inside interactive sessions complied with gateway security policy.</p>
                </div>
              ) : (
                securityAlerts.map((alert) => (
                  <div key={alert.event_id} className="p-4 hover:bg-slate-800/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          {alert.event_type}
                        </span>
                        <span className="text-xs font-semibold text-white">{alert.user_id}</span>
                        <span className="text-xs text-slate-500">on</span>
                        <span className="text-xs font-mono text-cyan-400">{alert.server_id}</span>
                      </div>
                      <p className="text-xs font-mono text-red-300">
                        {alert.metadata?.command ? `Attempted: ${alert.metadata.command}` : JSON.stringify(alert.metadata || {})}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-mono block">
                        {formatRelativeTime(alert.timestamp)}
                      </span>
                      {alert.has_recording && (
                        <button
                          onClick={() => handleOpenReplay({ id: alert.session_id, user_id: alert.user_id, server_id: alert.server_id })}
                          className="mt-1 px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-[11px] font-medium transition cursor-pointer"
                        >
                          Review in Replay
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Asciinema Visual Terminal Playback Modal */}
      <AsciinemaPlayerModal
        session={selectedSession}
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
      />
    </div>
  );
}
