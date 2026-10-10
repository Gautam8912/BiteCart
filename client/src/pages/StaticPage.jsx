/**
 * Static content pages (About + legal).
 *
 * Legal copy is DRAFT business content written for this demo. It is labelled as
 * such on the page and is not a substitute for reviewed legal advice.
 */
import { Link } from 'react-router-dom';
import { Breadcrumbs, Alert } from '../components/ui/index.jsx';

const PAGES = {
  about: {
    title: 'About Food Express',
    draft: false,
    body: (
      <>
        <p>
          Food Express is a demonstration platform that brings groceries, fresh produce, restaurant
          meals and daily essentials into a single shopping experience. It was built to show what a
          production-shaped quick-commerce product looks like end to end — catalogue, cart, checkout,
          orders, account management and an admin console.
        </p>
        <h2>What is real in this build</h2>
        <ul>
          <li>A server-side catalogue of 219 products across 10 categories, plus 12 restaurants and 119 menu items.</li>
          <li>Real authentication with bcrypt-hashed passwords and JWT sessions in httpOnly cookies.</li>
          <li>Server-side cart, coupon, tax and delivery-fee calculation — the client never decides a total.</li>
          <li>Role-checked admin APIs with an audit log.</li>
        </ul>
        <h2>What is simulated</h2>
        <ul>
          <li>Payments: no gateway is connected. Demo methods are labelled and never move money.</li>
          <li>Order tracking: statuses advance by simulation; there is no courier or GPS integration.</li>
          <li>Ratings and reviews: generated sample values, labelled as demo data everywhere they appear.</li>
          <li>Delivery coverage: cities carry an explicit status; nothing claims live service where none is configured.</li>
          <li>Notifications: in-app only, with no push, email or SMS provider.</li>
        </ul>
        <h2>Architecture</h2>
        <p>
          React (Vite) on the front end, Express on the server, SQLite for storage. The client talks to
          the API over same-origin requests in both development and production, so session cookies stay
          first-party. See the project README for setup, environment variables and the configuration
          still required to go live.
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    draft: true,
    body: (
      <>
        <h2>1. What we collect</h2>
        <p>Account details (name, email, optional mobile), delivery addresses, order history, wishlist entries and in-app notification state. Passwords are stored only as bcrypt hashes.</p>
        <h2>2. How we use it</h2>
        <p>To fulfil orders, calculate delivery charges, apply coupons, show your order history and operate the admin console.</p>
        <h2>3. What we do not store</h2>
        <p>No real card numbers. Saved payment methods keep only a brand name and the last four digits, for display in this demo.</p>
        <h2>4. Cookies and local storage</h2>
        <p>An httpOnly session cookie identifies you. A non-secret guest cookie keys an anonymous cart. Local storage holds recently viewed items, recent searches, your chosen delivery city and a guest wishlist.</p>
        <h2>5. Demo-build notice</h2>
        <p>This is a demonstration deployment. It has no data processor agreements, no analytics provider and no third-party trackers. Before real launch this policy must be reviewed and completed by a qualified professional, including disclosure of any real payment processor and analytics tools you add.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms &amp; Conditions',
    draft: true,
    body: (
      <>
        <h2>1. Scope</h2>
        <p>These terms govern use of the Food Express demonstration platform. They are draft business content prepared for this build.</p>
        <h2>2. Accounts</h2>
        <p>You are responsible for keeping your credentials confidential and for activity under your account. Accounts with a customer role cannot access administrative functions.</p>
        <h2>3. Orders and pricing</h2>
        <p>Prices are shown in Indian rupees. Totals are computed on the server at order placement. If an item becomes unavailable between adding it to your cart and checkout, the order is blocked until the item is removed.</p>
        <h2>4. Coupons</h2>
        <p>Coupons carry minimum-spend, category, expiry and per-user limits which the server enforces. Seeded coupons are demo promotions with no monetary value.</p>
        <h2>5. Demo limitations</h2>
        <p>No real goods are dispatched, no real payments are processed and no delivery partner is engaged by this build. Nothing here constitutes an offer to sell.</p>
      </>
    ),
  },
  shipping: {
    title: 'Shipping &amp; Delivery Policy',
    draft: true,
    body: (
      <>
        <h2>Delivery zones</h2>
        <p>Cities are configured with an explicit status: <b>simulated live coverage</b>, <b>limited coverage</b> or <b>coming soon</b>. The location selector shows the real status, and checkout refuses addresses in a coming-soon city.</p>
        <h2>Free delivery threshold</h2>
        <p>Delivery is free when the eligible merchandise subtotal reaches ₹150. Only merchandise counts — delivery fees, handling fees and taxes never contribute to the threshold. Below ₹150 a ₹29 delivery fee applies.</p>
        <p>Both figures are stored in application settings and can be changed from the admin dashboard without a code change. Some cities add their own minimum delivery charge, which is shown separately on the bill.</p>
        <h2>Estimated times</h2>
        <p>Estimates come from the configured zone (12–28 minutes for groceries, 18–40 for restaurants). They are planning figures, not a guarantee.</p>
        <h2>Order separation</h2>
        <p>An order can contain items from one restaurant plus grocery items. A second restaurant cannot be added to the same order.</p>
        <h2>Demo notice</h2>
        <p>No physical delivery takes place in this build.</p>
      </>
    ),
  },
  cancellation: {
    title: 'Cancellation &amp; Refund Policy',
    draft: true,
    body: (
      <>
        <h2>Cancelling an order</h2>
        <p>You can cancel while an order is still placed, confirmed, packing or preparing. Once it is out for delivery, cancellation is no longer available.</p>
        <h2>What happens on cancellation</h2>
        <ul>
          <li>Reserved stock is released back into the catalogue.</li>
          <li>Any coupon used is returned to your account, subject to its own limits.</li>
          <li>Loyalty points earned on the order are reversed.</li>
        </ul>
        <h2>Refunds</h2>
        <p>Cash-on-delivery orders have nothing to refund because no payment was taken. Orders paid with the demo payment method did not move real money, so no refund is processed.</p>
        <h2>When a real payment gateway is connected</h2>
        <p>Refunds must be issued through the same gateway and verified server-side. The frontend must never be able to declare a refund successful on its own.</p>
        <h2>Damaged or wrong items</h2>
        <p>Fresh and chilled items should be reported within 24 hours of delivery; other categories within 7 days if unopened.</p>
      </>
    ),
  },
};

export default function StaticPage({ name }) {
  const page = PAGES[name] || PAGES.about;
  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: page.title.replace('&amp;', '&') }]} />
      <article className="card card-pad-lg" style={{ maxWidth: 860 }}>
        <h1 className="mb-3" dangerouslySetInnerHTML={{ __html: page.title }} />
        {page.draft && (
          <Alert tone="warning" className="mb-4">
            <span className="grow">
              <b>Draft business content.</b> This page was written for a demonstration build and has not
              been reviewed by a qualified professional. Replace it before using it commercially.
            </span>
          </Alert>
        )}
        <div className="prose">{page.body}</div>
        <hr className="divider" />
        <p className="small muted">
          Questions? <Link to="/support">Contact support</Link> or read the <Link to="/help">help center</Link>.
        </p>
      </article>
    </div>
  );
}
