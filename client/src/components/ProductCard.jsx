/**
 * ProductCard — the most-used component in the app.
 *
 * Interaction contract (per spec):
 *   - Clicking the card / image / title opens the product details page.
 *   - "ADD" adds exactly one unit; if the line already exists the card turns
 *     into a −/+ stepper, so a second click increments instead of creating a
 *     duplicate entry.
 *   - The add control is a <button>, not part of the <Link>, so opening details
 *     can never accidentally add to the cart.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import {Icon,QuantitySelector,Badge,DemoTag} from './ui/index.jsx';
import {classNames,productId} from '../utils/format.js';

function ProductCardComponent({ product, compact = false, eager = false }) {
  const { quantityOf, addItem, setQuantity, pending } = useCart();
  const wishlist = useWishlist();
  if (!product) return null;

  const itemId = productId(product.id);
  const qty = quantityOf(itemId);
  const inStock = product.inStock !== false && product.stock !== 0;
  const off = product.discountPercent ?? (product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0);
  const isPending = pending === itemId;
  const isWished = wishlist.has(product.id);
  const to = `/product/${product.slug}`;

  return (
    <article className="pcard">
      <Link className="pcard-media" to={to} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div className="pcard-badges">
          {off > 0 && <Badge tone="accent">{off}% OFF</Badge>}
          {!inStock && <Badge tone="neutral">Out of stock</Badge>}
        </div>
      </Link>

      <button
        type="button"
        className="icon-btn pcard-wish"
        onClick={() => wishlist.toggle(product)}
        aria-pressed={isWished}
        aria-label={isWished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        style={{ color: isWished ? 'var(--fe-danger)' : 'var(--fe-text-3)', background: 'rgba(255,255,255,.92)' }}
      >
        {Icon.heart(isWished)}
      </button>

      <div className="pcard-body">
        {product.brand && <span className="pcard-brand truncate">{product.brand}</span>}
        <Link to={to} className="pcard-name" style={{ color: 'inherit' }}>{product.name}</Link>
        {product.unit && <span className="pcard-unit">{product.unit}</span>}
        {Number(product.rating) > 0 && (
          <span className="pcard-rating">
            ★ {Number(product.rating).toFixed(1)}
            <span className="muted">({product.ratingCount?.toLocaleString?.('en-IN') ?? 0})</span>
          </span>
        )}
        <span className="pcard-price">
          <span className="now">{`₹${(product.price / 100).toLocaleString('en-IN')}`}</span>
          {off > 0 && <span className="was">{`₹${(product.mrp / 100).toLocaleString('en-IN')}`}</span>}
          {off > 0 && <span className="off">{off}%</span>}
        </span>
      </div>

      <div className="pcard-actions">
        {qty > 0 ? (
          <QuantitySelector
            value={qty}
            onChange={(next) => setQuantity(itemId, Math.max(0, next))}
            max={product.stock || 99}
            disabled={isPending}
            label={`Quantity of ${product.name}`}
          />
        ) : (
          <button
            type="button"
            className="add-btn"
            disabled={!inStock || isPending}
            onClick={() => addItem(itemId, { name: product.name })}
          >
            {isPending ? 'Adding…' : (inStock ? 'ADD' : 'Out of stock')}
          </button>
        )}
      </div>
    </article>
  );
}

export const ProductCard = memo(ProductCardComponent);

export function ProductGrid({ items, skeletonCount = 8, loading, children, className }) {
  if (loading) {
    return (
      <div className={classNames('grid-products', className)}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div className="skel-card" key={i}>
            <span className="skel skel-square" style={{ display: 'block', borderRadius: 0 }} />
            <span className="skel skel-line" style={{ width: '45%' }} />
            <span className="skel skel-line" style={{ width: '90%' }} />
            <span className="skel skel-line" style={{ width: '60%', marginBottom: 12 }} />
          </div>
        ))}
      </div>
    );
  }
  return <div className={classNames('grid-products', className)}>{children ?? items?.map((p, i) => <ProductCard key={p.id ?? p.slug} product={p} eager={i < 4} />)}</div>;
}

export function ProductRail({ items, loading }) {
  if (loading) {
    return (
      <div className="rail">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skel-card" key={i}>
            <span className="skel skel-square" style={{ display: 'block', borderRadius: 0 }} />
            <span className="skel skel-line" style={{ width: '70%' }} />
            <span className="skel skel-line" style={{ width: '45%', marginBottom: 12 }} />
          </div>
        ))}
      </div>
    );
  }
  return <div className="rail">{items?.map((p) => <ProductCard key={p.id ?? p.slug} product={p} />)}</div>;
}

export { Badge, DemoTag };
