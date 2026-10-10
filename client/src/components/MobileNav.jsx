/** Floating primary navigation shared by mobile and desktop layouts. */
import { NavLink, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './ui/index.jsx';

export default function MobileNav() {
  const { count } = useCart();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const shopActive = pathname === '/categories' || pathname.startsWith('/category/');

  const items = [
    { to: '/', label: 'Home', icon: Icon.home, end: true },
    { to: '/search', label: 'Search', icon: Icon.search },
    { to: '/categories', label: 'Shop ₹150', icon: Icon.grid, featured: true, active: shopActive },
    { to: '/cart', label: 'Cart', icon: Icon.cart, badge: count },
    { to: user ? '/account' : '/login', label: 'Profile', icon: Icon.user },
  ];

  return (
    <nav className="mobnav" aria-label="Primary navigation">
      {items.map(({ to, label, icon, badge, end, featured, active }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => [featured && 'mobnav-featured', active && 'is-active', isActive && 'is-active'].filter(Boolean).join(' ')}
          aria-current={active ? 'page' : undefined}
          aria-label={badge ? `${label}, ${badge} items` : label}>
          {icon}
          <span>{label}</span>
          {badge > 0 && <span className="badge-dot">{badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
