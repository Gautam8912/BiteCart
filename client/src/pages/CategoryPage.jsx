/**
 * Category listing with filters (brand, price, availability, discount),
 * sorting and pagination. Operates on the full catalogue via the API.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import ProductFilters from '../components/ProductFilters.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import { Breadcrumbs, EmptyState, ErrorState } from '../components/ui/index.jsx';

const SORTS = [
  ['popularity', 'Popularity'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['rating', 'Customer rating'],
  ['discount', 'Biggest discount'],
  ['newest', 'Newest first'],
];

export default function CategoryPage() {
  const { slug } = useParams();
  const { categories } = useApp();
  const [params, setParams] = useSearchParams();

  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [facets, setFacets] = useState({ brands: [], priceRange: { min: 0, max: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const category = categories.find((c) => c.slug === slug);

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
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    Endpoints.products({
      category: slug,
      sort: filters.sort,
      brand: filters.brands,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      inStock: filters.inStock || undefined,
      discount: filters.discount || undefined,
      page: filters.page,
      pageSize: 24,
    }, { signal: controller.signal })
      .then((res) => { if (alive) setData(res); })
      .catch((err) => { if (alive && err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [slug, filters]);

  useEffect(() => {
    Endpoints.facets({ category: slug }).then(setFacets).catch(() => {});
  }, [slug]);

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

  if (!loading && !category) {
    return (
      <div className="container page">
        <ErrorState title="Category not found" message={`No category matches “${slug}”.`}
          onRetry={() => window.location.assign('/categories')} />
      </div>
    );
  }

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Categories', to: '/categories' }, { label: category?.name ?? slug }]} />

      <div className="row-between mb-4 wrap">
        <div>
          <h1>{category?.name ?? 'Products'}</h1>
          {category?.tagline && <p className="muted small">{category.tagline}</p>}
        </div>
        <div className="row wrap">
          <label className="small muted" htmlFor="sort">Sort by</label>
          <select id="sort" className="select" style={{ width: 'auto', minHeight: 38 }}
            value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="filter-layout">
        <aside className={`filter-panel card card-pad${showFilters ? ' filters-open' : ''}`}>
          <ProductFilters
            facets={facets}
            value={filters}
            onChange={(patch) => update(patch)}
            onClear={() => setParams(new URLSearchParams(), { replace: true })}
          />
        </aside>

        <div>
          <div className="toolbar">
            <span className="result-count">
              {loading ? 'Loading…' : `${data.total} product${data.total === 1 ? '' : 's'}`}
            </span>
            <button type="button" className="btn btn-secondary btn-sm mobile-only-filter"
              onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => update({})} />
          ) : !loading && data.items.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No products match these filters"
              message="Try widening the price range or clearing a filter."
              action={<button type="button" className="btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear all filters</button>}
              secondaryAction={<Link to="/categories" className="btn btn-secondary">Browse categories</Link>}
            />
          ) : (
            <>
              <ProductGrid items={data.items} loading={loading} />
              {data.totalPages > 1 && (
                <div className="row mt-5" style={{ justifyContent: 'center', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={filters.page <= 1}
                    onClick={() => update({ page: filters.page - 1 }, { resetPage: false })}>
                    ← Previous
                  </button>
                  <span className="small muted">Page {data.page} of {data.totalPages}</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={filters.page >= data.totalPages}
                    onClick={() => update({ page: filters.page + 1 }, { resetPage: false })}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
