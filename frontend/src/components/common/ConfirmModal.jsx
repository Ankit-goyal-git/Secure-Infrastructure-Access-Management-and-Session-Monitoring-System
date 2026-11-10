import React, { useEffect } from 'react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'info' | 'success'
  isLoading = false,
  children,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: '⚠️',
      iconBg: 'bg-red-500/10 border-red-500/30 text-red-400',
      btn: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-red-950/50',
      border: 'border-red-500/40',
    },
    warning: {
      icon: '⚠️',
      iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      btn: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-amber-950/50',
      border: 'border-amber-500/40',
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      btn: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-950/50',
      border: 'border-blue-500/40',
    },
    success: {
      icon: '✓',
      iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      btn: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-950/50',
      border: 'border-emerald-500/40',
    },
  }[variant] || {
    icon: '⚠️',
    iconBg: 'bg-red-500/10 border-red-500/30 text-red-400',
    btn: 'bg-red-600 hover:bg-red-500 text-white',
    border: 'border-red-500/40',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
      <div
        className={`relative w-full max-w-md bg-slate-900 border ${variantConfig.border} rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col space-y-4 animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${variantConfig.iconBg} text-xl font-bold shadow-inner`}
          >
            {variantConfig.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Optional Custom Body (e.g. input fields, reason selectors) */}
        {children && <div className="mt-2 text-sm">{children}</div>}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 ${variantConfig.btn} disabled:opacity-50 text-xs font-bold rounded-lg shadow-lg transition flex items-center gap-1.5 cursor-pointer`}
          >
            {isLoading && <span className="animate-spin inline-block text-xs">⟳</span>}
            <span>{isLoading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

