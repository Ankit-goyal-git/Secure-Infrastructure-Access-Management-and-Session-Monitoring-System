import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from '../components/common/Navbar';
import AccessRequestForm from '../components/specific/AccessRequestForm';
import RequestHistoryTable from '../components/specific/RequestHistoryTable';
import ActiveGrantsGrid from '../components/specific/ActiveGrantsGrid';
import { employeeService } from '../services/employeeService';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Filter all approved, active, non-expired grants (deduplicated by server)
  const activeGrants = useMemo(() => {
    const now = Date.now();
    const approved = history.filter((req) => {
      if (req.status !== 'approved') return false;
      if (req.expiresAt && new Date(req.expiresAt).getTime() <= now) return false;
      return true;
    });

    // Deduplicate by serverId so the latest active grant per server is displayed
    const serverMap = new Map();
    for (const req of approved) {
      const sId = String(req.serverId);
      if (!serverMap.has(sId)) {
        serverMap.set(sId, req);
      }
    }
    return Array.from(serverMap.values());
  }, [history]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Sub-Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Employee Bastion Gateway</h1>
            <p className="text-xs text-slate-400 mt-1">
              Submit Just-In-Time access requests and connect via temporary credentials.
            </p>
          </div>

          <button
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 text-xs font-medium border border-slate-750 rounded-lg transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            title="Refresh status now"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
            <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
          </button>
        </div>

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

      {/* Multi-Server Active JIT Grants Grid with Independent Live Countdown Timers */}
      <ActiveGrantsGrid
        grants={activeGrants}
        currentUserId={currentUser.id}
        onExpire={() => fetchData(true)}
      />

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
      </main>
    </div>
  );
}
