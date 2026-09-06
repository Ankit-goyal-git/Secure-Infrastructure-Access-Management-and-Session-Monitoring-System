import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditService } from '../services/auditService';

export default function AuditView() {
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await auditService.getAuditEvents();
      // Defensively ensure data is an array
      setAuditLogs(Array.isArray(data) ? data : (data?.events || []));
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Optional: Set up polling to refresh logs every 10 seconds for a "live" feel
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Audit Log</h1>
          <p className="text-sm text-slate-400">Monitor JIT sessions and infrastructure access events.</p>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md transition">
          Sign Out
        </button>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Real-time Event Stream</h2>
            <button onClick={fetchLogs} className="text-sm text-blue-400 hover:text-blue-300">Refresh Now</button>
          </div>
          
          {isLoading && auditLogs.length === 0 ? (
            <div className="text-slate-400 py-4">Loading security events...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Server</th>
                    <th className="px-4 py-3">Result & Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-slate-500">No audit events found.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.event_id || Math.random()} className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{log.timestamp}</td>
                        <td className="px-4 py-3 font-semibold">
                          <span className={`px-2 py-1 rounded text-xs uppercase tracking-wider ${
                            String(log.event_type).includes('BLOCKED') || String(log.event_type).includes('ALERT') 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {String(log.event_type).replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{log.user_id}</td>
                        <td className="px-4 py-3 text-slate-200">{log.server_id}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold mr-2 ${log.result === 'ALLOWED' ? 'text-emerald-400' : 'text-red-400'}`}>
                            [{log.result}]
                          </span>
                          <span className="text-slate-300 italic">
                            {log.metadata ? JSON.stringify(log.metadata).replace(/["{}]/g, '').replace(/:/g, ': ') : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
