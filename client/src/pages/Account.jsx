/** Account shell: sidebar navigation + nested account pages via <Outlet/>. */
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Breadcrumbs, Icon } from '../components/ui/index.jsx';
import { initialsOf, formatDate } from '../utils/format.js';

const LINKS = [
  ['/account', 'Profile', '👤'],
  ['/account/addresses', 'Addresses', '📍'],
  ['/orders', 'Orders', '🧾'],
  ['/wishlist', 'Wishlist', '♡'],
  ['/account/coupons', 'Coupons', '🎟'],
  ['/account/rewards', 'Rewards', '⭐'],
  ['/notifications', 'Notifications', '🔔'],
  ['/account/security', 'Privacy & security', '🔒'],
  ['/support', 'Help & support', '🎧'],
];

export default function Account() {
  const { user, logout } = useAuth();

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My account' }]} />

      <div className="card card-pad mb-4" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" className="avatar avatar-lg" />
          : <span className="avatar avatar-lg" aria-hidden="true">{initialsOf(user.name)}</span>}
        <div className="grow" style={{ minWidth: 200 }}>
          <h1 style={{ fontSize: 22 }}>{user.name}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {user.email || user.mobile}
            {user.role === 'admin' && <> · <span className="badge">Administrator</span></>}
          </p>
          <p className="tiny muted" style={{ margin: '4px 0 0' }}>
            Member since {formatDate(user.createdAt)} · {user.loyaltyPoints} loyalty points
          </p>
        </div>
        <div className="row wrap">
          {user.role === 'admin' && <Link to="/admin" className="btn btn-secondary btn-sm">Admin dashboard</Link>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="account-layout">
        <nav className="card card-pad account-nav" aria-label="Account sections">
          {LINKS.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/account'}>
              <span aria-hidden="true">{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
