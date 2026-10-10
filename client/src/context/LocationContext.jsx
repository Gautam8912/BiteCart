/**
 * Delivery location: selected city + locality, persisted per browser.
 *
 * Honesty requirement: the city's real coverage `status` travels with the
 * selection, and the UI shows it verbatim. We never claim a city is served
 * when the configured status says otherwise.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Endpoints } from '../api/client.js';

const LocationContext = createContext(null);
const STORAGE_KEY = 'fe.location.v1';
const RECENT_KEY = 'fe.recent-locations.v1';

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function LocationProvider({ children }) {
  const [cities, setCities] = useState([]);
  const [selected, setSelected] = useState(() => readStorage(STORAGE_KEY, null));
  const [recent, setRecent] = useState(() => readStorage(RECENT_KEY, []));
  const [loading, setLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await Endpoints.cities();
      setCities(items);
      setSelected((prev) => {
        // Re-bind the stored selection to fresh city data (status/eta may change).
        const match = prev && items.find((c) => c.name === prev.city);
        return match ? { ...match, locality: prev.locality || match.localities?.[0] } : (items[0] || null);
      });
    } catch (err) {
      setError(err.message || 'Could not load delivery locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ city: selected.name, locality: selected.locality })); } catch { /* storage full/blocked */ }
    }
  }, [selected]);

  const chooseCity = useCallback((city, locality) => {
    const next = { ...city, locality: locality || city.localities?.[0] || city.name };
    setSelected(next);
    setRecent((list) => {
      const filtered = list.filter((r) => !(r.city === next.city && r.locality === next.locality));
      return [next, ...filtered].slice(0, 5);
    });
    setSelectorOpen(false);
  }, []);

  const value = useMemo(() => ({
    cities, selected, recent, loading, error, retry: load,
    selectorOpen, setSelectorOpen, chooseCity,
    isServiceable: !!selected && selected.status !== 'coming-soon',
  }), [cities, selected, recent, loading, error, load, selectorOpen, chooseCity]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
}
