/**
 * Shared filter panel for category and search pages: brand, price range,
 * availability and discount. Values flow through URL params so filters are
 * linkable and survive a refresh.
 */
import { useEffect, useState } from 'react';
import { formatInr } from '../utils/format.js';

export default function ProductFilters({ facets, value, onChange, onClear }) {
  const [price, setPrice] = useState({ min: value.minPrice, max: value.maxPrice });

  useEffect(() => {
    setPrice({ min: value.minPrice, max: value.maxPrice });
  }, [value.minPrice, value.maxPrice]);

  const brands = facets?.brands ?? [];
  const range = facets?.priceRange ?? { min: 0, max: 0 };
  const hasActive = value.brands.length > 0 || value.minPrice || value.maxPrice || value.inStock || value.discount;

  const toggleBrand = (brand) => {
    const next = value.brands.includes(brand)
      ? value.brands.filter((b) => b !== brand)
      : [...value.brands, brand];
    onChange({ brand: next });
  };

  return (
    <div>
      <div className="row-between mb-3">
        <h3 style={{ fontSize: 15 }}>Filters</h3>
        {hasActive && <button type="button" className="link-btn" onClick={onClear}>Clear all</button>}
      </div>

      <div className="filter-group">
        <h4>Availability</h4>
        <div className="filter-options">
          {[['', 'All products'], ['true', 'In stock only'], ['false', 'Out of stock']].map(([v, label]) => (
            <label className="check" key={v || 'all'}>
              <input type="radio" name="inStock" checked={value.inStock === v}
                onChange={() => onChange({ inStock: v })} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h4>Offers</h4>
        <label className="check">
          <input type="checkbox" checked={value.discount === 'true'}
            onChange={(e) => onChange({ discount: e.target.checked ? 'true' : '' })} />
          Discounted items only
        </label>
      </div>

      <div className="filter-group">
        <h4>Price</h4>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ minHeight: 38 }} type="number" min="0" placeholder="Min ₹"
            aria-label="Minimum price" value={price.min}
            onChange={(e) => setPrice((p) => ({ ...p, min: e.target.value }))} />
          <input className="input" style={{ minHeight: 38 }} type="number" min="0" placeholder="Max ₹"
            aria-label="Maximum price" value={price.max}
            onChange={(e) => setPrice((p) => ({ ...p, max: e.target.value }))} />
        </div>
        <button type="button" className="btn btn-secondary btn-sm btn-block mt-2"
          onClick={() => onChange({ minPrice: price.min, maxPrice: price.max })}>
          Apply price
        </button>
        {range.max > 0 && (
          <div className="chips mt-2">
            {[[0, 99], [100, 249], [250, 499], [500, 999]].map(([lo, hi]) => (
              <button type="button" key={`${lo}-${hi}`} className="chip"
                onClick={() => onChange({ minPrice: String(lo), maxPrice: String(hi) })}>
                ₹{lo}–{hi}
              </button>
            ))}
            {range.max > 1000 && (
              <button type="button" className="chip" onClick={() => onChange({ minPrice: '1000', maxPrice: '' })}>
                ₹1000+
              </button>
            )}
          </div>
        )}
      </div>

      {brands.length > 0 && (
        <div className="filter-group">
          <h4>Brand</h4>
          <div className="filter-options">
            {brands.map((b) => (
              <label className="check" key={b.brand}>
                <input type="checkbox" checked={value.brands.includes(b.brand)} onChange={() => toggleBrand(b.brand)} />
                <span className="grow truncate">{b.brand}</span>
                <span className="tiny muted">{b.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {range.max > 0 && (
        <p className="tiny muted">Catalogue prices run from {formatInr(range.min)} to {formatInr(range.max)}.</p>
      )}
    </div>
  );
}
