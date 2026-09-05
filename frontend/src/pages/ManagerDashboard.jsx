import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PendingRequestsList from '../components/specific/PendingRequestsList';
import { managerService } from '../services/managerService';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const data = await managerService.getPendingRequests();
      setPendingRequests(data || []);
    } catch (error) {
      console.error("Failed to fetch requests", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
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
          <h1 className="text-2xl font-bold text-white">Manager Portal</h1>
          <p className="text-sm text-slate-400">Review and authorize temporary infrastructure access.</p>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md transition">
          Sign Out
        </button>
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
      </main>
    </div>
  );
}
