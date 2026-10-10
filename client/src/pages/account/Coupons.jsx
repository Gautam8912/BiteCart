/** Coupon wallet. Every seeded coupon is labelled a demo promotion. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Endpoints } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EmptyState, Alert, BlockSkeleton, DemoTag } from '../../components/ui/index.jsx';
import { formatInr, formatDate } from '../../utils/format.js';

export default function Coupons() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [code, setCode] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    Endpoints.coupons().then((r) => setItems(r.items)).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const copy = async (c) => {
    setCode(c);
    try {
      await navigator.clipboard.writeText(c);
      toast.success(`${c} copied — apply it in your cart`);
    } catch {
      toast.info(`Coupon code: ${c}`);
    }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Coupons &amp; offers</h2>

      <Alert tone="warning">
        <span className="grow">
          All coupons below are <b>demo promotions</b> seeded for development. They have no monetary
          value and are not part of a live marketing campaign. Minimum spend, expiry, category and
          per-user limits are enforced on the server.
        </span>
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <BlockSkeleton height={110} count={3} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="🎟" title="No coupons available"
            message="Promotions will appear here when an admin configures them."
            action={<Link to="/categories" className="btn">Start shopping</Link>} />
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {items.map((c) => (
            <div className="card card-pad" key={c.code} style={{ opacity: c.expired ? .6 : 1 }}>
              <div className="row-between wrap" style={{ gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <b style={{ fontSize: 16, letterSpacing: '.04em' }}>{c.code}</b>
                    {c.isDemo && <DemoTag>Demo promotion</DemoTag>}
                    {c.expired && <span className="badge badge-neutral">Expired</span>}
                    {c.categorySlug && <span className="badge">{c.categorySlug}</span>}
                    {c.stackable ? <span className="badge badge-success">Stackable</span> : <span className="badge badge-neutral">One per order</span>}
                  </div>
                  <p className="small" style={{ margin: '4px 0 0' }}>{c.title}</p>
                  <p className="tiny muted" style={{ margin: '2px 0 0' }}>{c.description}</p>
                  <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                    {c.minSubtotal > 0 && <>Minimum spend {formatInr(c.minSubtotal)} · </>}
                    {c.maxDiscount ? <>Max discount {formatInr(c.maxDiscount)} · </> : null}
                    Expires {formatDate(c.expiresAt)} · {c.usedByMe}/{c.perUserLimit} used by you
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={c.expired} onClick={() => copy(c.code)}>
                  {c.expired ? 'Expired' : 'Copy code'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {code && (
        <div className="card card-pad">
          <p className="small" style={{ margin: 0 }}>
            Apply <b>{code}</b> from the <Link to="/cart">cart page</Link> or at checkout.
          </p>
        </div>
      )}
    </div>
  );
}
