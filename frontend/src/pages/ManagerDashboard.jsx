import React, { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import PendingRequestsList from '../components/specific/PendingRequestsList';
import ActiveSessionsList from '../components/specific/ActiveSessionsList';
import { managerService } from '../services/managerService';

export default function ManagerDashboard() {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="pb-4 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Manager Portal</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review pending employee JIT access requests and inspect active bastion connections.
          </p>
        </div>
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

