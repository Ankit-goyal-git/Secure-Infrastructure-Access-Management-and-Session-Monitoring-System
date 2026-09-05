import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AccessRequestForm from '../components/specific/AccessRequestForm';
import RequestHistoryTable from '../components/specific/RequestHistoryTable';
import { employeeService } from '../services/employeeService';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [serversData, historyData] = await Promise.all([
        employeeService.getActiveTargets(),
        employeeService.getPersonalHistory()
      ]);
      
      // Defensively check if backend wrapped the arrays in an object property (e.g. { data: [...] })
      const safeServers = Array.isArray(serversData) ? serversData : (serversData?.data || serversData?.servers || []);
      const safeHistory = Array.isArray(historyData) ? historyData : (historyData?.data || historyData?.history || []);
      
      setServers(safeServers);
      setHistory(safeHistory);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Fallback to empty arrays on failure
      setServers([]);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
          <h1 className="text-2xl font-bold text-white">Employee Access Portal</h1>
          <p className="text-sm text-slate-400">Request and manage temporary JIT server access.</p>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md transition">
          Sign Out
        </button>
      </header>

      {isLoading ? (
        <div className="text-center text-slate-400 py-10">Loading dashboard data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <AccessRequestForm servers={servers} onSuccess={fetchData} />
          </div>
          <div className="lg:col-span-2">
            <RequestHistoryTable history={history} />
          </div>
        </div>
      )}
    </div>
  );
}
