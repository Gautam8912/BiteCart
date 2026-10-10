/**
 * Order details + progress tracker.
 *
 * Status transitions are simulated on demo orders and the page says so plainly
 * — it never claims live courier tracking.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import {
  Breadcrumbs, PriceBreakdown, EmptyState, ErrorState, BlockSkeleton, Alert, Modal,
} from '../components/ui/index.jsx';
import { formatInr, formatDate, optionsLabel } from '../utils/format.js';

const LABELS = {
  placed: 'Order placed', confirmed: 'Confirmed', packing: 'Packing your order',
  preparing: 'Kitchen is preparing', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useCart();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Endpoints.order(orderNumber)
      .then((r) => setOrder(r.order))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [orderNumber]);

  if (loading) {
    return (
      <div className="container page">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Orders', to: '/orders' }, { label: orderNumber }]} />
        <BlockSkeleton height={160} />
        <BlockSkeleton height={260} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container page">
        <ErrorState title="Order not found" message={error || 'That order is not in your account.'}
          onRetry={() => navigate('/orders')} />
      </div>
    );
  }

  const flow = order.statusFlow || [];
  const currentIndex = order.status === 'cancelled' ? -1 : flow.indexOf(order.status);

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await Endpoints.cancelOrder(order.orderNumber);
      setOrder(res.order);
      setConfirmCancel(false);
      await refresh({ silent: true });
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reorder = async () => {
    setBusy(true);
    try {
      const res = await Endpoints.reorder(order.orderNumber);
      await refresh({ silent: true });
      toast.success(`${res.added} item(s) added to your cart`);
      navigate('/cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Orders', to: '/orders' }, { label: order.orderNumber }]} />

      <div className="row-between wrap mb-4">
        <div>
          <h1>{order.orderNumber}</h1>
          <p className="muted small">Placed {formatDate(order.placedAt, true)} · {order.kind === 'food' ? order.restaurantName : 'Grocery order'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatInr(order.total)}</div>
          <div className="tiny muted">
            {order.paymentStatus === 'paid-demo' && <span className="demo-tag">Demo payment · not real money</span>}
            {order.paymentStatus === 'pending' && order.paymentMethod === 'cod' && 'Pay on delivery'}
            {order.paymentStatus === 'refunded' && 'Refunded'}
          </div>
        </div>
      </div>

      {order.trackingIsSimulated && (
        <Alert tone="info" className="mb-4">
          This is a demo order. Status changes are simulated by the platform — there is no live courier or
          GPS integration, so the position of the delivery partner is not tracked.
        </Alert>
      )}

      <div className="checkout-layout">
        <div className="col" style={{ gap: 16 }}>
          {/* ---------------------------- tracker -------------------------- */}
          <div className="card card-pad">
            <h2 className="mb-4">Order status</h2>
            {order.status === 'cancelled' ? (
              <div className="track-step cancelled">
                <span className="track-dot">✕</span>
                <div>
                  <div className="track-title">Cancelled</div>
                  <div className="track-sub">
                    {order.cancelledAt ? `Cancelled on ${formatDate(order.cancelledAt, true)}.` : 'This order was cancelled.'}
                    {order.paymentMode === 'cod'
                      ? ' No payment was taken, so nothing is due.'
                      : ' Demo payments are not real money, so no refund is processed.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="tracker">
                {flow.map((s, i) => {
                  const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : '';
                  return (
                    <div key={s} className={`track-step ${state}`}>
                      <span className="track-dot" aria-hidden="true">{i < currentIndex ? '✓' : i + 1}</span>
                      <div>
                        <div className="track-title">{LABELS[s] || s}</div>
                        <div className="track-sub">
                          {i === currentIndex && order.etaMinutes
                            ? `Estimated ${order.etaMinutes} minutes from order placement.`
                            : (i === currentIndex ? 'In progress' : i < currentIndex ? 'Completed' : 'Pending')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {order.events?.length > 0 && (
              <details className="mt-4">
                <summary className="small muted" style={{ cursor: 'pointer' }}>Status history ({order.events.length})</summary>
                <ul className="small muted" style={{ paddingLeft: 18, marginTop: 8 }}>
                  {order.events.map((e, i) => (
                    <li key={`${e.status}-${i}`}>
                      <b>{LABELS[e.status] || e.status}</b> — {formatDate(e.created_at, true)}
                      {e.note ? ` · ${e.note}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* ----------------------------- items --------------------------- */}
          <div className="card card-pad">
            <h2 className="mb-3">Items ({order.items.length})</h2>
            {order.items.map((item) => (
              <div className="line" key={`${item.itemId}${optionsLabel(item.options)}`}>
                <span className="line-img">
                  <img src={item.image || '/favicon.svg'} alt="" loading="lazy" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="line-name truncate">{item.name}</div>
                  {item.brand && <div className="line-meta">{item.brand}</div>}
                  {optionsLabel(item.options) && <div className="line-meta">{optionsLabel(item.options)}</div>}
                  <div className="line-meta">Qty {item.quantity} × {formatInr(item.unitPrice)}</div>
                </div>
                <div className="line-price">{formatInr(item.lineTotal)}</div>
              </div>
            ))}
          </div>

          {/* --------------------------- address --------------------------- */}
          <div className="card card-pad">
            <h2 className="mb-2">Delivery address</h2>
            <p style={{ margin: 0 }}>
              <b>{order.address?.fullName}</b> · {order.address?.phone}<br />
              {order.address?.line1}{order.address?.line2 ? `, ${order.address.line2}` : ''},{' '}
              {order.address?.city} {order.address?.pincode}
              {order.address?.landmark ? ` · ${order.address.landmark}` : ''}
            </p>
          </div>
        </div>

        {/* --------------------------- summary ---------------------------- */}
        <aside className="sticky-summary col" style={{ gap: 12 }}>
          <div className="card card-pad">
            <h2 className="mb-3">Bill details</h2>
            <PriceBreakdown bill={{
              itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
              merchandisePaise: order.subtotal + order.discount,
              discountPaise: order.discount,
              subtotalPaise: order.subtotal,
              delivery: { feePaise: order.deliveryFee, threshold: order.threshold },
              handlingFeePaise: order.handlingFee,
              taxPaise: order.tax,
              totalPaise: order.total,
              savingsPaise: order.discount,
              couponApplied: order.couponCode ? { code: order.couponCode } : null,
            }} />
            {order.freeDeliveryApplied && (
              <p className="tiny muted mt-2">Free delivery applied on this order.</p>
            )}
          </div>

          <div className="card card-pad col" style={{ gap: 8 }}>
            <button type="button" className="btn btn-block" onClick={reorder} disabled={busy}>Reorder</button>
            {order.canCancel && (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmCancel(true)} disabled={busy}>
                Cancel order
              </button>
            )}
            <Link className="btn btn-ghost btn-block" to="/support">Get help with this order</Link>
          </div>
        </aside>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this order?"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmCancel(false)}>Keep order</button>
            <button type="button" className="btn btn-danger" onClick={cancel} disabled={busy}>
              {busy ? 'Cancelling…' : 'Yes, cancel order'}
            </button>
          </>
        )}
      >
        <p>
          Cancelling {order.orderNumber} will release the reserved stock and refund any coupon used.
          {order.paymentMode === 'cod'
            ? ' No payment was taken, so there is nothing to refund.'
            : ' This order used a simulated demo payment — no real money was charged, so no refund is processed.'}
        </p>
      </Modal>
    </div>
  );
}
