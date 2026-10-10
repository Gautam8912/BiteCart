/**
 * Toast notifications. Used for every user-facing success/failure so nothing
 * important happens silently — and so failures never look like successes.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((message, { type = 'info', duration = 3600, action } = {}) => {
    const id = `t${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
    setToasts((list) => [...list.slice(-3), { id, message, type, action }]);
    if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    toast: push,
    success: (m, o) => push(m, { ...o, type: 'success' }),
    error: (m, o) => push(m, { ...o, type: 'error', duration: 5200 }),
    info: (m, o) => push(m, { ...o, type: 'info' }),
    dismiss,
  }), [push, dismiss]);

  const icons = { success: '✓', error: '⚠', info: 'ℹ' };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span aria-hidden="true">{icons[t.type]}</span>
            <div className="grow">
              <div>{t.message}</div>
              {t.action && (
                <button type="button" className="link-btn" style={{ color: '#fff', textDecoration: 'underline' }} onClick={() => { t.action.onClick(); dismiss(t.id); }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
