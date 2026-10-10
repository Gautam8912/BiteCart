/**
 * Shared UI primitives. Every page composes from these so buttons, badges,
 * skeletons and empty states are identical across the app.
 */
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { classNames, formatInr } from '../../utils/format.js';

/* -------------------------------- Image ---------------------------------- */
/**
 * Lazy image with a skeleton while loading and an inline SVG fallback on error,
 * so a broken URL never leaves a hole in the layout.
 */
export function Img({ src, alt, className, eager = false, ratio = '1 / 1' }) {
  const id = useId();
  return (
    <span className={classNames('img-wrap', className)} style={{ display: 'block', aspectRatio: ratio, background: 'var(--fe-surface-2)' }}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => {
          // Deterministic inline fallback derived from the alt text.
          const label = (alt || 'FE').slice(0, 2).toUpperCase();
          e.currentTarget.src = `data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#eef1f5"/><text x="100" y="106" font-family="system-ui" font-size="52" font-weight="700" fill="#9aa4b0" text-anchor="middle">${label}</text></svg>`,
          )}`;
          e.currentTarget.onerror = null;
        }}
      />
      <span id={id} className="fe-sr-only">{alt}</span>
    </span>
  );
}

/* -------------------------------- Badges --------------------------------- */
export function Badge({ children, tone = 'default', className }) {
  return <span className={classNames('badge', tone !== 'default' && `badge-${tone}`, className)}>{children}</span>;
}

export function VegDot({ isVeg }) {
  return (
    <span className={classNames('veg-dot', !isVeg && 'nonveg')} role="img"
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'} title={isVeg ? 'Veg' : 'Non-veg'} />
  );
}

export function RatingPill({ value, count, isDemo }) {
  const n = Number(value);
  return (
    <span className={classNames('rating-pill', n < 3.5 && 'low')} title={isDemo ? 'Demo rating' : undefined}>
      ★ {Number(n).toFixed(1)}
      {count ? <span style={{ fontWeight: 500, opacity: .9 }}>({count.toLocaleString('en-IN')})</span> : null}
    </span>
  );
}

export function DemoTag({ children = 'Demo data' }) {
  return <span className="demo-tag" title="Sample data used for development — not verified real-world data">◆ {children}</span>;
}

/* ------------------------------- Skeletons ------------------------------- */
export function Skeleton({ className, style }) {
  return <span className={classNames('skel', className)} style={style} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div className="skel-card" aria-hidden="true">
      <Skeleton className="skel-square" style={{ borderRadius: 0 }} />
      <Skeleton className="skel-line" style={{ width: '45%' }} />
      <Skeleton className="skel-line" style={{ width: '90%' }} />
      <Skeleton className="skel-line" style={{ width: '60%' }} />
      <Skeleton className="skel-line" style={{ width: '40%', marginBottom: 12 }} />
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="grid-products" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
      <span className="fe-sr-only">Loading products…</span>
    </div>
  );
}

export function RailSkeleton({ count = 6 }) {
  return (
    <div className="rail" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
      <span className="fe-sr-only">Loading products…</span>
    </div>
  );
}

export function BlockSkeleton({ height = 120, count = 1 }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} style={{ display: 'block', height, marginBottom: 12 }} />
      ))}
    </div>
  );
}

/* ------------------------------ Empty state ------------------------------ */
export function EmptyState({ icon = '🛒', title, message, action, secondaryAction }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      <div className="row" style={{ justifyContent: 'center' }}>
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}

/* --------------------------------- Modal --------------------------------- */
export function Modal({ open, onClose, title, children, footer, size = 520, labelledBy }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog for keyboard users.
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId}
        style={{ maxWidth: size }} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------- Alert --------------------------------- */
export function Alert({ tone = 'info', icon, children, className }) {
  const icons = { info: 'ℹ', success: '✓', warning: '⚠', danger: '⛔' };
  return (
    <div className={classNames('alert', `alert-${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="alert-icon" aria-hidden="true">{icon ?? icons[tone]}</span>
      <div className="grow">{children}</div>
    </div>
  );
}

/* ------------------------------- Section --------------------------------- */
export function Section({ title, subtitle, to, linkLabel = 'See all', children, id }) {
  return (
    <section className="section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      {(title || to) && (
        <div className="section-head">
          <div>
            {title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}
            {subtitle && <p className="section-sub">{subtitle}</p>}
          </div>
          {to && <Link className="section-link" to={to}>{linkLabel} →</Link>}
        </div>
      )}
      {children}
    </section>
  );
}

/* -------------------------------- Tabs ----------------------------------- */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" className="tab"
          aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Quantity -------------------------------- */
