import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PendingRequestsList from '../components/specific/PendingRequestsList';
import ActiveSessionsList from '../components/specific/ActiveSessionsList';
import { managerService } from '../services/managerService';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const [requestsData, sessionsData] = await Promise.allSettled([
        managerService.getPendingRequests(),
        managerService.getActiveSessions(),
      ]);

      if (requestsData.status === 'fulfilled') {
        setPendingRequests(requestsData.value || []);
      } else {
        console.error("Failed to fetch pending requests", requestsData.reason);
      }

      if (sessionsData.status === 'fulfilled') {
        setActiveSessions(sessionsData.value || []);
      } else {
        console.error("Failed to fetch active sessions", sessionsData.reason);
        setActiveSessions([]);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRevokeSession = async (sessionId) => {
    try {
      await managerService.revokeSession(sessionId, 'Revoked by manager');
      await fetchRequests();
    } catch (error) {
      console.error('Failed to revoke session:', error);
      alert(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to revoke session'
      );
    }
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
          <h1 className="text-2xl font-bold text-white">Manager Portal</h1>
          <p className="text-sm text-slate-400">Review and authorize temporary infrastructure access.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/audit"
            className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-md text-sm font-medium transition flex items-center gap-2"
          >
            <span>🛡️</span>
            <span>Audit Logs & Replays</span>
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md transition cursor-pointer">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 border-b border-slate-800 pb-2">Pending Approvals</h2>
          {isLoading ? (
            <div className="text-slate-400">Loading pending requests...</div>
          ) : (
            <PendingRequestsList requests={pendingRequests} onActionComplete={fetchRequests} />
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-4 border-b border-slate-800 pb-2">Active Sessions</h2>
          {isLoading ? (
            <div className="text-slate-400">Loading active sessions...</div>
          ) : (
            <ActiveSessionsList sessions={activeSessions} onRevoke={handleRevokeSession} />
          )}
        </section>
      </main>
    </div>
  );
}

