import React, { useState } from 'react';

export default function RequestHistoryTable({ history = [], currentUserId }) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyCommand = (reqId, command) => {
    navigator.clipboard.writeText(command);
    setCopiedId(reqId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">My Access Requests</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status of your JIT infrastructure access requests.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Target Node</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">SSH Terminal Command</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60 font-sans">
            {Array.isArray(history) && history.length > 0 ? (
              history.map((req) => {
                const uId = req.userId || currentUserId || 1;
                const sId = req.serverId;
                const sshCommand = `ssh employee_${uId}_server_${sId}@localhost -p 2222`;
                const isApproved = req.status === 'approved';
                const isPending = req.status === 'pending';
                const isDenied = req.status === 'denied';
                const isCopied = copiedId === req.id;

                return (
                  <tr key={req.id} className="hover:bg-slate-750 transition">
                    {/* Server Info */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{req.serverName}</span>
                        {req.department && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                            {req.department}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Server ID: {sId}
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3.5 text-xs text-slate-300 font-mono">
                      {req.requestedDuration} mins
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          isApproved
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isPending
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isApproved
                              ? 'bg-emerald-400'
                              : isPending
                              ? 'bg-amber-400 animate-ping'
                              : 'bg-red-400'
                          }`}
                        />
                        {req.status}
                      </span>
                    </td>

                    {/* SSH Connection Command Action */}
                    <td className="px-4 py-3.5 text-right font-mono">
                      {isApproved ? (
                        <div className="inline-flex items-center gap-2 bg-slate-900 border border-emerald-500/40 rounded-lg p-1.5 pr-2 shadow-inner">
                          <code className="text-xs text-emerald-300 px-2 py-0.5 select-all">
                            {sshCommand}
                          </code>
                          <button
                            onClick={() => handleCopyCommand(req.id, sshCommand)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded transition flex items-center gap-1 ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                            }`}
                            title="Copy SSH command to clipboard"
                          >
                            {isCopied ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      ) : isPending ? (
                        <span className="text-xs text-amber-400/80 italic font-sans">
                          Pending Manager Authorization
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-sans">
                          Access Denied
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-8 text-slate-500 font-sans">
                  No access requests found. Submit a request using the form on the left.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
