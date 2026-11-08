import React, { useState, useEffect } from 'react';
import { serverService } from '../../services/serverService';

const DEPARTMENTS = [
  { id: 'engineering', label: 'Engineering' },
  { id: 'infrastructure', label: 'Infrastructure & SRE' },
  { id: 'finance', label: 'Finance & Payments' },
  { id: 'security', label: 'Security & Compliance' },
];

export default function ServerModal({ isOpen, onClose, serverToEdit, onSaveSuccess }) {
  const isEdit = Boolean(serverToEdit?.id);

  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    department: 'engineering',
    status: 'active',
    description: '',
    sshUsername: 'employee',
    sshPassword: '',
    sshKey: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Diagnostics test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (serverToEdit) {
      setFormData({
        name: serverToEdit.name || '',
        host: serverToEdit.host || '',
        port: serverToEdit.port || 22,
        department: serverToEdit.department || 'engineering',
        status: serverToEdit.status || 'active',
        description: serverToEdit.description || '',
        sshUsername: serverToEdit.sshUsername || 'employee',
        sshPassword: '', // Don't pre-fill password for security
        sshKey: '',
      });
    } else {
      setFormData({
        name: '',
        host: '',
        port: 22,
        department: 'engineering',
        status: 'active',
        description: '',
        sshUsername: 'employee',
        sshPassword: '',
        sshKey: '',
      });
    }
    setError('');
    setTestResult(null);
  }, [serverToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTestConnection = async () => {
    if (!formData.host) {
      setError('Please provide a host or IP address before testing connectivity.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError('');

    try {
      const result = await serverService.testConnection(
        formData.host.trim(),
        parseInt(formData.port, 10) || 22
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.error || err.message || 'Connectivity check failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        host: formData.host.trim(),
        port: parseInt(formData.port, 10) || 22,
        department: formData.department,
        status: formData.status,
        description: formData.description.trim() || null,
        sshUsername: formData.sshUsername.trim() || 'employee',
      };

      if (formData.sshPassword) {
        payload.sshPassword = formData.sshPassword;
      }
      if (formData.sshKey) {
        payload.sshKey = formData.sshKey;
      }

      if (isEdit) {
        await serverService.updateServer(serverToEdit.id, payload);
      } else {
        await serverService.createServer(payload);
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to save server node.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/90">
          <div>
            <h3 className="text-xl font-bold text-white">
              {isEdit ? `Edit Server: ${serverToEdit.name}` : 'Provision New Server Node'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure dynamic upstream target routing and authentication credentials.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl p-1 rounded-md hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Server Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. core-redis-cluster"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Department / Team *
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Host / IP */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Hostname or IP Address *
              </label>
              <input
                type="text"
                name="host"
                required
                value={formData.host}
                onChange={handleChange}
                placeholder="e.g. target-server or 10.0.1.20"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Port */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                SSH Port *
              </label>
              <input
                type="number"
                name="port"
                required
                min="1"
                max="65535"
                value={formData.port}
                onChange={handleChange}
                placeholder="22"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Operational Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Initial Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="active">Active (Available for Requests)</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Upstream SSH Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Target SSH Username
              </label>
              <input
                type="text"
                name="sshUsername"
                value={formData.sshUsername}
                onChange={handleChange}
                placeholder="employee"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Description / Purpose
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g. Primary analytics processing node for billing department"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Credentials Section */}
          <div className="p-4 bg-slate-900/60 border border-slate-700/60 rounded-lg space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Upstream SSH Authentication (Stored Securely)</span>
              {isEdit && (
                <span className="text-[11px] font-normal text-amber-400 lowercase">
                  (Leave blank to keep existing credentials)
                </span>
              )}
            </h4>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Target SSH Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="sshPassword"
                  value={formData.sshPassword}
                  onChange={handleChange}
                  placeholder={isEdit && serverToEdit.hasPassword ? '•••••••• (Preserved)' : 'Enter SSH password'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Target SSH Private Key (PEM/OpenSSH)</label>
              <textarea
                name="sshKey"
                rows="2"
                value={formData.sshKey}
                onChange={handleChange}
                placeholder={isEdit && serverToEdit.hasKey ? '-----BEGIN RSA PRIVATE KEY----- (Preserved)' : 'Optional PEM key'}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Live Connectivity Diagnostic Box */}
          <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1">
              <span className="text-xs font-semibold text-slate-300 block">Pre-flight Reachability Probe</span>
              {testResult ? (
                <div
                  className={`text-xs mt-1 font-mono flex items-center gap-2 ${
                    testResult.success ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <span>{testResult.success ? '●' : '▲'}</span>
                  <span>
                    {testResult.success
                      ? testResult.message
                      : `Failed: ${testResult.error || 'Host unreachable'}`}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify network reachability and SSH service banner before registering.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.host}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-md transition whitespace-nowrap"
            >
              {isTesting ? 'Pinging Host...' : '⚡ Test Connectivity'}
            </button>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-md transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-md shadow-lg transition"
            >
              {isSubmitting ? 'Saving Node...' : isEdit ? 'Update Server' : 'Provision Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

