import React, { useState } from 'react';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../context/ToastContext';

const DURATION_PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '4h', value: 240 },
];

const REASON_TEMPLATES = [
  {
    chip: '⚡ Sev-1 Hotfix',
    text: 'Emergency Sev-1 incident remediation, patching, and service recovery.',
  },
  {
    chip: '🗄️ DB Migration',
    text: 'Run database schema migration scripts and verify integrity indexes.',
  },
  {
    chip: '🔍 Log Inspection',
    text: 'Investigate systemd service logs and application crash stack traces.',
  },
  {
    chip: '🔧 Config Deploy',
    text: 'Deploy updated service configuration and reload daemon processes.',
  },
];

export default function AccessRequestForm({ servers = [], onSuccess }) {
  const toast = useToast();
  const [selectedServer, setSelectedServer] = useState('');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedServerObj = servers.find((s) => String(s.id) === String(selectedServer));

  const handleSelectTemplate = (templateText) => {
    setReason(templateText);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedServer) {
      setError('Please select a target server.');
      return;
    }

    if (!reason.trim()) {
      setError('Please enter a business justification for this access request.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await employeeService.createAccessRequest({
        serverId: Number(selectedServer),
        duration: Number(duration),
        reason: reason.trim(),
      });

      toast.success(
        `JIT access request for ${selectedServerObj?.name || 'server'} (${duration}m) submitted!`
      );

      // Reset form
      setSelectedServer('');
      setDuration(30);
      setReason('');

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      console.error('Failed to submit access request:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to submit request.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm">
            🔑
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Request JIT Access</h2>
            <p className="text-[11px] text-slate-400">Zero-Trust temporary ephemeral credentials</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 text-red-200 text-xs rounded-lg border border-red-500/40 flex items-start gap-2">
          <span className="shrink-0 text-sm">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Target Server Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Target Host / Cluster <span className="text-red-400">*</span>
          </label>
          <select
            className="w-full bg-slate-950 border border-slate-750 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
            value={selectedServer}
            onChange={(e) => {
              setSelectedServer(e.target.value);
              setError('');
            }}
            required
          >
            <option value="">Select a target node...</option>
            {Array.isArray(servers) ? (
              servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name} {server.department ? `[${server.department.toUpperCase()}]` : ''} ({server.host}:{server.port})
                </option>
              ))
            ) : (
              <option disabled>No servers available</option>
            )}
          </select>
        </div>

        {/* Selected Server Metadata Preview Card */}
        {selectedServerObj && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{selectedServerObj.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● Reachable
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span className="text-cyan-400">{selectedServerObj.host}:{selectedServerObj.port || 22}</span>
              {selectedServerObj.department && (
                <span className="text-slate-500">• {selectedServerObj.department}</span>
              )}
            </div>
            {selectedServerObj.description && (
              <p className="text-[11px] text-slate-400 italic">{selectedServerObj.description}</p>
            )}
          </div>
        )}

        {/* Duration with Preset Chips */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Access Duration <span className="text-red-400">*</span>
            </label>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {duration} minutes ({Math.round((duration / 60) * 10) / 10}h)
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 mb-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setDuration(p.value)}
                className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded-lg transition border cursor-pointer ${
                  Number(duration) === p.value
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min="5"
            max="480"
            step="5"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Justification with Templates */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Business Justification <span className="text-red-400">*</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              {reason.length}/250 chars
            </span>
          </div>

          {/* Quick Justification Chips */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REASON_TEMPLATES.map((t) => (
              <button
                key={t.chip}
                type="button"
                onClick={() => handleSelectTemplate(t.text)}
                className={`px-2 py-1 text-[11px] rounded-md transition border cursor-pointer ${
                  reason === t.text
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold'
                    : 'bg-slate-950/70 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
                title="Click to apply template"
              >
                {t.chip}
              </button>
            ))}
          </div>

          <textarea
            className="w-full bg-slate-950 border border-slate-750 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
            rows="3"
            maxLength="250"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder="Describe reason for elevated access and related incident/ticket..."
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition shadow-lg shadow-blue-950/50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin text-sm">⟳</span>
              <span>Submitting Request...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Submit Access Request</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