export function QuantitySelector({ value, onChange, min = 0, max = 99, size = 'md', disabled, label = 'Quantity' }) {
  return (
    <div className={classNames('qty', size === 'lg' && 'qty-lg')}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}>−</button>
      <span className="qty-value" aria-live="polite" aria-label={`${label} ${value}`}>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

/* ------------------------------ Price line ------------------------------- */
export function Price({ price, mrp, size = 'md' }) {
  const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <span className="pcard-price">
      <span className="now" style={size === 'lg' ? { fontSize: 20 } : undefined}>{formatInr(price)}</span>
      {off > 0 && <span className="was">{formatInr(mrp)}</span>}
      {off > 0 && <span className="off">{off}% off</span>}
    </span>
  );
}

/* ------------------------------ Breadcrumbs ------------------------------ */
export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          {i < items.length - 1 && <span aria-hidden="true"> / </span>}
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------ Price summary ---------------------------- */
export function PriceBreakdown({ bill, showCoupon = true, compact = false }) {
  if (!bill) return null;
  const d = bill.delivery || {};
  return (
    <div className="pbd">
      <div className="pbd-row">
        <span>Item total ({bill.itemCount})</span>
        <span className="val">{formatInr(bill.merchandisePaise)}</span>
      </div>
      {bill.productSavingsPaise > 0 && !compact && (
        <div className="pbd-row discount">
          <span>Product discounts</span>
          <span className="val">−{formatInr(bill.productSavingsPaise)}</span>
        </div>
      )}
      {showCoupon && bill.discountPaise > 0 && (
        <div className="pbd-row discount">
          <span>Coupon {bill.couponApplied ? `(${bill.couponApplied.code})` : ''}</span>
          <span className="val">−{formatInr(bill.discountPaise)}</span>
        </div>
      )}
      <div className={classNames('pbd-row', d.feePaise === 0 && 'free')}>
        <span>Delivery fee</span>
        <span className="val">{d.feePaise === 0 ? 'FREE' : formatInr(d.feePaise)}</span>
      </div>
      {bill.handlingFeePaise > 0 && (
        <div className="pbd-row">
          <span>Handling fee</span>
          <span className="val">{formatInr(bill.handlingFeePaise)}</span>
        </div>
      )}
      {bill.taxPaise > 0 && (
        <div className="pbd-row">
          <span>GST ({bill.taxRate}%)</span>
          <span className="val">{formatInr(bill.taxPaise)}</span>
        </div>
      )}
      <div className="pbd-total">
        <span>To pay</span>
        <span>{formatInr(bill.totalPaise)}</span>
      </div>
      {bill.savingsPaise > 0 && (
        <p className="pbd-note">You saved {formatInr(bill.savingsPaise)} on this order.</p>
      )}
    </div>
  );
}

/* ------------------------- Free-delivery progress ------------------------ */
export function DeliveryProgress({ delivery, threshold }) {
  if (!delivery) return null;
  const pct = Math.max(0, Math.min(100, delivery.percent ?? 0));
  return (
    <div className={classNames('fdp', delivery.unlocked && 'unlocked')}>
      <div className="fdp-msg">
        <span aria-hidden="true">{delivery.unlocked ? '🎉' : '🛵'}</span>
        <span>{delivery.message}</span>
      </div>
      <div className="fdp-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label="Progress towards free delivery">
        <div className="fdp-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="fdp-scale">
        <span>₹0</span>
        <span>Free delivery at {formatInr(threshold ?? delivery.threshold)}</span>
      </div>
    </div>
  );
}

/* ------------------------------ Error panel ------------------------------ */
export function ErrorState({ message, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="empty">
      <div className="empty-icon" style={{ background: 'var(--fe-danger-light)', color: 'var(--fe-danger)' }} aria-hidden="true">⚠</div>
      <h3>{title}</h3>
      <p>{message || 'Please check your connection and try again.'}</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* ------------------------------- Icons ----------------------------------- */
export const Icon = {
  cart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H5.4" /></svg>,
  heart: (filled) => <svg width="19" height="19" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" /></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>,
  pin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>,
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M9 21v-7h6v7" /></svg>,
  grid: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></svg>,
  receipt: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h14v18l-2.3-1.6L14.4 21 12 19.4 9.6 21l-2.3-1.6L5 21Z" /><path d="M9 8h6M9 12h6" /></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 15V10a6 6 0 1 0-12 0v5l-1.6 2.4h15.2Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  truck: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6h11v10H2Z" /><path d="M13 9h4.5l3.5 3.5V16h-8" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>,
  leaf: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4c0 9-6 14-13 14H4c0-8 6-14 16-14Z" /><path d="M4 20c3-6 7-9 12-11" /></svg>,
};
