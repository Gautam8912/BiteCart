/** Restaurant card for the listings page and homepage rail. */
import { Link } from 'react-router-dom';
import { formatInr } from '../utils/format.js';
import { VegDot, Badge } from './ui/index.jsx';

export default function RestaurantCard({ restaurant }) {
  const r = restaurant;
  return (
    <Link to={`/restaurant/${r.slug}`} className="rcard" aria-label={`${r.name}, ${r.cuisines}`}>
      <span className="rcard-media">
        <img src={r.image || `/api/images/restaurant-${r.slug}.svg`} alt="" loading="lazy" decoding="async"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        {r.isPromoted && (
          <span style={{ position: 'absolute', top: 10, left: 10 }}>
            <Badge tone="accent">Promoted</Badge>
          </span>
        )}
        {!r.isOpen && (
          <span style={{ position: 'absolute', inset: 0, background: 'rgba(15,20,26,.55)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>
            Currently closed
          </span>
        )}
      </span>

      <span className="rcard-body">
        <span className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          <span className="rcard-name truncate">{r.name}</span>
          <span className={`rating-pill${Number(r.rating) < 3.5 ? ' low' : ''}`}>★ {Number(r.rating).toFixed(1)}</span>
        </span>
        <span className="rcard-meta truncate">{r.cuisines}</span>
        <span className="rcard-meta truncate">{r.area}</span>
        <span className="rcard-foot">
          <span className="row" style={{ gap: 6 }}>
            <VegDot isVeg={r.isVeg} />
            <span>{r.etaMin}–{r.etaMax} min</span>
          </span>
          <span className="muted">
            {r.minOrder > 0 ? `Min ${formatInr(r.minOrder)}` : 'No minimum'}
          </span>
        </span>
      </span>
    </Link>
  );
}

export function RestaurantGrid({ items, loading }) {
  if (loading) {
    return (
      <div className="rgrid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skel-card" key={i}>
            <span className="skel" style={{ display: 'block', aspectRatio: '16 / 9' }} />
            <span className="skel skel-line" style={{ width: '60%' }} />
            <span className="skel skel-line" style={{ width: '85%' }} />
            <span className="skel skel-line" style={{ width: '45%', marginBottom: 12 }} />
          </div>
        ))}
      </div>
    );
  }
  return <div className="rgrid">{items?.map((r) => <RestaurantCard key={r.id ?? r.slug} restaurant={r} />)}</div>;
}
