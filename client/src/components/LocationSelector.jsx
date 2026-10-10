/**
 * Location selector modal: search localities/PIN codes, pick a city, or reuse a
 * recent selection. Saved addresses appear for signed-in users.
 *
 * GPS is optional: if the user denies permission (or the browser has none) we
 * say so plainly and fall back to manual selection instead of guessing.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from '../context/LocationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Endpoints } from '../api/client.js';
import { Modal, Alert, Icon } from './ui/index.jsx';

export default function LocationSelector() {
  const { selectorOpen, setSelectorOpen, cities, selected, recent, chooseCity, loading, error, retry } = useLocation();
  const { user } = useAuth();
  const { setDrawerOpen } = useCart();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [geoState, setGeoState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (!selectorOpen) return;
    setQ('');
    setResults(null);
    if (user) Endpoints.addresses().then((r) => setAddresses(r.items)).catch(() => setAddresses([]));
  }, [selectorOpen, user]);

  useEffect(() => {
    if (!selectorOpen) return undefined;
    const term = q.trim();
    if (term.length < 2) { setResults(null); return undefined; }
    const t = setTimeout(async () => {
      try { setResults(await Endpoints.locationSearch(term)); } catch { setResults(null); }
    }, 200);
    return () => clearTimeout(t);
  }, [q, selectorOpen]);

  const grouped = useMemo(() => {
    const map = new Map();
    cities.forEach((c) => {
      const list = map.get(c.status) || [];
      list.push(c);
      map.set(c.status, list);
    });
    return [...map.entries()];
  }, [cities]);

  const statusOrder = { 'live-simulated': 0, limited: 1, 'coming-soon': 2 };
  grouped.sort((a, b) => statusOrder[a[0]] - statusOrder[b[0]]);

  const useGps = () => {
    if (!navigator.geolocation) {
      setGeoState({ status: 'error', message: 'This browser does not support location services. Please choose your city manually.' });
      return;
    }
    setGeoState({ status: 'loading', message: 'Asking for your location…' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // No reverse-geocoding provider is configured, so we cannot turn
        // coordinates into a city. Be honest about it rather than guessing.
        setGeoState({
          status: 'error',
          message: `Location captured (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}), but this build has no geocoding provider configured to convert coordinates into a city. Please pick your city below.`,
        });
      },
      (err) => {
        setGeoState({
          status: 'error',
          message: err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. You can still choose your city manually below.'
            : 'We could not read your location. Please choose your city manually below.',
        });
      },
      { timeout: 8000 },
    );
  };

  const pickCityFromResult = (r) => {
    const city = cities.find((c) => c.name === r.city);
    if (city) chooseCity(city, r.locality || r.pincode || undefined);
  };

  return (
    <Modal open={selectorOpen} onClose={() => setSelectorOpen(false)} title="Choose delivery location" size={620}>
      <div className="col" style={{ gap: 16 }}>
        <div className="field">
          <label className="field-label" htmlFor="loc-search">Search city, locality or PIN code</label>
          <div className="search-bar">
            <span style={{ color: 'var(--fe-text-3)' }} aria-hidden="true">{Icon.search}</span>
            <input id="loc-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Benz Circle, 520010, Hyderabad" autoComplete="off" />
          </div>
        </div>

        {geoState.message && (
          <Alert tone={geoState.status === 'error' ? 'warning' : 'info'}>{geoState.message}</Alert>
        )}

        <div className="row wrap">
          <button type="button" className="btn btn-secondary btn-sm" onClick={useGps} disabled={geoState.status === 'loading'}>
            {Icon.pin} {geoState.status === 'loading' ? 'Locating…' : 'Use my location'}
          </button>
          <span className="small muted">Location services are optional.</span>
        </div>

        {error && <Alert tone="danger">{error} <button type="button" className="link-btn" onClick={retry}>Retry</button></Alert>}

        {results && (
          <div className="col" style={{ gap: 8 }}>
            <h4 className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Matches</h4>
            {results.items.length === 0 && <p className="small muted">No configured delivery area matches “{q}”.</p>}
            {results.items.map((r, i) => (
              <button type="button" key={`${r.type}-${r.city}-${r.locality ?? r.pincode ?? i}`} className="loc-result"
                onClick={() => pickCityFromResult(r)} disabled={r.status === 'coming-soon'}
                style={r.status === 'coming-soon' ? { opacity: .6 } : undefined}>
                <span style={{ textAlign: 'left', minWidth: 0 }}>
                  <b className="truncate" style={{ display: 'block' }}>
                    {r.type === 'city' ? r.city : `${r.locality || r.pincode}, ${r.city}`}
                  </b>
                  <span className="tiny muted">{r.state} · {r.eta}</span>
                </span>
                <span className={r.status === 'coming-soon' ? 'badge badge-neutral' : 'badge'}>{r.statusLabel}</span>
              </button>
            ))}
          </div>
        )}

        {!results && addresses.length > 0 && (
          <div className="col" style={{ gap: 8 }}>
            <div className="row-between">
              <h4 className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Saved addresses</h4>
              <Link to="/account/addresses" className="small" onClick={() => setSelectorOpen(false)}>Manage</Link>
            </div>
            {addresses.map((a) => (
              <button type="button" key={a.id} className="loc-result"
                onClick={() => {
                  const city = cities.find((c) => c.name === a.city);
                  if (city) chooseCity(city, a.landmark || a.line1);
                }}>
                <span style={{ textAlign: 'left', minWidth: 0 }}>
                  <b className="truncate" style={{ display: 'block' }}>{a.label} — {a.line1}</b>
                  <span className="tiny muted truncate">{a.city} {a.pincode}</span>
                </span>
                {a.isDefault && <span className="badge">Default</span>}
              </button>
            ))}
          </div>
        )}

        {!results && recent.length > 0 && (
          <div>
            <h4 className="muted mb-2" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Recent</h4>
            <div className="chips">
              {recent.map((r) => (
                <button type="button" key={`${r.city}-${r.locality}`} className="chip"
                  onClick={() => {
                    const city = cities.find((c) => c.name === r.city);
                    if (city) chooseCity(city, r.locality);
                  }}>
                  {r.locality || r.city}
                </button>
              ))}
            </div>
          </div>
        )}

        {!results && (
          <div className="col" style={{ gap: 12 }}>
            {loading ? (
              <p className="small muted">Loading delivery locations…</p>
            ) : (
              grouped.map(([status, list]) => (
                <div key={status}>
                  <div className="row-between mb-2">
                    <h4 className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {list[0].statusLabel}
                    </h4>
                    <span className="tiny muted">{list.length} cities</span>
                  </div>
                  <div className="city-grid">
                    {list.map((c) => (
                      <button type="button" key={c.id} className="city-card"
                        aria-pressed={selected?.name === c.name}
                        disabled={c.status === 'coming-soon'}
                        style={c.status === 'coming-soon' ? { opacity: .55, cursor: 'not-allowed' } : undefined}
                        onClick={() => chooseCity(c)}>
                        <b>{c.name}</b>
                        <span>{c.etaMin}–{c.etaMax} min</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selected && (
          <Alert tone={selected.status === 'coming-soon' ? 'warning' : 'success'}>
            <b>{selected.name}</b> — {selected.statusLabel}. Estimated delivery {selected.etaMin}–{selected.etaMax} minutes
            for configured PIN codes. This is a demo platform: no live delivery is dispatched.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
