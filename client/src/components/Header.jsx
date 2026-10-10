/**
 * Site header: logo, delivery location, search with live suggestions,
 * notifications, wishlist, account menu and a live cart button.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useLocation } from '../context/LocationContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { Endpoints } from '../api/client.js';
import {Icon} from './ui/index.jsx';
import {classNames,debounce,formatInr,initialsOf} from '../utils/format.js';

const RECENT_KEY = 'fe.recent-searches.v1';

export default function Header() {
  const { user, logout } = useAuth();
  const { count, setDrawerOpen, bill, isEmpty } = useCart();
  const wishlist = useWishlist();
  const { selected, setSelectorOpen } = useLocation();
  const { config } = useApp();
  const navigate = useNavigate();

  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [suggest, setSuggest] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
  });
  const boxRef = useRef(null);
  const menuRef = useRef(null);

  const fetchSuggest = useRef(debounce(async (q) => {
    if (q.trim().length < 2) { setSuggest(null); return; }
    try { setSuggest(await Endpoints.suggest(q)); } catch { setSuggest(null); }
  }, 220)).current;

  useEffect(() => {
    if (term.trim().length >= 2) fetchSuggest(term);
    else setSuggest(null);
  }, [term, fetchSuggest]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setMenuOpen(false); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const commitSearch = (value) => {
    const q = String(value || '').trim();
    if (!q) return;
    const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setOpen(false);
    setTerm('');
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
  };

  const totalLabel = bill?.totalPaise ? formatInr(bill.totalPaise) : '0 items';

  return (
    <header className="header">
      <div className="container header-inner">
        <button type="button" className="back-btn" aria-label="Go back"
          onClick={() => {
            if (window.history.state?.idx > 0) navigate(-1);
            else navigate('/');
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <Link to="/" className="logo" aria-label="Food Express home">
          <span className="logo-mark" aria-hidden="true">{Icon.leaf}</span>
          <span className="logo-text">
            <b>Food Express</b>
            <span>Minutes, not days</span>
          </span>
        </Link>

        <button type="button" className="loc-btn" onClick={() => setSelectorOpen(true)}
          aria-label={`Delivery location: ${selected?.name ?? 'Select a city'}`}>
          <span style={{ color: 'var(--fe-primary)' }} aria-hidden="true">{Icon.pin}</span>
          <span style={{ minWidth: 0 }}>
            <span className="loc-city truncate">{selected?.name ?? 'Select city'}</span>
            <span className="loc-area truncate">{selected?.locality ?? 'Choose your area'}</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--fe-text-3)', fontSize: 11 }}>▾</span>
        </button>

        <div className="search-wrap" ref={boxRef}>
          <form className="search-bar" role="search" onSubmit={(e) => { e.preventDefault(); commitSearch(term); }}>
            <span style={{ color: 'var(--fe-text-3)' }} aria-hidden="true">{Icon.search}</span>
            <input
              type="search"
              value={term}
              placeholder="Search for atta, milk, biryani, restaurants…"
              aria-label="Search products and restaurants"
              autoComplete="off"
              onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
            />
          </form>

          {open && (
            <div className="search-suggest" role="listbox" aria-label="Search suggestions">
              {suggest?.products?.length > 0 && (
                <div className="suggest-group">
                  <div className="suggest-title">Products</div>
                  {suggest.products.map((p) => (
                    <button type="button" key={p.slug} className="suggest-item"
                      onClick={() => { setOpen(false); setTerm(''); navigate(`/product/${p.slug}`); }}>
                      <img src={`/api/images/${p.slug}.svg`} alt="" />
                      <span className="grow truncate" style={{ textAlign: 'left' }}>{p.name}</span>
                      <span className="muted small nowrap">{formatInr(p.price_paise)}</span>
                    </button>
                  ))}
                </div>
              )}

              {suggest?.restaurants?.length > 0 && (
                <div className="suggest-group">
                  <div className="suggest-title">Restaurants</div>
                  {suggest.restaurants.map((r) => (
                    <button type="button" key={r.slug} className="suggest-item"
                      onClick={() => { setOpen(false); setTerm(''); navigate(`/restaurant/${r.slug}`); }}>
                      <span aria-hidden="true">🍽</span>
                      <span className="grow truncate" style={{ textAlign: 'left' }}>{r.name}</span>
                      <span className="muted small">{r.cuisines}</span>
                    </button>
                  ))}
                </div>
              )}

              {suggest?.dishes?.length > 0 && (
                <div className="suggest-group">
                  <div className="suggest-title">Dishes</div>
                  {suggest.dishes.map((d) => (
                    <button type="button" key={`${d.restaurant_slug}-${d.slug}`} className="suggest-item"
                      onClick={() => { setOpen(false); setTerm(''); navigate(`/restaurant/${d.restaurant_slug}`); }}>
                      <span aria-hidden="true">🥘</span>
                      <span className="grow truncate" style={{ textAlign: 'left' }}>{d.name}</span>
                      <span className="muted small truncate">{d.restaurant_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {!suggest && recent.length > 0 && (
                <div className="suggest-group">
                  <div className="suggest-title row-between" style={{ paddingRight: 14 }}>
                    <span>Recent searches</span>
                    <button type="button" className="link-btn" onClick={clearRecent}>Clear</button>
                  </div>
                  <div className="suggest-recent">
                    {recent.map((r) => (
                      <button key={r} type="button" className="chip" onClick={() => commitSearch(r)}>{r}</button>
                    ))}
                  </div>
                </div>
              )}

              {!suggest && recent.length === 0 && (
                <div className="suggest-group">
                  <div className="suggest-title">Try searching</div>
                  <div className="suggest-recent">
                    {['Atta', 'Milk', 'Biryani', 'Shampoo', 'Power bank', 'Paneer'].map((s) => (
                      <button key={s} type="button" className="chip" onClick={() => commitSearch(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="header-actions">
          {user && (
            <NavLink to="/notifications" className="icon-btn" aria-label="Notifications" title="Notifications">
              {Icon.bell}
            </NavLink>
          )}
          <NavLink to="/wishlist" className="icon-btn" aria-label={`Wishlist, ${wishlist.count} items`} title="Wishlist">
            {Icon.heart(false)}
            {wishlist.count > 0 && <span className="count">{wishlist.count}</span>}
          </NavLink>

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button type="button" className="icon-btn" onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu"
                title={user.name}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="" className="avatar" style={{ width: 30, height: 30 }} />
                  : <span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initialsOf(user.name)}</span>}
              </button>
              {menuOpen && (
                <div className="card" role="menu" style={{ position: 'absolute', right: 0, top: 44, minWidth: 220, padding: 8, zIndex: 70, boxShadow: 'var(--fe-shadow-lg)' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--fe-border)', marginBottom: 6 }}>
                    <div className="bold truncate">{user.name}</div>
                    <div className="tiny muted truncate">{user.email || user.mobile}</div>
                  </div>
                  {[
                    ['/account', 'My account'],
                    ['/orders', 'My orders'],
                    ['/wishlist', 'Wishlist'],
                    ['/account/addresses', 'Saved addresses'],
                    ['/account/coupons', 'Coupons & rewards'],
                    ...(user.role === 'admin' ? [['/admin', 'Admin dashboard']] : []),
                  ].map(([to, label]) => (
                    <Link key={to} to={to} role="menuitem" onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', padding: '9px 10px', borderRadius: 8, color: 'var(--fe-text)', fontSize: 14 }}>
                      {label}
                    </Link>
                  ))}
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); logout(); navigate('/'); }}
                    className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6 }}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-sm btn-secondary">Sign in</Link>
          )}

          <button type="button" className="cart-btn" onClick={() => setDrawerOpen(true)}
            disabled={isEmpty} aria-label={`Cart, ${count} items, ${totalLabel}`}>
            {Icon.cart}
            <span>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, opacity: .9 }}>
                {count} item{count === 1 ? '' : 's'}
              </span>
              <span style={{ display: 'block', fontSize: 13, lineHeight: 1.1 }}>{totalLabel}</span>
            </span>
          </button>
        </div>
      </div>

      {config?.demoMode && (
        <div style={{ background: '#fff9ee', borderTop: '1px solid #f4ddb8', color: '#7c4a06', fontSize: 12.5, padding: '6px 0' }}>
          <div className="container">
            Demo build — payments and order tracking are simulated. No real money moves and no live delivery is dispatched.
          </div>
        </div>
      )}
    </header>
  );
}
