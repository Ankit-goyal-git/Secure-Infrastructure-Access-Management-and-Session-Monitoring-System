import React, { useState } from 'react';
import { managerService } from '../../services/managerService';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../common/ConfirmModal';

const DURATION_PRESETS = [15, 30, 60, 120, 240];
const REJECTION_TEMPLATES = [
  'Insufficient business justification provided.',
  'Please test and verify on Staging cluster first.',
  'Change freeze window currently in effect.',
  'Requires an approved JIRA / ServiceNow ticket reference.',
];

export default function PendingRequestsList({ requests = [], onActionComplete }) {
  const toast = useToast();
  const [processingId, setProcessingId] = useState(null);

  // Modal states
  const [approvingReq, setApprovingReq] = useState(null);
  const [approvalDuration, setApprovalDuration] = useState(30);
  const [approvalNote, setApprovalNote] = useState('');

  const [denyingReq, setDenyingReq] = useState(null);
  const [denialReason, setDenialReason] = useState(REJECTION_TEMPLATES[0]);

  // Quick 1-Click Approve (bypasses modal with original duration)
  const handleQuickApprove = async (request) => {
    setProcessingId(request.id);
    try {
      await managerService.approveRequest(
        request.id,
        request.requestedDuration,
        'Quick-approved by manager'
      );
      toast.success(`Access granted to ${request.user?.name || 'Employee'} for ${request.requestedDuration}m.`);
      if (onActionComplete) onActionComplete();
    } catch (error) {
      console.error('Failed to quick-approve request:', error);
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to approve access request'
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Open Approval Modal with default parameters
  const openApprovalModal = (request) => {
    setApprovingReq(request);
    setApprovalDuration(request.requestedDuration || 30);
    setApprovalNote(`Approved for ${request.serverName || request.server?.name || 'node'}`);
  };

  // Submit Customized Approval
  const handleCustomApprove = async () => {
    if (!approvingReq) return;
    setProcessingId(approvingReq.id);
    try {
      await managerService.approveRequest(
        approvingReq.id,
        Number(approvalDuration),
        approvalNote.trim() || 'Approved by manager'
      );
      toast.success(`Access approved for ${approvalDuration} mins.`);
      setApprovingReq(null);
      if (onActionComplete) onActionComplete();
    } catch (error) {
      console.error('Failed to approve request:', error);
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to approve request'
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Open Denial Modal
  const openDenialModal = (request) => {
    setDenyingReq(request);
    setDenialReason(REJECTION_TEMPLATES[0]);
  };

  // Submit Denial
  const handleConfirmDenial = async () => {
    if (!denyingReq) return;
    setProcessingId(denyingReq.id);
    try {
      await managerService.denyRequest(
        denyingReq.id,
        denialReason.trim() || 'Access request denied by manager'
      );
      toast.warning(`Request for ${denyingReq.serverName || 'server'} was denied.`);
      setDenyingReq(null);
      if (onActionComplete) onActionComplete();
    } catch (error) {
      console.error('Failed to deny request:', error);
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to deny request'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const formatElapsed = (dateStr) => {
    if (!dateStr) return 'Just now';
    const elapsedSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const mins = Math.floor(elapsedSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="text-slate-400 text-sm bg-slate-900/60 p-8 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
          ✓
        </div>
        <p className="font-semibold text-slate-200">All caught up!</p>
        <p className="text-xs text-slate-500 max-w-sm">
          No pending employee JIT access requests waiting for security authorization.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3.5">
        {requests.map((req) => {
          const empName = req.user?.name || 'Employee';
          const empEmail = req.user?.email;
          const sName = req.serverName || req.server?.name || `Server #${req.serverId}`;
          const isBusy = processingId === req.id;

          return (
            <div
              key={req.id}
              className="bg-slate-900/90 hover:bg-slate-900 p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 shadow-xl transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 group"
            >
              {/* Request Details */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* User Avatar Chip */}
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                    {empName.slice(0, 2)}
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight">{empName}</h3>
                  {empEmail && (
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      ({empEmail})
                    </span>
                  )}
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    ⏳ Pending Review
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono ml-auto lg:ml-0">
                    {formatElapsed(req.createdAt)}
                  </span>
                </div>

                {/* Target Node & Requested Duration */}
                <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                  <span>Target:</span>
                  <span className="font-semibold text-slate-100 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {sName}
                  </span>
                  {req.department && (
                    <span className="text-[10px] font-mono uppercase bg-slate-800/80 text-blue-300 border border-slate-700 px-1.5 py-0.5 rounded">
                      {req.department}
                    </span>
                  )}
                  <span className="text-slate-500">•</span>
                  <span>Requested Duration:</span>
                  <span className="font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded">
                    {req.requestedDuration} mins
                  </span>
                </div>

                {/* Justification quote */}
                <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 italic flex items-start gap-2">
                  <span className="text-slate-500 not-italic select-none">💬</span>
                  <span className="leading-relaxed">"{req.reason}"</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => openDenialModal(req)}
                  disabled={isBusy}
                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/30 hover:border-red-500/60 rounded-lg transition text-xs font-semibold cursor-pointer"
                  title="Reject request with custom explanation"
                >
                  Deny...
                </button>

                <button
                  type="button"
                  onClick={() => openApprovalModal(req)}
                  disabled={isBusy}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-lg transition text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  title="Adjust grant duration and add authorization notes"
                >
                  <span>⚙️</span>
                  <span>Customize</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickApprove(req)}
                  disabled={isBusy}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer"
                  title="Quick-approve with requested duration"
                >
                  {isBusy ? (
                    <span className="animate-spin text-xs">⟳</span>
                  ) : (
                    <span>✓</span>
                  )}
                  <span>{isBusy ? 'Processing...' : 'Approve'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Approval Modal */}
      {approvingReq && (
        <ConfirmModal
          isOpen={Boolean(approvingReq)}
          onClose={() => setApprovingReq(null)}
          onConfirm={handleCustomApprove}
          title="Authorize JIT Bastion Access"
          message={`Configure authorized duration and notes for ${approvingReq.user?.name || 'Employee'} on node "${approvingReq.serverName || approvingReq.server?.name || 'Server'}".`}
          confirmText="Confirm & Issue Grant"
          variant="success"
          isLoading={processingId === approvingReq.id}
        >
          <div className="space-y-4 pt-2">
            {/* Quick Duration Preset Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Authorized Duration (Minutes)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {DURATION_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setApprovalDuration(mins)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition cursor-pointer ${
                      Number(approvalDuration) === mins
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
                {approvingReq.requestedDuration && !DURATION_PRESETS.includes(approvingReq.requestedDuration) && (
                  <button
                    type="button"
                    onClick={() => setApprovalDuration(approvingReq.requestedDuration)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition cursor-pointer ${
                      Number(approvalDuration) === approvingReq.requestedDuration
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 text-cyan-400 border border-slate-700'
                    }`}
                  >
                    Requested ({approvingReq.requestedDuration}m)
                  </button>
                )}
              </div>
              <input
                type="number"
                min="5"
                max="480"
                value={approvalDuration}
                onChange={(e) => setApprovalDuration(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Authorization Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Authorization Audit Note (Optional)
              </label>
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="e.g., Approved for ticket JIRA-4921 / Sev-1 Incident"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Interactive Denial Modal */}
      {denyingReq && (
        <ConfirmModal
          isOpen={Boolean(denyingReq)}
          onClose={() => setDenyingReq(null)}
          onConfirm={handleConfirmDenial}
          title="Deny Access Request"
          message={`Provide a reason for rejecting ${denyingReq.user?.name || 'Employee'}'s access request to "${denyingReq.serverName || 'server'}". This reason will be recorded in the audit trail.`}
          confirmText="Confirm Denial"
          variant="danger"
          isLoading={processingId === denyingReq.id}
        >
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-slate-300">
              Quick Rejection Templates:
            </label>
            <div className="flex flex-col gap-1.5">
              {REJECTION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setDenialReason(tpl)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs transition cursor-pointer border ${
                    denialReason === tpl
                      ? 'bg-red-500/15 border-red-500/50 text-red-200 font-semibold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  "{tpl}"
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rejection Note
              </label>
              <textarea
                rows="2"
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                placeholder="Specify rejection details..."
              />
            </div>
          </div>
        </ConfirmModal>
      )}
    </>
  );
}
