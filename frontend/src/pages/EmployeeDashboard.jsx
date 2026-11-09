import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AccessRequestForm from '../components/specific/AccessRequestForm';
import RequestHistoryTable from '../components/specific/RequestHistoryTable';
import { employeeService } from '../services/employeeService';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [revocationToast, setRevocationToast] = useState(null);

  // Track previously approved request IDs to detect real-time manager revocations
  const prevApprovedIdsRef = useRef(new Set());
  const initialFetchDoneRef = useRef(false);

  // Current logged in user context
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
      return {};
    }
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      const [serversData, historyData] = await Promise.all([
        employeeService.getActiveTargets(),
        employeeService.getPersonalHistory(),
      ]);

      const safeServers = Array.isArray(serversData)
        ? serversData
        : serversData?.data || serversData?.servers || [];
      const safeHistory = Array.isArray(historyData)
        ? historyData
        : historyData?.data || historyData?.history || [];

      // Detect active grants revoked mid-session by manager
      const currentApprovedIds = safeHistory
        .filter((r) => r.status === 'approved')
        .map((r) => r.id);

      if (initialFetchDoneRef.current) {
        const newlyRevoked = safeHistory.filter(
          (r) => r.status === 'revoked' && prevApprovedIdsRef.current.has(r.id)
        );

        if (newlyRevoked.length > 0) {
          const names = newlyRevoked
            .map((r) => r.serverName || `Server #${r.serverId}`)
            .join(', ');
          setRevocationToast(`Session was revoked by manager: ${names}`);
        }
      } else {
        initialFetchDoneRef.current = true;
      }

      prevApprovedIdsRef.current = new Set(currentApprovedIds);

      setServers(safeServers);
      setHistory(safeHistory);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load + Real-time auto-refresh polling every 3 seconds
  useEffect(() => {
    fetchData();

    // Auto-refresh interval (polls every 3 seconds so approvals appear immediately)
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Find all approved requests to highlight for easy connection
  const approvedRequests = useMemo(() => {
    return history.filter((req) => req.status === 'approved');
  }, [history]);

  const handleCopyCommand = (req) => {
    const uId = req.userId || currentUser.id || 1;
    const sId = req.serverId;
    const cmd = `ssh employee_${uId}_server_${sId}@localhost -p 2222`;
    navigator.clipboard.writeText(cmd);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Auto-dismiss revocation notification after 8 seconds
  useEffect(() => {
    if (revocationToast) {
      const timer = setTimeout(() => {
        setRevocationToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [revocationToast]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 border-b border-slate-700 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Employee Access Portal</h1>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-semibold">
              JIT Session Gateway
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Logged in as <span className="text-slate-200 font-semibold">{currentUser.name || 'Employee'}</span> ({currentUser.email || 'employee@example.com'}) • User ID: <span className="font-mono text-blue-400">{currentUser.id || 1}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium border border-slate-700 rounded-md transition flex items-center gap-1.5"
            title="Refresh status now"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
            <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md text-xs font-medium transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Real-time Revocation Alert Toast */}
      {revocationToast && (
        <div className="mb-6 p-4 bg-red-950/90 border-2 border-red-500 rounded-xl shadow-2xl flex items-center justify-between text-red-100 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-sm text-red-200">
                [ACCESS REVOKED] {revocationToast}
              </p>
              <p className="text-xs text-red-300 mt-0.5">
                Active SSH terminal sessions have been severed and cached credentials removed.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRevocationToast(null)}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 hover:text-white rounded text-xs font-semibold border border-red-700/60 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Prominent Active Ready-to-Connect Banners for All Approved Servers */}
      {approvedRequests.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                Active SSH Access ({approvedRequests.length} {approvedRequests.length === 1 ? 'Server' : 'Servers'} Ready)
              </h3>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              🔑 Enter your <strong>Web Portal Password</strong> when prompted by SSH
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {approvedRequests.map((req) => {
              const uId = req.userId || currentUser.id || 1;
              const sId = req.serverId;
              const cmd = `ssh employee_${uId}_server_${sId}@localhost -p 2222`;
              const isCopied = copiedId === req.id;

              return (
                <div
                  key={req.id}
                  className="p-4 bg-gradient-to-r from-emerald-950/70 via-slate-800 to-slate-800 border-2 border-emerald-500/60 rounded-xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {req.serverName || `Server #${sId}`}
                      </span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono">
                        Target #{sId}
                      </span>
                      {req.department && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                          {req.department}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        • {req.requestedDuration} mins approved
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Reason: <span className="text-slate-200 italic font-mono">"{req.reason}"</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-black/70 border border-emerald-500/50 rounded-lg px-3 py-1.5 font-mono text-xs text-emerald-300 select-all">
                      {cmd}
                    </div>
                    <button
                      onClick={() => handleCopyCommand(req)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-500 text-slate-900 font-bold'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isCopied ? '✓ Copied!' : '📋 Copy SSH Command'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      {isLoading ? (
        <div className="text-center text-slate-400 py-16">Loading access portal...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <AccessRequestForm servers={servers} onSuccess={() => fetchData(false)} />
          </div>
          <div className="lg:col-span-2">
            <RequestHistoryTable history={history} currentUserId={currentUser.id} />
          </div>
        </div>
      )}
    </div>
  );
}
