/**
 * Cart page: line management, the ₹150 free-delivery rule with a live progress
 * bar, coupon entry, save-for-later and the full price breakdown.
 *
 * The message and progress come from the server's bill engine, so what the user
 * reads is exactly what will be charged.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { Endpoints } from '../api/client.js';
import {
  Breadcrumbs, DeliveryProgress, PriceBreakdown, EmptyState, Alert,
  QuantitySelector, Icon,
} from '../components/ui/index.jsx';
import { formatInr, optionsLabel } from '../utils/format.js';

export default function CartPage() {
  const {
    items, saved, unavailable, bill, settings, restaurant, isEmpty,
    loading, refresh, setQuantity, removeItem, saveForLater, moveToCart, clear,
    applyCoupon, removeCoupon,
  } = useCart();
  const { config } = useApp();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState(null);

  const threshold = settings?.freeDeliveryThreshold ?? config?.freeDeliveryThreshold ?? 15000;

  const loadCoupons = async () => {
    try { setAvailableCoupons((await Endpoints.coupons()).items); } catch { setAvailableCoupons([]); }
  };

  const onApply = async (e) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplying(true);
    await applyCoupon(couponInput);
    setApplying(false);
  };

  if (loading && isEmpty) {
    return (
      <div className="container page">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
        <h1 className="mb-4">Your cart</h1>
        <p className="muted">Loading your cart…</p>
      </div>
    );
  }

  if (isEmpty && saved.length === 0) {
    return (
      <div className="container page">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
        <div className="card">
          <EmptyState
            icon="🛒"
            title="Your cart is empty"
            message={`Add products worth ${formatInr(threshold)} or more to unlock free delivery.`}
            action={<Link to="/categories" className="btn">Start shopping</Link>}
            secondaryAction={<Link to="/restaurants" className="btn btn-secondary">Order food</Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />

      <div className="row-between mb-4 wrap">
        <div>
          <h1>Your cart</h1>
          <p className="muted small">{bill.itemCount} item{bill.itemCount === 1 ? '' : 's'} · {formatInr(bill.totalPaise)} to pay</p>
        </div>
        <div className="row">
          <Link to="/categories" className="btn btn-secondary btn-sm">Continue shopping</Link>
          <button type="button" className="link-btn" onClick={clear}>Clear cart</button>
        </div>
      </div>

      {unavailable.length > 0 && (
        <Alert tone="warning" className="mb-4">
          <b>{unavailable.length} item{unavailable.length === 1 ? '' : 's'} unavailable:</b>{' '}
          {unavailable.map((u) => u.name).join(', ')}. Remove {unavailable.length === 1 ? 'it' : 'them'} to continue to checkout.
        </Alert>
      )}

      <div className="checkout-layout">
        <div className="col" style={{ gap: 16 }}>
          {/* ------------------- free delivery progress ------------------- */}
          <DeliveryProgress delivery={bill.delivery} threshold={threshold} />

          {restaurant && (
            <Alert tone={restaurant.minOrderMet ? 'info' : 'warning'}>
              <span className="grow">
                Ordering from <b>{restaurant.name}</b> · estimated {restaurant.etaMin}–{restaurant.etaMax} min.
                {restaurant.minOrderMet
                  ? ` Minimum order of ${formatInr(restaurant.minOrder)} met.`
                  : ` Minimum order ${formatInr(restaurant.minOrder)} — add ${formatInr(restaurant.minOrder - bill.merchandisePaise)} more to check out.`}
              </span>
            </Alert>
          )}

          {/* --------------------------- line items ------------------------ */}
          <div className="card card-pad">
            <h2 className="mb-3">Items ({bill.itemCount})</h2>

            {items.length === 0 && (
              <p className="muted">Your active cart is empty — items you saved for later are below.</p>
            )}

            {items.map((item) => {
              const label = optionsLabel(item.options);
              const capped = item.stock && item.quantity >= item.stock;
              return (
                <div className="line" key={item.lineId ?? `${item.itemId}${label}`}>
                  <Link to={item.kind === 'product' ? `/product/${item.slug}` : `/restaurant/${item.restaurantSlug}`}
                    className="line-img" aria-label={`View ${item.name}`}>
                    <img src={item.image_url || `/api/images/${item.slug}.svg`} alt="" loading="lazy" />
                  </Link>

                  <div style={{ minWidth: 0 }}>
                    <Link to={item.kind === 'product' ? `/product/${item.slug}` : `/restaurant/${item.restaurantSlug}`}
                      className="line-name" style={{ color: 'inherit' }}>{item.name}</Link>
                    {item.brand && <div className="line-meta">{item.brand}</div>}
                    {item.restaurantName && <div className="line-meta">{item.restaurantName}</div>}
                    {label && <div className="line-meta">{label}</div>}
                    <div className="line-meta">
                      {formatInr(item.pricePaise)} each{item.unit ? ` · ${item.unit}` : ''}
                      {item.stock !== undefined && item.stock <= 10 && item.stock > 0 && <> · only {item.stock} left</>}
                    </div>
                    <div className="line-actions">
                      <button type="button" className="link-btn" onClick={() => saveForLater(item)}>Save for later</button>
                      <button type="button" className="link-btn" onClick={() => removeItem(item)}>Remove</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span className="line-price">{formatInr(item.pricePaise * item.quantity)}</span>
                    <QuantitySelector
                      value={item.quantity}
                      onChange={(next) => setQuantity(item.itemId, Math.max(0, next), item.options)}
                      min={0}
                      max={item.stock || 20}
                      label={`Quantity of ${item.name}`}
                    />
                    {capped && <span className="tiny muted">Max available</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ------------------------- save for later ---------------------- */}
          {saved.length > 0 && (
            <div className="card card-pad">
              <h2 className="mb-3">Saved for later ({saved.length})</h2>
              {saved.map((item) => (
                <div className="line" key={`saved-${item.id}`}>
                  <span className="line-img">
                    <img src={item.image || '/favicon.svg'} alt="" loading="lazy" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="line-name truncate">{item.name}</div>
                    {item.restaurantName && <div className="line-meta truncate">{item.restaurantName}</div>}
                    <div className="line-meta">{formatInr(item.price)}</div>
                    <div className="line-actions">
                      <button type="button" className="link-btn" onClick={() => moveToCart(item)} disabled={!item.inStock}>
                        {item.inStock ? 'Move to cart' : 'Unavailable'}
                      </button>
                    </div>
                  </div>
                  <div className="line-price">{formatInr(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ---------------------------- coupons -------------------------- */}
          <div className="card card-pad">
            <div className="row-between mb-3">
              <h2>Apply a coupon</h2>
              <button type="button" className="link-btn" onClick={loadCoupons}>See available coupons</button>
            </div>

            {bill.couponApplied ? (
              <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <b>{bill.couponApplied.code}</b> — {bill.couponApplied.title}
                  <div className="small" style={{ color: 'var(--fe-success)' }}>
                    You saved {formatInr(bill.couponApplied.discountPaise)}
                    {bill.couponApplied.freeDelivery && ' + free delivery'}
                  </div>
                  {bill.couponApplied.is_demo && <span className="tiny muted">Demo promotion</span>}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={removeCoupon}>Remove coupon</button>
              </div>
            ) : (
              <form className="row" onSubmit={onApply} style={{ flexWrap: 'wrap' }}>
                <input
                  className="input"
                  style={{ maxWidth: 220, textTransform: 'uppercase' }}
                  placeholder="e.g. SAVE10"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  aria-label="Coupon code"
                />
                <button type="submit" className="btn" disabled={applying || !couponInput.trim()}>
                  {applying ? 'Applying…' : 'Apply'}
                </button>
              </form>
            )}

            {bill.couponError && <p className="field-error mt-2">{bill.couponError}</p>}

            {availableCoupons && (
              <div className="mt-4">
                <div className="chips">
                  {availableCoupons.map((c) => (
                    <button type="button" key={c.code} className="chip" disabled={c.expired}
                      onClick={() => setCouponInput(c.code)}
                      title={c.description}>
                      {c.code} · {c.expired ? 'expired' : c.title}
                    </button>
                  ))}
                </div>
                <p className="tiny muted mt-2">
                  All seeded coupons are demo promotions. Minimum-spend, expiry and per-user limits are
                  enforced on the server.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------- summary ---------------------------- */}
        <aside className="sticky-summary">
          <div className="card card-pad">
            <h2 className="mb-3">Bill details</h2>
            <PriceBreakdown bill={bill} />
            <hr className="divider" />
            <button
              type="button"
              className="btn btn-lg btn-block"
              disabled={items.length === 0 || unavailable.length > 0 || (restaurant && !restaurant.minOrderMet)}
              onClick={() => navigate('/checkout')}
            >
              Proceed to checkout
            </button>
            <p className="tiny muted mt-2 center">
              Free delivery unlocks at {formatInr(threshold)} of eligible merchandise. Fees and taxes never count toward it.
            </p>
          </div>

          <div className="card card-pad mt-3">
            <h3 className="mb-2">Delivery estimate</h3>
            <p className="small muted" style={{ margin: 0 }}>
              {restaurant
                ? `${restaurant.etaMin}–${restaurant.etaMax} minutes from ${restaurant.name}.`
                : 'Typically 12–28 minutes for configured delivery zones.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
