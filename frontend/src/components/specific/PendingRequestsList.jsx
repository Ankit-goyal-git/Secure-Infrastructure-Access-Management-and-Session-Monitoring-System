import React, { useState } from 'react';
import { managerService } from '../../services/managerService';

export default function PendingRequestsList({ requests, onActionComplete }) {
  const [processingId, setProcessingId] = useState(null);

  const handleApprove = async (id) => {
    setProcessingId(id);
    await managerService.approveRequest(id);
    setProcessingId(null);
    if (onActionComplete) onActionComplete();
  };

  const handleDeny = async (id) => {
    setProcessingId(id);
    await managerService.denyRequest(id);
    setProcessingId(null);
    if (onActionComplete) onActionComplete();
  };

  if (requests.length === 0) {
    return <div className="text-slate-400 text-sm bg-slate-800 p-6 rounded-lg border border-slate-700">No pending requests at this time. All caught up!</div>;
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <div key={req.id} className="bg-slate-800 p-5 rounded-lg border border-slate-700 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-md font-semibold text-white">{req.user?.name || 'Employee'}</h3>
              <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                {req.status}
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Requested <span className="font-semibold text-blue-400">{req.requestedDuration} mins</span> on <span className="font-semibold text-slate-200">{req.serverName || req.server?.name}</span>
            </p>
            <p className="text-sm text-slate-400 mt-2 border-l-2 border-slate-600 pl-2 italic">
              "{req.reason}"
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleDeny(req.id)}
              disabled={processingId === req.id}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/50 rounded-md transition text-sm font-medium"
            >
              {processingId === req.id ? '...' : 'Deny'}
            </button>
            <button 
              onClick={() => handleApprove(req.id)}
              disabled={processingId === req.id}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md transition text-sm font-medium shadow-lg shadow-emerald-900/20"
            >
              {processingId === req.id ? 'Processing...' : 'Approve Access'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
