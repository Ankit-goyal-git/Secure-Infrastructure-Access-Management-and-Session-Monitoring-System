import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auditService } from '../services/auditService';
import AsciinemaPlayerModal from '../components/specific/AsciinemaPlayerModal';

export default function AuditView() {
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await auditService.getAuditEvents();
      setAuditLogs(Array.isArray(data) ? data : data?.events || []);
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenReplay = (log) => {
    setSelectedSession(log);
    setIsPlayerOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>Security Audit & Keystroke Replay</span>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-mono">
              Phase 2 Audit Replay
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            Monitor real-time JIT sessions, security alerts, and replay interactive terminal sessions in Asciinema format.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/manager"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md text-sm transition"
          >
            Manager Portal
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md text-sm transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Real-time Event Stream & Session Replays</h2>
              <p className="text-xs text-slate-400">Click &ldquo;Replay Session&rdquo; on any entry to launch the interactive Asciinema terminal player.</p>
            </div>
            <button
              onClick={fetchLogs}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-700 transition cursor-pointer"
            >
              Refresh Now
            </button>
          </div>

          {isLoading && auditLogs.length === 0 ? (
            <div className="text-slate-400 py-8 text-center">Loading security events...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs text-slate-300 uppercase bg-slate-900/90 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">Event Type</th>
                    <th className="px-4 py-3.5">User</th>
                    <th className="px-4 py-3.5">Server</th>
                    <th className="px-4 py-3.5">Result & Details</th>
                    <th className="px-4 py-3.5 text-right">Audit Playback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 font-sans">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-500">
                        No audit events recorded yet. Connect via SSH to generate session events.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const isAlert =
                        String(log.event_type).includes('BLOCKED') ||
                        String(log.event_type).includes('ALERT') ||
                        String(log.event_type).includes('FAILED');

                      const formattedTimestamp = log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : 'Just now';

                      return (
                        <tr
                          key={log.event_id || Math.random()}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400 font-mono">
                            {formattedTimestamp}
                          </td>
                          <td className="px-4 py-3.5 font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider ${
                                isAlert
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {String(log.event_type).replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-200 font-medium">
                            {log.user_id}
                          </td>
                          <td className="px-4 py-3.5 text-slate-200 font-medium">
                            {log.server_id}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`font-semibold mr-2 text-xs font-mono ${
                                log.result === 'ALLOWED'
                                  ? 'text-emerald-400'
                                  : log.result === 'BLOCKED'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              [{log.result}]
                            </span>
                            <span className="text-slate-400 text-xs italic">
                              {log.metadata
                                ? JSON.stringify(log.metadata)
                                    .replace(/["{}]/g, '')
                                    .replace(/:/g, ': ')
                                : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {log.session_id ? (
                              <button
                                onClick={() => handleOpenReplay(log)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded text-xs font-medium shadow-sm shadow-blue-900/30 inline-flex items-center gap-1.5 transition cursor-pointer"
                                title="Replay terminal keystroke session"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                                <span>Watch Replay</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">
                                System Event
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
