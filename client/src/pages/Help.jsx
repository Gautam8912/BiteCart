/** Help center with FAQs and links to every policy page. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs, Tabs } from '../components/ui/index.jsx';

const FAQS = [
  {
    cat: 'Orders',
    items: [
      ['How fast is delivery?', 'Configured delivery zones show an estimate of 12–28 minutes for groceries and 18–40 minutes for restaurant orders. The estimate on each product and restaurant page reflects the zone you selected.'],
      ['Why is there a ₹150 minimum for free delivery?', 'Free delivery unlocks when your eligible merchandise subtotal reaches ₹150. Delivery fees, handling fees and taxes never count toward that threshold. Below ₹150 a ₹29 delivery fee applies, and the cart shows exactly how much more you need.'],
      ['Can I combine restaurants in one order?', 'No. An order can contain items from one restaurant plus any number of grocery items. The cart blocks a second restaurant and tells you which one is already in the cart.'],
      ['What happens if an item is out of stock?', 'The item is flagged in your cart and checkout is blocked until you remove it. Stock is re-checked on the server when the order is placed.'],
      ['Can I cancel an order?', 'Yes, until it is marked out for delivery. Cancelling releases the reserved stock and refunds any coupon you used.'],
    ],
  },
  {
    cat: 'Payments',
    items: [
      ['Which payment methods work?', 'Cash on delivery and a clearly labelled demo card. The demo card simulates a payment locally — no money moves and no payment gateway is contacted.'],
      ['Is this real payment processing?', 'No. This build has no payment gateway configured. Real card, UPI or netbanking payments require a PSP integration with server-side verification.'],
      ['Do I get a refund for a demo payment?', 'There is nothing to refund because no real money was charged. Demo orders are labelled as such on the order page.'],
    ],
  },
  {
    cat: 'Delivery',
    items: [
      ['Do you deliver to my city?', 'Open the location selector at the top of any page. Cities are grouped by their real configured status: simulated live coverage, limited coverage, or coming soon. A city marked “coming soon” cannot be used for checkout.'],
      ['Why is my PIN code not serviceable?', 'Delivery zones are configured per city. If your PIN code is not in a configured zone, the address form and checkout will tell you rather than accepting an order we cannot fulfil.'],
      ['Is there live tracking?', 'No. Demo orders show simulated status updates. There is no courier or GPS integration, so the page never claims a live position.'],
    ],
  },
  {
    cat: 'Account',
    items: [
      ['Can I shop without an account?', 'Yes. Guest browsing works fully and your cart is stored on the device. Signing in merges the guest cart into your account without duplicating quantities.'],
      ['How do coupons work?', 'Coupons have minimum-spend, category, expiry and per-user limits, all enforced on the server. Every seeded coupon is labelled a demo promotion.'],
      ['Are the product ratings real?', 'No. Ratings in this build are generated sample values and are labelled “demo data” wherever they appear. No customer reviews are fabricated.'],
    ],
  },
];

export default function Help({ initialTab = 'faq' }) {
  const [tab, setTab] = useState(initialTab === 'faq' ? 'faq' : 'help');
  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState('Orders');

  const active = FAQS.find((c) => c.cat === cat) || FAQS[0];

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Help center' }]} />
      <h1 className="mb-2">Help center</h1>
      <p className="muted mb-4">Answers about orders, delivery, payments and your account.</p>

      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'faq', label: 'FAQs' },
          { value: 'help', label: 'Policies & contact' },
        ]} />
      </div>

      {tab === 'faq' ? (
        <div className="filter-layout">
          <aside className="filter-panel card card-pad">
            <h4 className="muted mb-2" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>Topics</h4>
            <div className="col" style={{ gap: 2 }}>
              {FAQS.map((c) => (
                <button type="button" key={c.cat} className="chip" style={{ justifyContent: 'flex-start' }}
                  aria-pressed={cat === c.cat} onClick={() => { setCat(c.cat); setOpen(null); }}>
                  {c.cat} ({c.items.length})
                </button>
              ))}
            </div>
          </aside>

          <div className="card card-pad">
            <h2 className="mb-3">{active.cat}</h2>
            {active.items.map(([q, a], i) => (
              <div key={q} style={{ borderBottom: '1px solid var(--fe-border)', padding: '12px 0' }}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', fontWeight: 600, fontSize: 15, padding: 0 }}
                >
                  {q} <span aria-hidden="true" style={{ float: 'right', color: 'var(--fe-text-3)' }}>{open === i ? '−' : '+'}</span>
                </button>
                {open === i && <p className="small muted mt-2" style={{ margin: '8px 0 0' }}>{a}</p>}
              </div>
            ))}
            <p className="small muted mt-4">
              Still stuck? <Link to="/support">Contact support</Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="col" style={{ gap: 12, maxWidth: 720 }}>
          {[
            ['About Food Express', '/about', 'What this platform is and how it was built.'],
            ['Contact support', '/support', 'Raise a ticket. Tickets are stored locally in this demo build.'],
            ['Shipping & delivery policy', '/policy/shipping', 'Delivery zones, fees, the ₹150 free-delivery rule and timelines.'],
            ['Cancellation & refund policy', '/policy/cancellation', 'What can be cancelled, and how refunds work.'],
            ['Privacy policy', '/policy/privacy', 'What data this app stores and how it is used.'],
            ['Terms & conditions', '/policy/terms', 'Rules for using the platform.'],
          ].map(([title, to, desc]) => (
            <Link key={to} to={to} className="card card-pad" style={{ color: 'inherit', display: 'block' }}>
              <b>{title}</b>
              <p className="small muted" style={{ margin: '2px 0 0' }}>{desc}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
