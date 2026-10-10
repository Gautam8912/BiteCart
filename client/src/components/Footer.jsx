/**
 * Footer with real, working links to every information page — no dead anchors.
 */
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Icon } from './ui/index.jsx';

export default function Footer() {
  const { config } = useApp();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: 'Shop',
      links: [
        ['/', 'Home'],
        ['/categories', 'All categories'],
        ['/category/groceries', 'Groceries'],
        ['/category/fruits-vegetables', 'Fruits & vegetables'],
        ['/category/dairy-bakery', 'Dairy & bakery'],
        ['/category/electronics', 'Electronics'],
        ['/restaurants', 'Restaurants'],
      ],
    },
    {
      title: 'Account',
      links: [
        ['/account', 'My account'],
        ['/orders', 'Order history'],
        ['/wishlist', 'Wishlist'],
        ['/account/addresses', 'Saved addresses'],
        ['/account/coupons', 'Coupons & rewards'],
        ['/notifications', 'Notifications'],
      ],
    },
    {
      title: 'Help & policies',
      links: [
        ['/help', 'Help center'],
        ['/support', 'Contact support'],
        ['/faq', 'FAQs'],
        ['/policy/shipping', 'Shipping & delivery'],
        ['/policy/cancellation', 'Cancellation & refunds'],
        ['/policy/privacy', 'Privacy policy'],
        ['/policy/terms', 'Terms & conditions'],
        ['/about', 'About us'],
      ],
    },
  ];

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="logo" style={{ color: '#fff', marginBottom: 12 }}>
              <span className="logo-mark" aria-hidden="true">{Icon.leaf}</span>
              <span className="logo-text"><b style={{ color: '#fff' }}>Food Express</b><span>Minutes, not days</span></span>
            </Link>
            <p style={{ fontSize: 14, color: '#a9b4c0', maxWidth: '38ch' }}>
              Groceries, fresh produce, restaurant meals and daily essentials from stores and
              kitchens near you. Built as a demonstration platform.
            </p>
            <p style={{ fontSize: 13, color: '#8b97a3' }}>
              Support: {config?.supportEmail ?? 'support@foodexpress.example'}
              <br />{config?.supportPhone ?? '1800-000-0000'} (demo line)
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(([to, label]) => (
                  <li key={to}><Link to={to}>{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>© {year} Food Express. Demo application — legal pages are draft business content, not reviewed advice.</span>
          <span>
            {config ? `${config.counts.products} products · ${config.counts.restaurants} restaurants · ${config.counts.cities} cities configured` : ''}
          </span>
        </div>
      </div>
    </footer>
  );
}
