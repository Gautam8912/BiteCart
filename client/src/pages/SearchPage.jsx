/**
 * Search results: products, restaurants and dishes, with the same filter and
 * sort controls as the category page. Runs against the full catalogue and falls
 * back to typo-tolerant matching when the server reports it did.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import RestaurantCard from '../components/RestaurantCard.jsx';
import ProductFilters from '../components/ProductFilters.jsx';
import { Breadcrumbs, EmptyState, ErrorState, Alert } from '../components/ui/index.jsx';

const SORTS = [
  ['popularity', 'Popularity'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['rating', 'Customer rating'],
  ['discount', 'Biggest discount'],
  ['newest', 'Newest first'],
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const tag = params.get('tag') || '';

  const [result, setResult] = useState({ items: [], restaurants: [], dishes: [], total: 0, totalPages: 1 });
  const [facets, setFacets] = useState({ brands: [], priceRange: { min: 0, max: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(() => ({
    sort: params.get('sort') || 'popularity',
    brands: params.getAll('brand'),
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    inStock: params.get('inStock') || '',
    discount: params.get('discount') || '',
    page: Number(params.get('page') || 1),
  }), [params]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (tag) {
          // Tag-driven listings (best sellers, deals, under ₹99) use the
          // catalogue endpoint so sorting and filters still apply.
          const res = await Endpoints.products({
            tag, sort: filters.sort, brand: filters.brands,
            minPrice: filters.minPrice || undefined, maxPrice: filters.maxPrice || undefined,
            inStock: filters.inStock || undefined, discount: filters.discount || undefined,
            page: filters.page, pageSize: 24,
          }, { signal: controller.signal });
          if (alive) setResult({ ...res, restaurants: [], dishes: [] });
        } else if (q) {
          const res = await Endpoints.search({
            q, sort: filters.sort, page: filters.page, pageSize: 24,
            minPrice: filters.minPrice || undefined, maxPrice: filters.maxPrice || undefined,
          }, { signal: controller.signal });
          if (alive) setResult(res);
        } else if (alive) {
          setResult({ items: [], restaurants: [], dishes: [], total: 0, totalPages: 1 });
        }
      } catch (err) {
        if (alive && err.name !== 'AbortError') setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; controller.abort(); };
  }, [q, tag, filters]);

  useEffect(() => { Endpoints.facets().then(setFacets).catch(() => {}); }, []);

  const update = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) next.delete(k);
      else if (Array.isArray(v)) { next.delete(k); v.forEach((item) => next.append(k, item)); }
      else next.set(k, String(v));
    });
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  const heading = tag
    ? { 'todays-deals': "Today's deals", bestseller: 'Best sellers', new: 'New arrivals', healthy: 'Healthy picks', daily: 'Daily essentials', seasonal: 'Seasonal offers' }[tag] || tag
    : (q ? `Results for “${q}”` : 'Search');

  const recentKey = 'fe.recent-searches.v1';
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(recentKey) || '[]'); } catch { recent = []; }

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: heading }]} />

      <div className="row-between mb-4 wrap">
        <div>
          <h1>{heading}</h1>
          {!loading && (q || tag) && (
            <p className="muted small">{result.total} product{result.total === 1 ? '' : 's'} found</p>
          )}
        </div>
        <div className="row wrap">
          <label className="small muted" htmlFor="sort">Sort by</label>
          <select id="sort" className="select" style={{ width: 'auto', minHeight: 38 }}
            value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      {result.fuzzyUsed && (
        <Alert tone="info" className="mb-4">
          We could not find “{q}” exactly, so these are the closest matches.
        </Alert>
      )}

      {result.restaurants?.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><h2>Restaurants</h2><p className="section-sub">Kitchens matching your search</p></div>
          </div>
          <div className="rgrid">
            {result.restaurants.map((r) => <RestaurantCard key={r.slug} restaurant={r} />)}
          </div>
        </section>
      )}

      {result.dishes?.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><h2>Dishes</h2><p className="section-sub">Menu items matching your search</p></div>
          </div>
          <div className="card card-pad">
            {result.dishes.map((d) => (
              <Link key={`${d.restaurant_slug}-${d.slug}`} to={`/restaurant/${d.restaurant_slug}`}
                className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--fe-border)', color: 'inherit' }}>
                <img src={d.image || `/api/images/dish-${d.slug}.svg`} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} loading="lazy" />
                <span className="grow">
                  <b>{d.name}</b>
                  <span className="tiny muted" style={{ display: 'block' }}>{d.restaurant_name}</span>
                </span>
                <span className="bold nowrap">₹{(d.price_paise / 100).toFixed(0)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="filter-layout">
        <aside className={`filter-panel card card-pad${showFilters ? ' filters-open' : ''}`}>
          <ProductFilters facets={facets} value={filters}
            onChange={(patch) => update(patch)}
            onClear={() => {
              const keep = new URLSearchParams();
              if (q) keep.set('q', q);
              if (tag) keep.set('tag', tag);
              setParams(keep, { replace: true });
            }} />
        </aside>

        <div>
          <div className="toolbar">
            <span className="result-count">
              {loading ? 'Searching…' : `${result.items.length} shown`}
            </span>
            <button type="button" className="btn btn-secondary btn-sm mobile-only-filter"
              onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => update({})} />
          ) : !loading && result.items.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={q ? `Nothing found for “${q}”` : 'Start a search'}
              message={q
                ? 'Check the spelling, or try a broader term like “rice”, “milk” or “biryani”.'
                : 'Search for a product, brand, cuisine or restaurant.'}
              action={<Link to="/categories" className="btn">Browse categories</Link>}
              secondaryAction={recent.length > 0 ? (
                <div className="chips" style={{ justifyContent: 'center' }}>
                  {recent.slice(0, 4).map((r) => (
                    <button key={r} type="button" className="chip"
                      onClick={() => update({ q: r, tag: '' })}>{r}</button>
                  ))}
                </div>
              ) : <Link to="/restaurants" className="btn btn-secondary">Order food</Link>}
            />
          ) : (
            <>
              <ProductGrid items={result.items} loading={loading} />
              {result.totalPages > 1 && (
                <div className="row mt-5" style={{ justifyContent: 'center', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={filters.page <= 1}
                    onClick={() => update({ page: filters.page - 1 }, { resetPage: false })}>← Previous</button>
                  <span className="small muted">Page {result.page} of {result.totalPages}</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={filters.page >= result.totalPages}
                    onClick={() => update({ page: filters.page + 1 }, { resetPage: false })}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
