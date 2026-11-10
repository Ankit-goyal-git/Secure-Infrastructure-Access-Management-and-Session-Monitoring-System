import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/common/Navbar';
import PendingRequestsList from '../components/specific/PendingRequestsList';
import ActiveSessionsList from '../components/specific/ActiveSessionsList';
import { managerService } from '../services/managerService';
import { useToast } from '../context/ToastContext';

export default function ManagerDashboard() {
  const toast = useToast();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(new Date());

  const prevPendingCountRef = useRef(0);

  const fetchRequests = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      const [requestsData, sessionsData] = await Promise.allSettled([
        managerService.getPendingRequests(),
        managerService.getActiveSessions(),
      ]);

      if (requestsData.status === 'fulfilled') {
        const fetched = requestsData.value || [];
        // Detect newly arrived requests and notify manager
        if (silent && fetched.length > prevPendingCountRef.current) {
          const newDiff = fetched.length - prevPendingCountRef.current;
          toast.info(`${newDiff} new JIT access request${newDiff === 1 ? '' : 's'} arrived for review!`);
        }
        prevPendingCountRef.current = fetched.length;
        setPendingRequests(fetched);
      } else {
        console.error('Failed to fetch pending requests', requestsData.reason);
      }

      if (sessionsData.status === 'fulfilled') {
        setActiveSessions(sessionsData.value || []);
      } else {
        console.error('Failed to fetch active sessions', sessionsData.reason);
        setActiveSessions([]);
      }
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load + 4s Auto Polling for real-time visibility
  useEffect(() => {
    fetchRequests();

    const interval = setInterval(() => {
      fetchRequests(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleRevokeSession = async (sessionId, reason = 'Revoked by manager') => {
    try {
      await managerService.revokeSession(sessionId, reason);
      await fetchRequests(true);
    } catch (error) {
      console.error('Failed to revoke session:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Sub-Header Bar with Live Sync & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Security Manager Portal</h1>
            <p className="text-xs text-slate-400 mt-1">
              Review pending employee JIT access requests and inspect active bastion connections.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Live Sync Status Pill */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Syncing (4s)</span>
              <span className="text-[10px] text-slate-500">
                • {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              type="button"
              onClick={() => fetchRequests(false)}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-750 disabled:opacity-50 text-slate-300 text-xs font-semibold border border-slate-750 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              title="Force manual refresh"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Approvals</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{pendingRequests.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-lg">
              ⏳
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Bastion SSH</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{activeSessions.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
              ⚡
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">SSH Bastion Gateway</p>
              <p className="text-sm font-bold text-cyan-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Port 2222 Healthy</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg">
              🛡️
            </div>
          </div>
        </div>

        {/* Pending Requests Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Pending Authorizations</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {pendingRequests.length}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="text-slate-500 text-sm py-8 text-center">Loading pending requests...</div>
          ) : (
            <PendingRequestsList requests={pendingRequests} onActionComplete={() => fetchRequests(true)} />
          )}
        </section>

        {/* Active SSH Sessions Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Active Bastion Sessions</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {activeSessions.length}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="text-slate-500 text-sm py-8 text-center">Loading active sessions...</div>
          ) : (
            <ActiveSessionsList sessions={activeSessions} onRevoke={handleRevokeSession} />
          )}
        </section>
      </main>
    </div>
  );
}
