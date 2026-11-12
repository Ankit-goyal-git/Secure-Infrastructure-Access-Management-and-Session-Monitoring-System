import React, { useState, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { employeeService } from '../../services/employeeService';
import ConfirmModal from '../common/ConfirmModal';

const FILTER_TABS = [
  { id: 'all', label: 'All Requests' },
  { id: 'approved', label: 'Active & Approved' },
  { id: 'pending', label: 'Pending Review' },
  { id: 'revoked', label: 'Revoked' },
  { id: 'denied', label: 'Denied / Expired' },
];

export default function RequestHistoryTable({ history = [], currentUserId, onRefresh }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Cancellation modal state
  const [cancellingReq, setCancellingReq] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCopyCommand = (reqId, command) => {
    navigator.clipboard.writeText(command);
    setCopiedId(reqId);
    toast.success('SSH connection command copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenCancel = (req) => {
    setCancellingReq(req);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingReq) return;
    setIsCancelling(true);
    try {
      await employeeService.cancelRequest(cancellingReq.id);
      toast.info(`Request #${cancellingReq.id} for ${cancellingReq.serverName} was cancelled.`);
      setCancellingReq(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to cancel request:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to cancel request');
    } finally {
      setIsCancelling(false);
    }
  };

  // Tab counts
  const counts = useMemo(() => {
    const list = Array.isArray(history) ? history : [];
    return {
      all: list.length,
      approved: list.filter((r) => r.status === 'approved').length,
      pending: list.filter((r) => r.status === 'pending').length,
      revoked: list.filter((r) => r.status === 'revoked').length,
      denied: list.filter((r) => r.status === 'denied' || r.status === 'expired').length,
    };
  }, [history]);

  // Filtered and searched records
  const filteredHistory = useMemo(() => {
    const list = Array.isArray(history) ? history : [];
    return list.filter((item) => {
      // Tab filter
      if (activeTab === 'approved' && item.status !== 'approved') return false;
      if (activeTab === 'pending' && item.status !== 'pending') return false;
      if (activeTab === 'revoked' && item.status !== 'revoked') return false;
      if (activeTab === 'denied' && (item.status !== 'denied' && item.status !== 'expired')) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const serverName = (item.serverName || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        const dept = (item.department || '').toLowerCase();
        const idStr = String(item.id);
        const serverIdStr = String(item.serverId);
        return (
          serverName.includes(q) ||
          reason.includes(q) ||
          dept.includes(q) ||
          idStr.includes(q) ||
          serverIdStr.includes(q)
        );
      }
      return true;
    });
  }, [history, activeTab, searchQuery]);

  return (
    <>
      <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col space-y-4">
        {/* Header with Title and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Access History & Active Passes</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Audit trail of personal JIT requests and generated bastion commands
            </p>
          </div>

          <div className="relative sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history by server or reason..."
              className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/60 pb-3">
          {FILTER_TABS.map((tab) => {
            const count = counts[tab.id] || 0;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
                    : 'bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto flex-1 rounded-xl border border-slate-800/80 bg-slate-950/50">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-slate-950/90 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Target Node</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Requested / Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">SSH Command / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-sans text-xs">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((req) => {
                  const uId = req.userId || currentUserId || 1;
                  const sId = req.serverId;
                  const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
                  const sshCommand = `ssh employee_${uId}_server_${sId}@${host} -p 2222`;
                  const isApproved = req.status === 'approved';
                  const isPending = req.status === 'pending';
                  const isRevoked = req.status === 'revoked';
                  const isExpired = req.status === 'expired';
                  const isCopied = copiedId === req.id;

                  return (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition">
                      {/* Server Info */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{req.serverName}</span>
                          {req.department && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              {req.department}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ID: #{sId} {req.serverHost ? `• ${req.serverHost}:${req.serverPort || 22}` : ''}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3.5 font-mono text-cyan-400 font-semibold">
                        {req.requestedDuration}m
                      </td>

                      {/* Date & Justification */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="text-[11px] text-slate-400">
                          {req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </div>
                        <p className="text-[11px] text-slate-300 italic truncate mt-0.5" title={req.reason}>
                          "{req.reason}"
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : isRevoked
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : isExpired
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved
                                ? 'bg-emerald-400'
                                : isPending
                                ? 'bg-amber-400 animate-ping'
                                : isRevoked
                                ? 'bg-red-400'
                                : isExpired
                                ? 'bg-slate-500'
                                : 'bg-red-400'
                            }`}
                          />
                          {req.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right font-mono">
                        {isApproved ? (
                          <div className="inline-flex items-center gap-2 bg-slate-900 border border-emerald-500/40 rounded-lg p-1.5 pr-2 shadow-inner">
                            <code className="text-xs text-emerald-300 px-2 py-0.5 select-all">
                              {sshCommand}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyCommand(req.id, sshCommand)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 cursor-pointer ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              }`}
                              title="Copy SSH command"
                            >
                              {isCopied ? '✓ Copied' : '📋 Copy'}
                            </button>
                          </div>
                        ) : isPending ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-amber-400/90 italic font-sans">
                              Awaiting Manager...
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenCancel(req)}
                              className="px-2 py-1 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 rounded text-xs transition cursor-pointer font-sans"
                              title="Cancel this pending request"
                            >
                              ✕ Cancel
                            </button>
                          </div>
                        ) : isRevoked ? (
                          <span className="text-xs text-red-400 font-semibold font-sans inline-flex items-center gap-1">
                            <span>⛔</span>
                            <span>Severed by Manager</span>
                          </span>
                        ) : isExpired ? (
                          <span className="text-xs text-slate-500 font-sans">
                            TTL Expired
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 font-sans">
                            Denied
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-500 font-sans">
                    {searchQuery ? 'No requests match your search filter.' : 'No access requests found in this category.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Request Confirmation Modal */}
      {cancellingReq && (
        <ConfirmModal
          isOpen={Boolean(cancellingReq)}
          onClose={() => setCancellingReq(null)}
          onConfirm={handleConfirmCancel}
          title="Cancel Access Request"
          message={`Are you sure you want to withdraw your pending request for "${cancellingReq.serverName}"?`}
          confirmText="Withdraw Request"
          variant="warning"
          isLoading={isCancelling}
        />
      )}
    </>
  );
}
