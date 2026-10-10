/**
 * Multi-step checkout: address → review → delivery option → payment → confirm.
 *
 * The client never computes the chargeable total. Each step calls
 * POST /api/checkout/preview and the server recomputes everything from the
 * catalogue, so a tampered client cannot get a cheaper order. Placing the order
 * sends an idempotency key, so a double-click cannot create two orders.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLocation } from '../context/LocationContext.jsx';
import {
  Breadcrumbs, PriceBreakdown, DeliveryProgress, Alert, EmptyState, ErrorState, BlockSkeleton,
} from '../components/ui/index.jsx';
import { formatInr, optionsLabel } from '../utils/format.js';

const STEPS = [
  { key: 'address', label: 'Address' },
  { key: 'review', label: 'Review items' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'confirm', label: 'Confirm' },
];

export default function Checkout() {
  const { items, bill, isEmpty, settings, restaurant, refresh } = useCart();
  const { user } = useAuth();
  const { selected } = useLocation();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState('cod');
  const [deliveryOption, setDeliveryOption] = useState('standard');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [form, setForm] = useState({ label: 'Home', fullName: user?.name || '', phone: user?.mobile || '', line1: '', line2: '', city: selected?.name || '', state: selected?.state || '', pincode: '', landmark: '' });
  const [formError, setFormError] = useState(null);
  const idempotencyKey = useRef(`fe-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`);

  /* --------------------------- load addresses --------------------------- */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [addr, m] = await Promise.all([Endpoints.addresses(), Endpoints.checkoutMethods()]);
        if (!alive) return;
        setAddresses(addr.items);
        setMethods(m.methods);
        const def = addr.items.find((a) => a.isDefault) || addr.items[0];
        if (def) setAddressId((cur) => cur ?? def.id);
        if (addr.items.length === 0) setShowAddressForm(true);
      } catch (err) {
        if (alive) setError(err.message);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  /* --------------------------- server preview --------------------------- */
  const loadPreview = useCallback(async () => {
    if (isEmpty) { setLoadingPreview(false); return; }
    setLoadingPreview(true);
    try {
      const res = await Endpoints.checkoutPreview({ addressId, couponCode: bill.couponApplied?.code ?? null });
      setPreview(res);
      setError(null);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [isEmpty, addressId, bill.couponApplied?.code]);

  useEffect(() => { loadPreview(); }, [loadPreview]);
  useEffect(() => { refresh({ silent: true }); }, [refresh]);

  const activeAddress = useMemo(
    () => addresses.find((a) => a.id === addressId) || null,
    [addresses, addressId],
  );

  const canAdvance = [
    !!activeAddress,
    items.length > 0,
    true,
    !!method,
    !!activeAddress && !!method,
  ][step];

  /* --------------------------- create address --------------------------- */
  const saveAddress = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await Endpoints.addAddress(form);
      setAddresses((list) => [res.address, ...list]);
      setAddressId(res.address.id);
      setShowAddressForm(false);
      toast.success('Address saved');
    } catch (err) {
      setFormError(err.message);
    }
  };

  /* --------------------------- place the order -------------------------- */
  const placeOrder = async () => {
    if (submitting) return; // hard guard against double submission
    setSubmitting(true);
    try {
      const res = await Endpoints.placeOrder({
        addressId,
        paymentMethod: method,
        couponCode: bill.couponApplied?.code ?? null,
        idempotencyKey: idempotencyKey.current,
      });
      toast.success(`Order ${res.order.orderNumber} placed`);
      await refresh({ silent: true });
      navigate(`/orders/${res.order.orderNumber}`, { replace: true });
    } catch (err) {
      toast.error(err.message || 'We could not place your order.');
      // The idempotency key stays stable for this checkout session, so a retry
      // after fixing the problem cannot create a second order.
    } finally {
      setSubmitting(false);
    }
  };

  if (isEmpty) {
    return (
      <div className="container page">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Checkout' }]} />
        <div className="card">
          <EmptyState icon="🛒" title="Nothing to check out" message="Your cart is empty."
            action={<Link to="/categories" className="btn">Start shopping</Link>} />
        </div>
      </div>
    );
  }

  const effectiveBill = preview?.bill ?? bill;

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="mb-4">Checkout</h1>

      <div className="step-list mb-5" role="list">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`step-dot${i < step ? ' done' : ''}`} aria-current={i === step ? 'step' : undefined} role="listitem">
            <b>{i < step ? '✓' : i + 1}</b> {s.label}
            {i < STEPS.length - 1 && <span aria-hidden="true" style={{ color: 'var(--fe-border-strong)', marginLeft: 6 }}>—</span>}
          </span>
        ))}
      </div>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="checkout-layout">
        <div className="col" style={{ gap: 16 }}>
          {/* ------------------------- step: address ----------------------- */}
          {step === 0 && (
            <div className="card card-pad">
              <div className="row-between mb-3">
                <h2>Delivery address</h2>
                {addresses.length > 0 && (
                  <button type="button" className="link-btn" onClick={() => setShowAddressForm((v) => !v)}>
                    {showAddressForm ? 'Cancel' : '+ Add new address'}
                  </button>
                )}
              </div>

              {addresses.length === 0 && !showAddressForm && (
                <EmptyState icon="📍" title="No saved address"
                  message="Add a delivery address so we know where to send this order."
                  action={<button type="button" className="btn" onClick={() => setShowAddressForm(true)}>Add address</button>} />
              )}

              {!showAddressForm && addresses.map((a) => (
                <label key={a.id} className="loc-result mb-2" style={{ cursor: 'pointer', width: '100%',
                  borderColor: addressId === a.id ? 'var(--fe-primary)' : undefined,
                  background: addressId === a.id ? 'var(--fe-primary-light)' : undefined }}>
                  <input type="radio" name="address" checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)} style={{ marginRight: 4 }} />
                  <span style={{ textAlign: 'left', minWidth: 0 }}>
                    <b>{a.label} — {a.fullName}</b>
                    <span className="tiny muted" style={{ display: 'block' }}>
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.pincode} · {a.phone}
                    </span>
                  </span>
                  {a.isDefault && <span className="badge">Default</span>}
                </label>
              ))}

              {showAddressForm && (
                <form onSubmit={saveAddress} className="col mt-3" style={{ gap: 12 }}>
                  {formError && <Alert tone="danger">{formError}</Alert>}
                  <div className="row wrap">
                    <div className="field grow">
                      <label className="field-label" htmlFor="a-label">Label</label>
                      <select id="a-label" className="select" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}>
                        <option>Home</option><option>Work</option><option>Other</option>
                      </select>
                    </div>
                    <div className="field grow">
                      <label className="field-label" htmlFor="a-name">Full name</label>
                      <input id="a-name" className="input" value={form.fullName} required
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                    </div>
                    <div className="field grow">
                      <label className="field-label" htmlFor="a-phone">Mobile number</label>
                      <input id="a-phone" className="input" inputMode="numeric" maxLength={10} required
                        value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="a-line1">Flat / house / street</label>
                    <input id="a-line1" className="input" required value={form.line1}
                      onChange={(e) => setForm({ ...form, line1: e.target.value })} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="a-line2">Area / landmark (optional)</label>
                    <input id="a-line2" className="input" value={form.line2}
                      onChange={(e) => setForm({ ...form, line2: e.target.value })} />
                  </div>
                  <div className="row wrap">
                    <div className="field grow">
                      <label className="field-label" htmlFor="a-city">City</label>
                      <input id="a-city" className="input" required value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div className="field grow">
                      <label className="field-label" htmlFor="a-state">State</label>
                      <input id="a-state" className="input" required value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    </div>
                    <div className="field grow">
                      <label className="field-label" htmlFor="a-pin">PIN code</label>
                      <input id="a-pin" className="input" inputMode="numeric" maxLength={6} required
                        value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })} />
                    </div>
                  </div>
                  <div className="row">
                    <button type="submit" className="btn">Save address</button>
                    {addresses.length > 0 && (
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddressForm(false)}>Cancel</button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ------------------------- step: review ------------------------ */}
          {step === 1 && (
            <div className="card card-pad">
              <h2 className="mb-3">Review your items ({items.length})</h2>
              {restaurant && <p className="small muted">All food items come from {restaurant.name}.</p>}
              {items.map((item) => (
                <div className="line" key={item.lineId ?? item.itemId}>
                  <span className="line-img"><img src={item.image_url || `/api/images/${item.slug}.svg`} alt="" loading="lazy" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="line-name truncate">{item.name}</div>
                    <div className="line-meta">{optionsLabel(item.options) || item.unit || item.restaurantName || ''}</div>
                    <div className="line-meta">Qty {item.quantity} × {formatInr(item.pricePaise)}</div>
                  </div>
                  <div className="line-price">{formatInr(item.pricePaise * item.quantity)}</div>
                </div>
              ))}
              <p className="tiny muted mt-3">
                Prices are re-read from the catalogue at this step and verified again when the order is placed.
              </p>
            </div>
          )}

          {/* ------------------------- step: delivery ---------------------- */}
          {step === 2 && (
            <div className="card card-pad">
              <h2 className="mb-3">Delivery option</h2>
              {[
                { id: 'standard', title: 'Standard delivery', note: `${selected?.etaMin ?? 12}–${selected?.etaMax ?? 28} minutes. Free over ${formatInr(settings?.freeDeliveryThreshold ?? 15000)}.` },
                { id: 'scheduled', title: 'Schedule for later', note: 'Not implemented in this build — kept visible so the option is honest rather than silently missing.' },
              ].map((o) => (
                <label key={o.id} className="loc-result mb-2" style={{ cursor: o.id === 'scheduled' ? 'not-allowed' : 'pointer', opacity: o.id === 'scheduled' ? .6 : 1, width: '100%' }}>
                  <input type="radio" name="delivery" checked={deliveryOption === o.id} disabled={o.id === 'scheduled'}
                    onChange={() => setDeliveryOption(o.id)} />
                  <span style={{ textAlign: 'left' }}>
                    <b>{o.title}</b>
                    <span className="tiny muted" style={{ display: 'block' }}>{o.note}</span>
                  </span>
                  <span className="badge">{o.id === 'standard' ? (effectiveBill.delivery.feePaise === 0 ? 'FREE' : formatInr(effectiveBill.delivery.feePaise)) : 'N/A'}</span>
                </label>
              ))}
              <div className="mt-3">
                <DeliveryProgress delivery={effectiveBill.delivery} threshold={settings?.freeDeliveryThreshold} />
              </div>
              {selected && (
                <p className="tiny muted mt-3">
                  Delivering to {selected.locality || selected.name}, {selected.name} — {selected.statusLabel}.
                </p>
              )}
            </div>
          )}

          {/* ------------------------- step: payment ----------------------- */}
          {step === 3 && (
            <div className="card card-pad">
              <h2 className="mb-3">Payment method</h2>
              <Alert tone="warning" className="mb-3">
                No real payment gateway is connected to this build. “Demo card” and “UPI (demo)” simulate a
                payment locally: no money moves, and the order is marked as a demo payment. Cash on delivery
                is recorded as pending.
              </Alert>
              {methods.map((m) => (
                <label key={m.id} className="loc-result mb-2" style={{ cursor: 'pointer', width: '100%',
                  borderColor: method === m.id ? 'var(--fe-primary)' : undefined,
                  background: method === m.id ? 'var(--fe-primary-light)' : undefined }}>
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <span style={{ textAlign: 'left' }}>
                    <b>{m.label}</b>
                    <span className="tiny muted" style={{ display: 'block' }}>{m.note}</span>
                  </span>
                  {m.mode === 'demo' && <span className="demo-tag">Simulated</span>}
                </label>
              ))}
            </div>
          )}

          {/* ------------------------- step: confirm ----------------------- */}
          {step === 4 && (
            <div className="card card-pad">
              <h2 className="mb-3">Confirm your order</h2>
              <div className="col" style={{ gap: 12 }}>
                <div>
                  <h4 className="muted">Delivering to</h4>
                  <p style={{ margin: 0 }}>
                    <b>{activeAddress?.fullName}</b> · {activeAddress?.phone}<br />
                    {activeAddress?.line1}{activeAddress?.line2 ? `, ${activeAddress.line2}` : ''}, {activeAddress?.city} {activeAddress?.pincode}
                  </p>
                </div>
                <div>
                  <h4 className="muted">Payment</h4>
                  <p style={{ margin: 0 }}>
                    {methods.find((m) => m.id === method)?.label}
                    {methods.find((m) => m.id === method)?.mode === 'demo' && <> <span className="demo-tag">Simulated payment</span></>}
                  </p>
                </div>
                <div>
                  <h4 className="muted">Items</h4>
                  <p style={{ margin: 0 }}>{items.length} line{items.length === 1 ? '' : 's'} · {effectiveBill.itemCount} unit{effectiveBill.itemCount === 1 ? '' : 's'}</p>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------- navigation ------------------------ */}
          <div className="row-between wrap">
            <button type="button" className="btn btn-secondary" disabled={step === 0 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}>
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn" disabled={!canAdvance || loadingPreview}
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Continue →
              </button>
            ) : (
              <button type="button" className="btn btn-lg" disabled={submitting || loadingPreview} onClick={placeOrder}>
                {submitting ? 'Placing order…' : `Place order · ${formatInr(effectiveBill.totalPaise)}`}
              </button>
            )}
          </div>
        </div>

        {/* ---------------------------- summary ---------------------------- */}
        <aside className="sticky-summary">
          <div className="card card-pad">
            <h2 className="mb-3">Bill details</h2>
            {loadingPreview ? <BlockSkeleton height={180} /> : <PriceBreakdown bill={effectiveBill} />}
            <hr className="divider" />
            <p className="tiny muted">
              Totals are computed on the server. Changing anything in the cart recalculates this bill.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
