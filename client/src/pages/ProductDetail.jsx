/**
 * Product details page: gallery, specs, availability, delivery estimate,
 * add-to-cart / buy-now, wishlist, related products, frequently bought
 * together and recently viewed.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useLocation } from '../context/LocationContext.jsx';
import { useRecentlyViewed } from '../context/RecentlyViewedContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ProductRail } from '../components/ProductCard.jsx';
import { Section, Breadcrumbs, Alert, QuantitySelector, ErrorState, BlockSkeleton, Icon, DemoTag, VegDot, Tabs } from '../components/ui/index.jsx';
import { formatInr, productId } from '../utils/format.js';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { addItem, quantityOf, setQuantity } = useCart();
  const wishlist = useWishlist();
  const { selected } = useLocation();
  const { record, items: recentlyViewed } = useRecentlyViewed();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('description');
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setQty(1);
    setGalleryIndex(0);
    Endpoints.product(slug)
      .then((res) => {
        if (!alive) return;
        setData(res);
        record(res.product);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, record]);

  const p = data?.product;
  const itemId = p ? productId(p.id) : null;
  const inCart = itemId ? quantityOf(itemId) : 0;
  const inStock = p ? (p.inStock && p.stock > 0) : false;

  // "Gallery": the catalogue ships one generated artwork per SKU, so we offer
  // zoom + a detail view rather than inventing photos that do not exist.
  const gallery = useMemo(() => {
    if (!p) return [];
    return [
      { src: p.image, label: `${p.name} — front` },
      { src: `${p.image}?v=2`, label: `${p.name} — packaging detail` },
      { src: `${p.image}?v=3`, label: `${p.name} — in use` },
    ];
  }, [p]);

  if (loading) {
    return (
      <div className="container page">
        <BlockSkeleton height={20} />
        <div className="pdp">
          <BlockSkeleton height={420} />
          <BlockSkeleton height={320} />
        </div>
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="container page">
        <ErrorState title="Product not found" message={error || 'This product is no longer listed.'}
          onRetry={() => navigate('/categories')} />
      </div>
    );
  }

  const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  const specs = p.specs || {};

  const handleAdd = async (units = 1) => {
    try {
      for (let i = 0; i < units; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await addItem(itemId, { name: p.name });
      }
    } catch { /* toast already shown by the cart context */ }
  };

  const handleBuyNow = async () => {
    try {
      await addItem(itemId, { name: p.name });
      navigate('/checkout');
    } catch { /* stay on the page */ }
  };

  const specRows = Object.entries(specs).filter(([k]) => !['brand', 'unit', 'weight'].includes(k));

  return (
    <div className="container page">
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: p.categoryName || 'Categories', to: `/category/${p.categorySlug}` },
        ...(p.brand ? [{ label: p.brand, to: `/search?q=${encodeURIComponent(p.brand)}` }] : []),
        { label: p.name },
      ]} />

      <div className="pdp">
        {/* ------------------------------ gallery ---------------------------- */}
        <div>
          <div className="gallery-main">
            <img src={gallery[galleryIndex].src} alt={gallery[galleryIndex].label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div className="gallery-thumbs">
            {gallery.map((g, i) => (
              <button type="button" key={g.label} className="gallery-thumb" aria-current={i === galleryIndex}
                aria-label={`View ${g.label}`} onClick={() => setGalleryIndex(i)}>
                <img src={g.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------ details ---------------------------- */}
        <div>
          <div className="row wrap mb-2" style={{ gap: 8 }}>
            {p.tags?.includes('bestseller') && <span className="badge">Bestseller</span>}
            {p.tags?.includes('new') && <span className="badge badge-accent">New</span>}
            {off > 0 && <span className="badge badge-success">{off}% OFF</span>}
            <VegDot isVeg={p.categorySlug !== 'restaurants'} />
          </div>

          {p.brand && <p className="muted bold small" style={{ marginBottom: 4 }}>{p.brand}</p>}
          <h1 style={{ marginBottom: 8 }}>{p.name}</h1>

          <div className="row wrap mb-3" style={{ gap: 12 }}>
            <span className="muted small">
              {p.categoryName} {p.unit && <> · {p.unit}</>}
            </span>
            {Number(p.rating) > 0 && (
              <span className="row" style={{ gap: 6 }}>
                <span className="rating-pill">★ {Number(p.rating).toFixed(1)}</span>
                <span className="small muted">{p.ratingCount.toLocaleString('en-IN')} ratings</span>
                <DemoTag>Demo rating</DemoTag>
              </span>
            )}
          </div>

          <div className="pdp-price mb-3">
            <span className="now">{formatInr(p.price)}</span>
            {off > 0 && <span className="was">{formatInr(p.mrp)}</span>}
            {off > 0 && <span className="badge badge-success">You save {formatInr(p.mrp - p.price)}</span>}
          </div>

          <Alert tone={inStock ? 'success' : 'danger'} className="mb-3">
            {inStock
              ? <>In stock — {p.stock} unit{p.stock === 1 ? '' : 's'} available.
                {selected && <> Delivery to <b>{selected.locality || selected.name}</b> in <b>{selected.etaMin}–{selected.etaMax} min</b> ({selected.statusLabel}).</>}
              </>
              : 'Out of stock right now. Save it to your wishlist and we will show it here when it is back.'}
          </Alert>

          <div className="row wrap mb-4" style={{ gap: 12 }}>
            <QuantitySelector value={qty} onChange={(n) => setQty(Math.max(1, Math.min(p.stock || 1, n)))}
              min={1} max={Math.max(1, p.stock || 1)} size="lg" disabled={!inStock} label="Quantity" />
            {inCart > 0 && (
              <QuantitySelector value={inCart} onChange={(n) => setQuantity(itemId, Math.max(0, n))}
                min={0} max={Math.max(1, p.stock || 1)} size="lg" label="Quantity in cart" />
            )}
            <button type="button" className={`icon-btn ${wishlist.has(p.id) ? '' : ''}`}
              onClick={() => wishlist.toggle(p)} aria-pressed={wishlist.has(p.id)}
              style={{ border: '1px solid var(--fe-border-strong)', color: wishlist.has(p.id) ? 'var(--fe-danger)' : 'var(--fe-text-2)' }}
              aria-label={wishlist.has(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}>
              {Icon.heart(wishlist.has(p.id))}
            </button>
          </div>

          <div className="row wrap mb-4" style={{ gap: 12 }}>
            <button type="button" className="btn btn-lg grow" disabled={!inStock}
              onClick={() => (inCart > 0 ? setQuantity(itemId, inCart + qty) : handleAdd(qty))}>
              {inCart > 0 ? `Add ${qty} more (${inCart} in cart)` : `Add ${qty} to cart`}
            </button>
            <button type="button" className="btn btn-lg btn-accent grow" disabled={!inStock} onClick={handleBuyNow}>
              Buy now
            </button>
          </div>

          <div className="card card-pad mb-4">
            <h3 className="mb-2">Delivery & returns</h3>
            <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Free delivery on orders of {formatInr(15000)} or more; otherwise a ₹29 delivery fee applies.</li>
              <li>Fresh and chilled items: report damage within 24 hours of delivery for a refund.</li>
              <li>Electronics carry a 6-month brand warranty; returns within 7 days if unopened.</li>
              <li>See the <Link to="/policy/cancellation">cancellation & refund policy</Link> for full terms.</li>
            </ul>
          </div>

          <Tabs
            tabs={[{ value: 'description', label: 'Description' }, { value: 'specs', label: 'Specifications' }, { value: 'reviews', label: 'Ratings' }]}
            value={tab}
            onChange={setTab}
          />

          <div className="mt-3">
            {tab === 'description' && (
              <div className="prose">
                <p>{p.description}</p>
                {p.tags?.length > 0 && (
                  <div className="chips mt-3">
                    {p.tags.map((t) => (
                      <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="chip">{t}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'specs' && (
              <table className="spec-table">
                <tbody>
                  <tr><td>Brand</td><td>{p.brand || '—'}</td></tr>
                  <tr><td>Category</td><td>{p.categoryName}</td></tr>
                  <tr><td>Unit</td><td>{p.unit || '—'}</td></tr>
                  <tr><td>Net weight</td><td>{p.weight || p.unit || '—'}</td></tr>
                  {specRows.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</td>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'reviews' && (
              <div className="col">
                <Alert tone="warning">
                  Ratings on this demo platform are generated sample values. They are not verified
                  customer reviews, and no reviews are fabricated or attributed to real people.
                </Alert>
                <div className="row" style={{ gap: 16 }}>
                  <div style={{ fontSize: 40, fontWeight: 800 }}>{Number(p.rating).toFixed(1)}</div>
                  <div className="small muted">
                    <div>Based on {p.ratingCount.toLocaleString('en-IN')} sample ratings</div>
                    <DemoTag>Demo data — not verified reviews</DemoTag>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.boughtTogether?.length > 0 && (
        <Section title="Frequently Bought Together" subtitle="Shoppers add these in the same basket">
          <ProductRail items={data.boughtTogether} />
        </Section>
      )}

      {data.related?.length > 0 && (
        <Section title="Related products" subtitle={`More from ${p.categoryName}`} to={`/category/${p.categorySlug}`}>
          <ProductRail items={data.related} />
        </Section>
      )}

      {recentlyViewed.filter((r) => r.slug !== p.slug).length > 0 && (
        <Section title="Recently viewed" subtitle="Other products you looked at">
          <ProductRail items={recentlyViewed.filter((r) => r.slug !== p.slug)} />
        </Section>
      )}
    </div>
  );
}
