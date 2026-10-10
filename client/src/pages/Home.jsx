/**
 * Homepage: carousel, category shortcuts and every product rail. Each rail is
 * fed by real catalogue queries, and every tile links to a working page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useLocation } from '../context/LocationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRecentlyViewed } from '../context/RecentlyViewedContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { Endpoints } from '../api/client.js';
import { ProductRail } from '../components/ProductCard.jsx';
import { CategoryGrid } from '../components/CategoryCard.jsx';
import RestaurantCard, { RestaurantGrid } from '../components/RestaurantCard.jsx';
import { Section, ErrorState, Skeleton, Alert } from '../components/ui/index.jsx';
import { formatInr } from '../utils/format.js';

/* ------------------------------ carousel --------------------------------- */
const SLIDES = [
  {
    key: 'free-delivery',
    title: 'Free delivery on orders above ₹150',
    body: 'Stock up on staples, fresh produce and daily essentials in one order.',
    cta: 'Shop daily essentials',
    to: '/category/groceries',
    gradient: 'linear-gradient(120deg, #0b5f3d, #17a06a)',
    tag: 'Everyday save',
  },
  {
    key: 'fresh',
    title: 'Farm-fresh fruits & vegetables',
    body: 'Graded, cleaned and delivered chilled. Under ₹99 on most items.',
    cta: 'Shop fresh produce',
    to: '/category/fruits-vegetables',
    gradient: 'linear-gradient(120deg, #2f6d33, #7ab648)',
    tag: 'In season',
  },
  {
    key: 'food',
    title: 'Restaurant meals in 20 minutes',
    body: 'Biryani, Andhra meals, tandoor and Chinese from kitchens near you.',
    cta: 'Order food now',
    to: '/restaurants',
    gradient: 'linear-gradient(120deg, #b8410b, #e8590c)',
    tag: 'Hot & fresh',
  },
  {
    key: 'deals',
    title: "Today's deals — up to 30% off",
    body: 'The biggest discounts across the catalogue, refreshed daily.',
    cta: 'See all deals',
    to: '/search?tag=todays-deals',
    gradient: 'linear-gradient(120deg, #7c2d12, #c2410c)',
    tag: 'Limited time',
  },
];

function Carousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5200);
    return () => clearInterval(t);
  }, [paused]);

  const go = (n) => setIndex((n + SLIDES.length) % SLIDES.length);

  return (
    <div className="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      role="region" aria-roledescription="carousel" aria-label="Featured offers">
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {SLIDES.map((s, i) => (
          <div className="carousel-slide" key={s.key} aria-hidden={i !== index}>
            <Link to={s.to} className="banner" style={{ background: s.gradient, minHeight: 240 }} tabIndex={i === index ? 0 : -1}>
              <span className="badge" style={{ background: 'rgba(255,255,255,.22)', color: '#fff', marginBottom: 10 }}>{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="btn btn-sm">{s.cta} →</span>
            </Link>
          </div>
        ))}
      </div>

      <button type="button" className="carousel-nav prev" onClick={() => go(index - 1)} aria-label="Previous offer">‹</button>
      <button type="button" className="carousel-nav next" onClick={() => go(index + 1)} aria-label="Next offer">›</button>

      <div className="carousel-dots">
        {SLIDES.map((s, i) => (
          <button key={s.key} type="button" className="carousel-dot" aria-current={i === index}
            aria-label={`Go to offer ${i + 1}`} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- page ----------------------------------- */
export default function Home() {
  const { categories, sections, phase, error, boot, config } = useApp();
  const { selected } = useLocation();
  const { bill, settings } = useCart();
  const { user } = useAuth();
  const { items: recentItems } = useRecentlyViewed();
  const wishlist = useWishlist();
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState([]);
  const [restLoading, setRestLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setRestLoading(true);
    Endpoints.restaurants({ city: selected?.name, sort: 'rating' })
      .then((r) => { if (alive) setRestaurants(r.items); })
      .catch(() => { if (alive) setRestaurants([]); })
      .finally(() => { if (alive) setRestLoading(false); });
    return () => { alive = false; };
  }, [selected?.name]);

  /** Frequently-bought-together is derived from a real basket pattern. */
  const frequentlyBought = useMemo(() => {
    const staples = sections.find((s) => s.key === 'daily-essentials')?.items ?? [];
    const fresh = sections.find((s) => s.key === 'fruits-vegetables')?.items ?? [];
    return [...staples.slice(0, 2), ...fresh.slice(0, 2)];
  }, [sections]);

  const reorderItems = useMemo(() => wishlist.items.slice(0, 8), [wishlist.items]);
  const loading = phase === 'loading';

  const sectionByKey = Object.fromEntries((sections || []).map((s) => [s.key, s]));
  const get = (key) => sectionByKey[key]?.items ?? [];

  return (
    <div className="container page-tight">
      {/* ------------------------------ hero ------------------------------ */}
      {error ? (
        <ErrorState message={error} onRetry={boot} title="Food Express could not start" />
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <Carousel />
          </div>

          {!user && (
            <Alert tone="info" className="mb-4">
              <span className="grow">
                Browsing as a guest — your cart is saved on this device.{' '}
                <Link to="/login">Sign in</Link> to keep it across devices and place an order.
              </span>
            </Alert>
          )}

          {selected?.status && !['live-simulated', 'limited'].includes(selected.status) && (
            <Alert tone="warning" className="mb-4">
              <b>{selected.name}</b> is listed as {(selected.statusLabel ?? selected.status).toLowerCase()}. Choose another city to see
              serviceable delivery estimates.
            </Alert>
          )}

          {/* --------------------------- categories -------------------------- */}
          <Section title="Shop by category" subtitle={selected ? `Delivering to ${selected.locality || selected.name}` : 'Choose a city for accurate delivery times'}
            to="/categories" linkLabel="All categories">
            {loading ? (
              <div className="cat-grid">
                {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} style={{ height: 108 }} />)}
              </div>
            ) : (
              <CategoryGrid categories={categories} />
            )}
          </Section>

          {/* ---------------------- best sellers / deals --------------------- */}
          <Section id="best-sellers" title="Best Sellers" subtitle="Most ordered this week" to="/search?tag=bestseller">
            <ProductRail items={get('best-sellers')} loading={loading} />
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
            <Link to="/category/fruits-vegetables" className="banner banner-compact" style={{ background: 'linear-gradient(120deg,#2f6d33,#7ab648)' }}>
              <h3>Fresh fruits & vegetables</h3>
              <p>Sorted, cleaned and delivered chilled.</p>
              <span className="btn btn-sm">Shop fresh →</span>
            </Link>
            <Link to="/restaurants" className="banner banner-compact" style={{ background: 'linear-gradient(120deg,#b8410b,#e8590c)' }}>
              <h3>Restaurant meals near you</h3>
              <p>Biryani, thalis, tandoor & more in 20 minutes.</p>
              <span className="btn btn-sm">Order food →</span>
            </Link>
            <Link to="/category/electronics" className="banner banner-compact" style={{ background: 'linear-gradient(120deg,#1f3a5f,#3b6ea5)' }}>
              <h3>Electronics & accessories</h3>
              <p>Cables, audio, power banks and mobile gear.</p>
              <span className="btn btn-sm">Shop electronics →</span>
            </Link>
          </div>

          <Section id="popular" title="Popular Near You"
            subtitle={selected ? `Moving fastest around ${selected.name}` : 'Moving fastest right now'}
            to="/search?sort=popularity">
            <ProductRail items={get('popular-near-you')} loading={loading} />
          </Section>

          <Section id="deals" title="Today's Deals" subtitle="Biggest discounts in the catalogue" to="/search?tag=todays-deals">
            <ProductRail items={get('todays-deals')} loading={loading} />
          </Section>

          <Section id="under99" title="Under ₹99" subtitle="Everyday picks under a hundred" to="/search?maxPrice=99">
            <ProductRail items={get('under-99')} loading={loading} />
          </Section>

          {frequentlyBought.length > 0 && (
            <Section id="fbt" title="Frequently Bought Together" subtitle="Staples shoppers add in the same order">
              <ProductRail items={frequentlyBought} loading={loading} />
            </Section>
          )}

          <Section id="trending" title="Trending Products" subtitle="Newly listed and gaining traction" to="/search?sort=newest">
            <ProductRail items={get('trending')} loading={loading} />
          </Section>

          <Section id="fresh" title="Fresh Fruits & Vegetables" subtitle="Graded and delivered chilled" to="/category/fruits-vegetables">
            <ProductRail items={get('fruits-vegetables')} loading={loading} />
          </Section>

          <Section id="daily" title="Daily Essentials" subtitle="Restock the basics" to="/search?tag=daily">
            <ProductRail items={get('daily-essentials')} loading={loading} />
          </Section>

          <Section id="restaurants" title="Top Restaurants" subtitle={selected ? `Open near ${selected.name}` : 'Top rated kitchens'}
            to="/restaurants" linkLabel="See all restaurants">
            <RestaurantGrid items={restaurants.slice(0, 6)} loading={restLoading} />
          </Section>

          <Section id="brands" title="Featured Brands" subtitle="Brands shoppers reorder" to="/search?sort=popularity">
            <ProductRail items={get('featured-brands')} loading={loading} />
          </Section>

          {recentItems.length > 0 && (
            <Section id="recent" title="Recently Viewed" subtitle="Pick up where you left off">
              <ProductRail items={recentItems} loading={false} />
            </Section>
          )}

          {reorderItems.length > 0 && (
            <Section id="reorder" title="Reorder Your Favourites" subtitle="From your wishlist" to="/wishlist">
              <ProductRail items={reorderItems} loading={false} />
            </Section>
          )}

          {get('seasonal').length > 0 && (
            <Section id="seasonal" title="Seasonal Offers" subtitle="In season, in stock" to="/search?tag=seasonal">
              <ProductRail items={get('seasonal')} loading={loading} />
            </Section>
          )}

          <Section id="electronics" title="Electronics & Accessories" subtitle="Cables, audio, storage and more" to="/category/electronics">
            <ProductRail items={get('electronics')} loading={loading} />
          </Section>

          {/* --------------------------- free-delivery CTA ------------------- */}
          <section className="section">
            <div className="card card-pad-lg" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 260 }}>
                <h2>Free delivery over {formatInr(settings?.freeDeliveryThreshold ?? 15000)}</h2>
                <p className="muted small" style={{ maxWidth: '52ch' }}>
                  {bill.itemCount > 0
                    ? `Your cart is at ${formatInr(bill.subtotalPaise)}. ${bill.delivery.unlocked ? 'Free delivery is unlocked.' : `Add ${formatInr(bill.delivery.remaining)} more to unlock it.`}`
                    : 'Add products worth ₹150 or more in a single order and the delivery fee is waived automatically.'}
                </p>
              </div>
              <div className="row wrap">
                <button type="button" className="btn" onClick={() => navigate('/categories')}>Start shopping</button>
                {bill.itemCount > 0 && <button type="button" className="btn btn-secondary" onClick={() => navigate('/cart')}>View cart</button>}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
