/**
 * Application bootstrap.
 *
 * Owns /api/config (thresholds, demo flags, catalogue counts) and the
 * onboarding splash. The splash is gated on REAL work — config + categories +
 * the first product rail — and is shown once per browser session, never on
 * every navigation. A failure surfaces a retry instead of a spinner forever.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Endpoints } from '../api/client.js';
import { useLocation } from './LocationContext.jsx';

const AppContext = createContext(null);
const SEEN_KEY = 'fe.onboarding-seen.v1';

export function AppProvider({ children }) {
  const { cities, selected } = useLocation();
  const [config, setConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  const hasSeenOnboarding = (() => {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
  })();
  const [showSplash, setShowSplash] = useState(!hasSeenOnboarding);

  const boot = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setProgress(12);
    try {
      const cfg = await Endpoints.config();
      setConfig(cfg);
      setProgress(38);

      const cats = await Endpoints.categories();
      setCategories(cats);
      setProgress(62);

      const rails = await Endpoints.productSections();
      setSections(rails);
      setProgress(92);
    } catch (err) {
      setError(err.message || 'The application could not start.');
      setPhase('error');
      return;
    }
    setProgress(100);
    setPhase('ready');
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  // Rotating messages run only while the splash is visible.
  useEffect(() => {
    if (!showSplash || phase !== 'loading') return undefined;
    const t = setInterval(() => setStepIndex((i) => i + 1), 2600);
    return () => clearInterval(t);
  }, [showSplash, phase]);

  // Fade out shortly after the real data lands (no artificial wait).
  useEffect(() => {
    if (phase !== 'ready' || !showSplash) return undefined;
    const t = setTimeout(() => setShowSplash(false), 420);
    return () => clearTimeout(t);
  }, [phase, showSplash]);

  const dismissSplash = useCallback(() => setShowSplash(false), []);

  const value = useMemo(() => ({
    config, categories, sections, phase, error, boot,
    splash: { visible: showSplash, stepIndex, progress, dismiss: dismissSplash },
    city: selected,
    freeDeliveryThreshold: config?.freeDeliveryThreshold ?? 15000,
  }), [config, categories, sections, phase, error, boot, showSplash, stepIndex, progress, dismissSplash, selected]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
