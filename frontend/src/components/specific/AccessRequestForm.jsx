import React, { useState } from 'react';
import { employeeService } from '../../services/employeeService';

export default function AccessRequestForm({ servers, onSuccess }) {
  const [selectedServer, setSelectedServer] = useState('');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await employeeService.createAccessRequest({
        serverId: Number(selectedServer),
        duration: Number(duration),
        reason
      });
      // Reset form
      setSelectedServer('');
      setDuration(30);
      setReason('');
      // Trigger parent refresh
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
      <h2 className="text-lg font-semibold text-white mb-4">Request JIT Access</h2>
      {error && <div className="mb-4 p-2 bg-red-500/10 text-red-400 text-sm rounded border border-red-500/50">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Target Server</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            required
          >
            <option value="">Select a server...</option>
            {Array.isArray(servers) ? servers.map(server => (
              <option key={server.id} value={server.id}>{server.name}</option>
            )) : <option disabled>No servers available</option>}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Duration (Minutes)</label>
          <input 
            type="number" 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="5"
            max="480"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Justification</label>
          <textarea 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            rows="2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need access?"
            required
          ></textarea>
        </div>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-md font-medium transition"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
