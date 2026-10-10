/** Order history with status, totals and quick actions. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Breadcrumbs, EmptyState, ErrorState, Badge, BlockSkeleton, Tabs } from '../components/ui/index.jsx';
import { formatInr, formatDate } from '../utils/format.js';

const STATUS_TONE = {
  placed: 'neutral', confirmed: 'info', packing: 'warning', preparing: 'warning',
  out_for_delivery: 'warning', delivered: 'success', cancelled: 'danger',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const toast = useToast();
  const { refresh } = useCart();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    Endpoints.orders()
      .then((r) => setOrders(r.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const doReorder = async (order) => {
    try {
      const res = await Endpoints.reorder(order.orderNumber);
      await refresh({ silent: true });
      if (res.skipped?.length) {
        toast.info(`${res.added} item(s) added; ${res.skipped.length} unavailable (${res.skipped.map((s) => s.name).join(', ')}).`);
      } else {
        toast.success(`${res.added} item(s) added to your cart`);
      }
      navigate('/cart');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const counts = {
    all: orders.length,
    active: orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };
  const visible = tab === 'all' ? orders : orders.filter((o) => (tab === 'active'
    ? !['delivered', 'cancelled'].includes(o.status)
    : o.status === tab));

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Order history' }]} />
      <h1 className="mb-4">Order history</h1>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <BlockSkeleton height={120} count={3} />
      ) : orders.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🧾"
            title="No orders yet"
            message="When you place an order it will appear here with live status, the bill breakdown and a reorder button."
            action={<Link to="/categories" className="btn">Start shopping</Link>}
            secondaryAction={<Link to="/restaurants" className="btn btn-secondary">Order food</Link>}
          />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'active', label: 'In progress', count: counts.active },
                { value: 'delivered', label: 'Delivered', count: counts.delivered },
                { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState icon="🔎" title="Nothing here" message="No orders match this filter." />
          ) : (
            <div className="col" style={{ gap: 12 }}>
              {visible.map((o) => (
                <article className="card card-pad" key={o.id}>
                  <div className="row-between wrap mb-3">
                    <div>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <b>{o.orderNumber}</b>
                        <Badge tone={STATUS_TONE[o.status] || 'neutral'}>{o.statusLabel}</Badge>
                        {o.kind === 'food' && <Badge tone="accent">{o.restaurantName}</Badge>}
                      </div>
                      <div className="tiny muted">
                        Placed {formatDate(o.placedAt, true)} · {o.unitCount || o.itemCount} item{(o.unitCount || o.itemCount) === 1 ? '' : 's'}
                        {o.etaMinutes ? ` · ETA ${o.etaMinutes} min` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="bold" style={{ fontSize: 17 }}>{formatInr(o.total)}</div>
                      <div className="tiny muted">
                        {o.paymentStatus === 'paid-demo' && <span className="demo-tag">Demo payment</span>}
                        {o.paymentStatus === 'pending' && o.paymentMethod === 'cod' && 'Cash on delivery'}
                      </div>
                    </div>
                  </div>

                  <div className="row wrap">
                    <Link className="btn btn-secondary btn-sm" to={`/orders/${o.orderNumber}`}>Track &amp; view details</Link>
                    <button type="button" className="btn btn-sm" onClick={() => doReorder(o)}>Reorder</button>
                    {o.canCancel && (
                      <Link className="link-btn" to={`/orders/${o.orderNumber}`}>Cancel order</Link>
                    )}
                  </div>

                  {o.trackingIsSimulated && (
                    <p className="tiny muted mt-2">
                      Status updates on demo orders are simulated — no live GPS or courier integration is connected.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
