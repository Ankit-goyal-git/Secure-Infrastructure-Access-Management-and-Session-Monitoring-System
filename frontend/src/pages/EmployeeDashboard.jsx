import React, { useState, useEffect, useMemo } from 'react';
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
  const [copiedCommand, setCopiedCommand] = useState(false);

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

  // Find most recent approved request to highlight
  const latestApproved = useMemo(() => {
    return history.find((req) => req.status === 'approved');
  }, [history]);

  const activeSshCommand = useMemo(() => {
    if (!latestApproved) return null;
    const uId = latestApproved.userId || currentUser.id || 1;
    const sId = latestApproved.serverId;
    return `ssh employee_${uId}_server_${sId}@localhost -p 2222`;
  }, [latestApproved, currentUser]);

  const handleCopyActiveCommand = () => {
    if (!activeSshCommand) return;
    navigator.clipboard.writeText(activeSshCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

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

      {/* Prominent Active Ready-to-Connect Banner */}
      {latestApproved && activeSshCommand && (
        <div className="mb-6 p-5 bg-gradient-to-r from-emerald-950/60 via-slate-800 to-slate-800 border-2 border-emerald-500/60 rounded-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-base font-bold text-emerald-300 uppercase tracking-wider">
                  Access Approved & Ready to Connect
                </h3>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono">
                  Target: {latestApproved.serverName} (ID: {latestApproved.serverId})
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Your temporary JIT session is active. Paste the command below into your terminal to connect.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-black/60 border border-emerald-500/50 rounded-lg px-3 py-2 font-mono text-sm text-emerald-300 select-all">
                {activeSshCommand}
              </div>
              <button
                onClick={handleCopyActiveCommand}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow-md flex items-center gap-1.5 whitespace-nowrap ${
                  copiedCommand
                    ? 'bg-emerald-500 text-slate-900'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {copiedCommand ? '✓ Copied to Clipboard!' : '📋 Copy SSH Command'}
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-emerald-500/20 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span>
              🔑 <strong>Authentication:</strong> Use your <strong>Web Portal Password</strong> when prompted by SSH.
            </span>
            <span>Duration: <strong>{latestApproved.requestedDuration} mins</strong></span>
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
