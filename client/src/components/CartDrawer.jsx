/**
 * Cart drawer — persistent cart access from any page. Shows lines, the live
 * ₹150 free-delivery progress, the bill summary and a checkout entry point.
 */
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { formatInr, optionsLabel } from '../utils/format.js';
import { DeliveryProgress, PriceBreakdown, EmptyState, Icon, QuantitySelector } from './ui/index.jsx';

export default function CartDrawer() {
  const { drawerOpen, setDrawerOpen, items, bill, settings, isEmpty, removeItem, restaurant, refresh, setQuantity } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [drawerOpen, setDrawerOpen]);

  useEffect(() => {
    if (drawerOpen) refresh({ silent: true });
  }, [drawerOpen, refresh]);

  if (!drawerOpen) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="drawer-head">
          <h2>Your cart {bill.itemCount > 0 && <span className="muted" style={{ fontWeight: 500, fontSize: 14 }}>({bill.itemCount})</span>}</h2>
          <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close cart">×</button>
        </div>

        <div className="drawer-body">
          {isEmpty ? (
            <EmptyState
              icon="🛒"
              title="Your cart is empty"
              message={`Add at least ${formatInr(settings?.freeDeliveryThreshold ?? 15000)} of products to unlock free delivery.`}
              action={<Link to="/categories" className="btn" onClick={() => setDrawerOpen(false)}>Start shopping</Link>}
              secondaryAction={<Link to="/restaurants" className="btn btn-secondary" onClick={() => setDrawerOpen(false)}>Order food</Link>}
            />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <DeliveryProgress delivery={bill.delivery} threshold={settings?.freeDeliveryThreshold} />
              </div>

              {restaurant && (
                <div className="alert alert-info" style={{ marginBottom: 12 }}>
                  <span className="alert-icon" aria-hidden="true">🍽</span>
                  <div className="grow small">
                    Ordering from <b>{restaurant.name}</b> · {restaurant.etaMin}–{restaurant.etaMax} min.
                    {!restaurant.minOrderMet && (
                      <span> Minimum order {formatInr(restaurant.minOrder)} — add {formatInr(restaurant.minOrder - bill.merchandisePaise)} more.</span>
                    )}
                  </div>
                </div>
              )}

              {items.map((item) => {
                const label = optionsLabel(item.options);
                return (
                  <div className="line" key={item.lineId ?? `${item.itemId}${label}`}>
                    <span className="line-img">
                      <img src={item.image_url || `/api/images/${item.slug}.svg`} alt="" loading="lazy" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="line-name truncate">{item.name}</div>
                      {item.restaurantName && <div className="line-meta truncate">{item.restaurantName}</div>}
                      {label && <div className="line-meta truncate">{label}</div>}
                      <div className="line-meta">{formatInr(item.pricePaise)} each</div>
                      <div className="line-actions">
                        <button type="button" className="link-btn" onClick={() => removeItem(item)}>Remove</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span className="line-price">{formatInr(item.pricePaise * item.quantity)}</span>
                      <QuantitySelector
                        value={item.quantity}
                        onChange={(next) => setQuantity(item.itemId, Math.max(0, next), item.options)}
                        min={0}
                        max={item.stock || 20}
                        label={`Quantity of ${item.name}`}
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {!isEmpty && (
          <div className="drawer-foot">
            <PriceBreakdown bill={bill} compact />
            <div className="row">
              <Link to="/cart" className="btn btn-secondary grow" onClick={() => setDrawerOpen(false)}>View cart</Link>
              <button type="button" className="btn grow"
                disabled={restaurant && !restaurant.minOrderMet}
                onClick={() => { setDrawerOpen(false); navigate('/checkout'); }}>
                Checkout
              </button>
            </div>
            {restaurant && !restaurant.minOrderMet && (
              <p className="tiny muted">Complete the minimum order to check out.</p>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
