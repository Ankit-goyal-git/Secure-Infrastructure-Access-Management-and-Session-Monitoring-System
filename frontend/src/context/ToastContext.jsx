import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter;
    const newToast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 5000),
    warning: (msg, dur) => addToast(msg, 'warning', dur ?? 4500),
    info: (msg, dur) => addToast(msg, 'info', dur),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => {
          const bgStyles = {
            success: 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50',
            error: 'bg-red-950/95 border-red-500/80 text-red-100 shadow-red-950/50',
            warning: 'bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-amber-950/50',
            info: 'bg-slate-900/95 border-blue-500/80 text-blue-100 shadow-slate-950/50',
          }[t.type] || 'bg-slate-900/95 border-slate-700 text-slate-100';

          const icon = {
            success: '✓',
            error: '✕',
            warning: '⚠️',
            info: 'ℹ️',
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start justify-between p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in ${bgStyles}`}
              role="alert"
            >
              <div className="flex items-start gap-2.5">
                <span className="font-bold text-sm shrink-0 mt-0.5">{icon}</span>
                <p className="text-xs font-medium leading-relaxed">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="ml-3 text-slate-400 hover:text-white transition p-1 -mr-1 -mt-1 cursor-pointer shrink-0"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      success: (msg) => console.log('[Toast success]:', msg),
      error: (msg) => console.error('[Toast error]:', msg),
      warning: (msg) => console.warn('[Toast warning]:', msg),
      info: (msg) => console.info('[Toast info]:', msg),
      dismiss: () => {},
    };
  }
  return context;
}

