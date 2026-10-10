/** Restaurant listings with cuisine filter, sort and city scoping. */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useLocation } from '../context/LocationContext.jsx';
import { RestaurantGrid } from '../components/RestaurantCard.jsx';
import { Breadcrumbs, EmptyState, ErrorState, Alert } from '../components/ui/index.jsx';

const SORTS = [
  ['rating', 'Top rated'],
  ['eta', 'Fastest delivery'],
  ['cost-asc', 'Cost: low to high'],
  ['cost-desc', 'Cost: high to low'],
];

export default function Restaurants() {
  const { selected } = useLocation();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], cuisines: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cityOnly, setCityOnly] = useState(true);

  const cuisine = params.get('cuisine') || '';
  const sort = params.get('sort') || 'rating';
  const veg = params.get('veg') === 'true';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Endpoints.restaurants({
      city: cityOnly ? selected?.name : undefined,
      cuisine: cuisine || undefined,
      veg: veg ? 'true' : undefined,
      sort,
    })
      .then((r) => { if (alive) setData(r); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selected?.name, cuisine, sort, veg, cityOnly]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const shown = useMemo(() => data.items, [data.items]);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Restaurants' }]} />

      <div className="row-between mb-4 wrap">
        <div>
          <h1>Restaurants {cityOnly && selected ? `in ${selected.name}` : ''}</h1>
          <p className="muted small">
            {loading ? 'Loading kitchens…' : `${shown.length} restaurant${shown.length === 1 ? '' : 's'} available`}
            {selected ? ` · delivering to ${selected.locality || selected.name}` : ''}
          </p>
        </div>
        <div className="row wrap">
          <label className="check">
            <input type="checkbox" checked={cityOnly} onChange={(e) => setCityOnly(e.target.checked)} />
            Only my city
          </label>
          <label className="check">
            <input type="checkbox" checked={veg} onChange={(e) => update({ veg: e.target.checked ? 'true' : '' })} />
            Pure veg
          </label>
          <select className="select" style={{ width: 'auto', minHeight: 38 }} value={sort}
            onChange={(e) => update({ sort: e.target.value })} aria-label="Sort restaurants">
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      {selected && selected.status === 'coming-soon' && (
        <Alert tone="warning" className="mb-4">
          {selected.name} is marked as coming soon, so restaurants below are shown for browsing only —
          delivery is not operational there yet.
        </Alert>
      )}

      {data.cuisines.length > 0 && (
        <div className="chips mb-4">
          <button type="button" className="chip" aria-pressed={!cuisine} onClick={() => update({ cuisine: '' })}>All cuisines</button>
          {data.cuisines.map((c) => (
            <button type="button" key={c} className="chip" aria-pressed={cuisine === c}
              onClick={() => update({ cuisine: cuisine === c ? '' : c })}>
              {c}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => update({})} />
      ) : !loading && shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🍽"
            title="No restaurants match"
            message={cityOnly
              ? `We have no configured restaurants in ${selected?.name ?? 'your city'} with these filters. Try turning off “Only my city”.`
              : 'Try a different cuisine or clear the filters.'}
            action={<button type="button" className="btn" onClick={() => setCityOnly(false)}>Show all cities</button>}
          />
        </div>
      ) : (
        <RestaurantGrid items={shown} loading={loading} />
      )}
    </div>
  );
}
