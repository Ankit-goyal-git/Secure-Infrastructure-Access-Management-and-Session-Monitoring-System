import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import UserManagementTab from '../components/specific/UserManagementTab';
import { serverService } from '../services/serverService';
import ServerModal from '../components/specific/ServerModal';

const DEPARTMENTS = [
  { id: 'all', label: 'All Departments' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'infrastructure', label: 'Infrastructure & SRE' },
  { id: 'finance', label: 'Finance & Payments' },
  { id: 'security', label: 'Security & Compliance' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('servers'); // 'servers' | 'users'
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
      return {};
    }
  }, []);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverToEdit, setServerToEdit] = useState(null);

  // Quick Ping Diagnostics State per server
  const [pingStatus, setPingStatus] = useState({});

  const fetchServers = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Pass all=true so admin sees active, inactive, and maintenance nodes
      const data = await serverService.getServers({ all: 'true' });
      setServers(Array.isArray(data) ? data : data?.servers || []);
    } catch (err) {
      console.error('Failed to load server catalog:', err);
      setError('Unable to fetch servers inventory. Verify backend connection.');
      setServers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleOpenAddModal = () => {
    setServerToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (server) => {
    setServerToEdit(server);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (server) => {
    const nextStatus = server.status === 'active' ? 'inactive' : 'active';
    try {
      await serverService.updateServer(server.id, { status: nextStatus });
      await fetchServers();
    } catch (err) {
      alert(`Failed to update status: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteServer = async (server) => {
    const confirmText = window.confirm(
      `Are you sure you want to deactivate server "${server.name}" (${server.host}:${server.port})?`
    );
    if (!confirmText) return;

    try {
      await serverService.deleteServer(server.id, false);
      await fetchServers();
    } catch (err) {
      alert(`Failed to delete server: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleQuickPing = async (server) => {
    setPingStatus((prev) => ({
      ...prev,
      [server.id]: { loading: true },
    }));

    try {
      const result = await serverService.testConnection(server.host, server.port, 3000);
      setPingStatus((prev) => ({
        ...prev,
        [server.id]: {
          loading: false,
          success: result.success,
          message: result.success
            ? `${result.latencyMs}ms (${result.isSSH ? 'SSH' : 'TCP'})`
            : 'Unreachable',
        },
      }));
    } catch (err) {
      setPingStatus((prev) => ({
        ...prev,
        [server.id]: {
          loading: false,
          success: false,
          message: 'Error',
        },
      }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Filtered servers list
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDept = selectedDept === 'all' || s.department === selectedDept;
      const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [servers, searchQuery, selectedDept, selectedStatus]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = servers.length;
    const active = servers.filter((s) => s.status === 'active').length;
    const maintenance = servers.filter((s) => s.status === 'maintenance').length;
    const inactive = servers.filter((s) => s.status === 'inactive').length;
    return { total, active, maintenance, inactive };
  }, [servers]);

  const getDepartmentBadge = (dept) => {
    switch (dept) {
      case 'finance':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'infrastructure':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'security':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Admin Console Header & Sub-Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Console</h1>
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-semibold font-mono">
                Platform Root Control
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Zero-downtime server provisioning, upstream credentials vault, and team role-based access control.
            </p>
          </div>

          {/* Sub-Tabs: Servers vs Users */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'servers'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>🖥️</span>
              <span>Target Servers ({servers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>👥</span>
              <span>Team & Roles</span>
            </button>
          </div>
        </div>

        {/* Tab 2: Team & Role Management */}
        {activeTab === 'users' && (
          <UserManagementTab currentAdminId={currentUser.id} />
        )}

        {/* Tab 1: Target Servers Inventory */}
        {activeTab === 'servers' && (
          <div className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Target Nodes
            </span>
            <span className="text-3xl font-bold text-white mt-2 block">{stats.total}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
              Active Nodes
            </span>
            <span className="text-3xl font-bold text-emerald-400 mt-2 block">{stats.active}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
              Maintenance
            </span>
            <span className="text-3xl font-bold text-amber-400 mt-2 block">{stats.maintenance}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Inactive
            </span>
            <span className="text-3xl font-bold text-slate-300 mt-2 block">{stats.inactive}</span>
          </div>
        </div>

        {/* Filter & Action Bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search servers, host, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
            />

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="maintenance">Maintenance Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2"
          >
            <span>+</span>
            <span>Provision New Server</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Server Inventory Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-700/80 flex justify-between items-center">
            <h2 className="text-base font-semibold text-white">Target Server Inventory</h2>
            <button
              onClick={fetchServers}
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              ↻ Refresh Catalog
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading server catalog...</div>
          ) : filteredServers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No servers found matching current filters. Click "+ Provision New Server" to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-3.5">Node Info</th>
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5">Target Endpoint</th>
                    <th className="px-6 py-3.5">Credentials</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Live Ping</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 font-mono">
                  {filteredServers.map((server) => {
                    const ping = pingStatus[server.id];

                    return (
                      <tr key={server.id} className="hover:bg-slate-700/30 transition">
                        {/* Node Info */}
                        <td className="px-6 py-4 font-sans">
                          <div className="font-semibold text-white">{server.name}</div>
                          {server.description && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                              {server.description}
                            </div>
                          )}
                        </td>

                        {/* Department */}
                        <td className="px-6 py-4 font-sans">
                          <span
                            className={`inline-block text-xs uppercase px-2.5 py-0.5 rounded-full border font-semibold ${getDepartmentBadge(
                              server.department
                            )}`}
                          >
                            {server.department || 'general'}
                          </span>
                        </td>

                        {/* Endpoint */}
                        <td className="px-6 py-4 text-xs text-slate-200">
                          <span className="text-blue-400">{server.host}</span>
                          <span className="text-slate-500">:</span>
                          <span className="text-amber-300">{server.port}</span>
                        </td>

                        {/* Credentials */}
                        <td className="px-6 py-4 text-xs font-sans">
                          <div className="text-slate-300">User: <span className="font-mono text-slate-100">{server.sshUsername || 'employee'}</span></div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            {server.hasPassword && <span className="text-emerald-400">● Password</span>}
                            {server.hasKey && <span className="text-purple-400">● SSH Key</span>}
                            {!server.hasPassword && !server.hasKey && (
                              <span className="text-slate-500">Default Auth</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 font-sans">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border capitalize font-medium ${
                              server.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : server.status === 'maintenance'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-slate-700 text-slate-400 border-slate-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                server.status === 'active'
                                  ? 'bg-emerald-400'
                                  : server.status === 'maintenance'
                                  ? 'bg-amber-400'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {server.status}
                          </span>
                        </td>

                        {/* Live Ping Button / Diagnostic */}
                        <td className="px-6 py-4 font-sans">
                          {ping?.loading ? (
                            <span className="text-xs text-slate-400 animate-pulse">Pinging...</span>
                          ) : ping ? (
                            <button
                              onClick={() => handleQuickPing(server)}
                              className={`text-xs px-2 py-0.5 rounded border transition font-mono ${
                                ping.success
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                              }`}
                              title="Click to re-ping"
                            >
                              {ping.success ? `✓ ${ping.message}` : `✗ ${ping.message}`}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickPing(server)}
                              className="text-xs text-slate-400 hover:text-slate-200 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 px-2.5 py-1 rounded transition"
                            >
                              ⚡ Test Ping
                            </button>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-6 py-4 text-right font-sans space-x-2">
                          <button
                            onClick={() => handleToggleStatus(server)}
                            className="text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded transition"
                          >
                            {server.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(server)}
                            className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteServer(server)}
                            className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1 rounded transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
        )}
      </main>

      {/* Provision / Edit Server Modal */}
      <ServerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serverToEdit={serverToEdit}
        onSaveSuccess={fetchServers}
      />
    </div>
  );
}

