import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '../../services/adminService';

const ROLES = [
  { id: 'employee', label: 'Employee', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'manager', label: 'Manager', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'admin', label: 'Admin', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
];

export default function UserManagementTab({ currentAdminId }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // New user modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('employee');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await adminService.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load users catalog:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to fetch team members.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleRoleChange = async (user, newRole) => {
    if (user.role === newRole) return;

    try {
      await adminService.updateUserRole(user.id, newRole);
      showToast(`User ${user.name} role changed to [${newRole.toUpperCase()}]`);
      await fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update user role', true);
    }
  };

  const handleDeleteUser = async (user) => {
    if (String(user.id) === String(currentAdminId)) {
      showToast('You cannot delete your own admin account.', true);
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete user "${user.name}" (${user.email})?`
    );
    if (!confirmed) return;

    try {
      await adminService.deleteUser(user.id);
      showToast(`User ${user.email} has been deleted.`);
      await fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete user.', true);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmittingUser(true);

    try {
      await adminService.createUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });

      showToast(`Team member "${newUserName}" created as [${newUserRole.toUpperCase()}]!`);
      setIsAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('employee');
      await fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create user.', true);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole =
        selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRoleFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = users.length;
    const employees = users.filter((u) => u.role === 'employee').length;
    const managers = users.filter((u) => u.role === 'manager').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    return { total, employees, managers, admins };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Toast Alert Notifications */}
      {toastMessage && (
        <div className="p-4 bg-emerald-950/90 border border-emerald-500 rounded-xl shadow-xl flex items-center justify-between text-emerald-200 text-sm">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs text-emerald-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-950/90 border border-red-500 rounded-xl shadow-xl flex items-center justify-between text-red-200 text-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-red-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Role Distribution Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Team Members
          </span>
          <span className="text-3xl font-bold text-white mt-1 block">{stats.total}</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
            Employees (DevOps)
          </span>
          <span className="text-3xl font-bold text-emerald-400 mt-1 block">{stats.employees}</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
            Managers (Approvers)
          </span>
          <span className="text-3xl font-bold text-blue-400 mt-1 block">{stats.managers}</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block">
            System Admins
          </span>
          <span className="text-3xl font-bold text-purple-400 mt-1 block">{stats.admins}</span>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search team member by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-72"
          />

          {/* Role Filter */}
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Roles ({stats.total})</option>
            <option value="employee">Employees ({stats.employees})</option>
            <option value="manager">Managers ({stats.managers})</option>
            <option value="admin">Admins ({stats.admins})</option>
          </select>
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <span>+</span>
          <span>Add New Team Member</span>
        </button>
      </div>

      {/* Users & Roles Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-700/80 flex justify-between items-center">
          <div>
            <h3 className="text-base font-semibold text-white">Team Roster & Access Roles</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Change roles directly using the dropdown to promote or modify permissions.
            </p>
          </div>
          <button
            onClick={fetchUsers}
            className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
          >
            <span>↻</span>
            <span>Refresh Roster</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading team members...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No team members found matching current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">JIT Access History</th>
                  <th className="px-6 py-3.5">Joined</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 font-sans">
                {filteredUsers.map((user) => {
                  const isCurrentAdmin = String(user.id) === String(currentAdminId);

                  return (
                    <tr key={user.id} className="hover:bg-slate-750 transition">
                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{user.name}</span>
                              {isCurrentAdmin && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {user.email} • ID #{user.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Interactive Role Dropdown */}
                      <td className="px-6 py-4 font-sans">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value)}
                            disabled={isCurrentAdmin}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              user.role === 'admin'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                                : user.role === 'manager'
                                ? 'bg-blue-950/80 text-blue-300 border-blue-500/50'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                            }`}
                            title={
                              isCurrentAdmin
                                ? 'You cannot change your own admin role.'
                                : 'Change user role directly'
                            }
                          >
                            <option value="employee">Employee (DevOps)</option>
                            <option value="manager">Manager (Approver)</option>
                            <option value="admin">Admin (Full Control)</option>
                          </select>
                        </div>
                      </td>

                      {/* Access Requests Count */}
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="text-slate-300">
                          <strong>{user.requestsCount || 0}</strong> requests submitted
                        </div>
                        {user.activeGrantsCount > 0 && (
                          <div className="text-emerald-400 text-[11px] font-semibold mt-0.5">
                            ● {user.activeGrantsCount} active session grant
                          </div>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Seeded'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {!isCurrentAdmin ? (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded text-xs font-semibold transition cursor-pointer"
                            title="Remove user account"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision New Team Member Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👤</span>
                <span>Add New Team Member</span>
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. David Miller"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="david@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Platform Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="employee">Employee (Request temporary SSH JIT access)</option>
                  <option value="manager">Manager (Approve & Revoke JIT requests)</option>
                  <option value="admin">Admin (Manage infrastructure & team roles)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingUser ? 'Creating...' : 'Create Team Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
