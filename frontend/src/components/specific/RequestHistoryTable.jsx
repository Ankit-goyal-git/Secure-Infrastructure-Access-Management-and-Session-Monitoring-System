import React from 'react';

export default function RequestHistoryTable({ history }) {
  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl h-full">
      <h2 className="text-lg font-semibold text-white mb-4">My Access Requests</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Server</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(history) ? history.map((req) => (
              <tr key={req.id} className="border-b border-slate-700">
                <td className="px-4 py-3 font-medium text-slate-200">{req.serverName}</td>
                <td className="px-4 py-3">{req.requestedDuration} mins</td>
                <td className="px-4 py-3">{req.createdAt}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="text-center py-4 text-slate-500">No request history found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
