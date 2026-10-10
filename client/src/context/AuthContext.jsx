/**
 * Session state. The source of truth is always GET /api/auth/me — the client
 * never decides whether someone is signed in or an admin from localStorage.
 * Guest browsing is fully supported: user === null just means "not signed in".
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Endpoints } from '../api/client.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await Endpoints.me();
      setUser(me);
      setStatus('ready');
      return me;
    } catch {
      setUser(null);
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (identifier, password) => {
    const res = await Endpoints.login({ identifier, password });
    setUser(res.user);
    setStatus('ready');
    return res;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await Endpoints.register(payload);
    setUser(res.user);
    setStatus('ready');
    return res;
  }, []);

  const logout = useCallback(async () => {
    try { await Endpoints.logout(); } finally {
      setUser(null);
      toast.info('Signed out.');
    }
  }, [toast]);

  const updateProfile = useCallback(async (patch) => {
    const res = await Endpoints.updateProfile(patch);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(() => ({
    user, status, isAdmin: user?.role === 'admin', isAuthenticated: !!user,
    refresh, login, register, logout, updateProfile, setUser,
  }), [user, status, refresh, login, register, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
