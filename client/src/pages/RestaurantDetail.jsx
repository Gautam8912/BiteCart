/**
 * Restaurant page: menu by category with veg/non-veg marks, variations and
 * add-ons, plus the one-restaurant-per-cart rule handled explicitly.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLocation } from '../context/LocationContext.jsx';
import RestaurantCard, { RestaurantGrid } from '../components/RestaurantCard.jsx';
import {
  Breadcrumbs, EmptyState, ErrorState, BlockSkeleton, Modal, VegDot, Badge,
  QuantitySelector, Alert, DemoTag,
} from '../components/ui/index.jsx';
import { formatInr, menuItemId } from '../utils/format.js';

export default function RestaurantDetail() {
  const { slug } = useParams();
  const { addItem, quantityOf, setQuantity, restaurant: cartRestaurant, items: cartItems } = useCart();
  const toast = useToast();
  const { selected } = useLocation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [customizing, setCustomizing] = useState(null);
  const [choices, setChoices] = useState({});
  const [vegOnly, setVegOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Endpoints.restaurant(slug)
      .then((r) => {
        if (!alive) return;
        setData(r);
        setActiveCat(r.menu[0]?.name ?? null);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  const r = data?.restaurant;
  const menu = useMemo(() => {
    if (!data) return [];
    return vegOnly
      ? data.menu.map((c) => ({ ...c, items: c.items.filter((i) => i.isVeg) })).filter((c) => c.items.length > 0)
      : data.menu;
  }, [data, vegOnly]);

  if (loading) {
    return (
      <div className="container page">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Restaurants', to: '/restaurants' }, { label: slug }]} />
        <BlockSkeleton height={180} />
        <BlockSkeleton height={320} />
      </div>
    );
  }

  if (error || !r) {
    return (
      <div className="container page">
        <ErrorState title="Restaurant not found" message={error || 'This restaurant is not listed.'}
          onRetry={() => window.location.assign('/restaurants')} />
      </div>
    );
  }

  const isDifferentRestaurant = cartRestaurant && cartRestaurant.slug !== r.slug;

  const openCustomize = (item) => {
    const initial = {};
    (item.variations || []).forEach((group) => {
      initial[group[0]] = group[2][0]; // first option of each group
    });
    setChoices({ ...initial, __addons: [] });
    setCustomizing(item);
  };

  const buildOptions = (item) => {
    const out = [];
    (item.variations || []).forEach((group) => {
      const chosen = choices[group[0]];
      if (chosen) out.push({ group: group[0], option: chosen[0], pricePaise: chosen[1] * 100 });
    });
    (choices.__addons || []).forEach((a) => out.push({ addon: a[0], pricePaise: a[1] * 100 }));
    return out;
  };

  const optionsTotal = (item) => buildOptions(item).reduce((sum, o) => sum + (o.pricePaise || 0), 0);

  const doAdd = (item, options = []) => {
    if (isDifferentRestaurant) {
      toast.error(`Your cart already has items from ${cartRestaurant.name}. Remove them first, or save them for later — one restaurant per order.`);
      return;
    }
    addItem(menuItemId(r.id, item.id), { options, name: item.name });
  };

  return (
    <div className="container page">
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: 'Restaurants', to: '/restaurants' },
        { label: r.name },
      ]} />

      {/* ---------------------------- header ---------------------------- */}
      <div className="card card-pad mb-4" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <img src={r.image} alt="" style={{ width: 132, height: 96, borderRadius: 12, objectFit: 'cover' }} />
        <div className="grow" style={{ minWidth: 220 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 4 }}>
            <VegDot isVeg={r.isVeg} />
            <h1 style={{ fontSize: 24 }}>{r.name}</h1>
            {!r.isOpen && <Badge tone="danger">Closed</Badge>}
          </div>
          <p className="muted small" style={{ marginBottom: 6 }}>{r.cuisines} · {r.area}</p>
          <div className="row wrap" style={{ gap: 12 }}>
            <span className="rating-pill">★ {Number(r.rating).toFixed(1)}</span>
            <span className="small muted">{r.ratingCount.toLocaleString('en-IN')} ratings</span>
            <DemoTag>Demo rating</DemoTag>
          </div>
          <p className="small muted mt-2" style={{ maxWidth: '68ch' }}>{r.about}</p>
        </div>
        <div className="col" style={{ gap: 6, minWidth: 170 }}>
          <span className="pill">⏱ {r.etaMin}–{r.etaMax} min</span>
          <span className="pill">₹{formatInr(r.costForTwo).slice(1)} for two</span>
          <span className="pill">{r.minOrder > 0 ? `Min order ${formatInr(r.minOrder)}` : 'No minimum'}</span>
          {selected && <span className="pill tiny">{selected.locality || selected.name}</span>}
        </div>
      </div>

      {isDifferentRestaurant && (
        <Alert tone="warning" className="mb-4">
          <span className="grow">
            Your cart has items from <b>{cartRestaurant.name}</b>. Orders can contain items from only one
            restaurant — <Link to="/cart">review your cart</Link> before adding from {r.name}.
          </span>
        </Alert>
      )}

      <div className="row-between mb-3 wrap">
        <div className="chips">
          {menu.map((c) => (
            <button type="button" key={c.name} className="chip" aria-pressed={activeCat === c.name}
              onClick={() => setActiveCat(c.name)}>
              {c.name} ({c.items.length})
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
          Veg only
        </label>
      </div>

      {menu.length === 0 ? (
        <EmptyState icon="🥗" title="No veg items on this menu" message="Turn off the veg filter to see everything." />
      ) : (
        menu.map((category) => (
          <section key={category.name} className="menu-section" id={`menu-${category.name.replace(/\s+/g, '-')}`}>
            <h2 className="mb-3">{category.name}</h2>
            <div className="card card-pad">
              {category.items.map((item) => {
                const hasOptions = (item.variations?.length || 0) > 0 || (item.addons?.length || 0) > 0;
                const id = menuItemId(r.id, item.id);
                const qty = quantityOf(id);
                return (
                  <div className="menu-item" key={item.id}>
                    <div>
                      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                        <VegDot isVeg={item.isVeg} />
                        <b>{item.name}</b>
                        {item.isBestSeller && <Badge tone="accent">Bestseller</Badge>}
                      </div>
                      <div className="bold">{formatInr(item.price)} {item.mrp > item.price && <span className="muted small" style={{ textDecoration: 'line-through', fontWeight: 400 }}>{formatInr(item.mrp)}</span>}</div>
                      <p className="small muted" style={{ maxWidth: '62ch', marginTop: 4 }}>{item.description}</p>
                      {qty > 0 && <p className="tiny" style={{ color: 'var(--fe-primary-dark)', marginTop: 6 }}>{qty} in your cart</p>}
                    </div>

                    <div className="menu-thumb">
                      <img src={item.image} alt="" loading="lazy" />
                      <span className="add-overlay">
                        {qty > 0 ? (
                          <QuantitySelector
                            value={qty}
                            onChange={(n) => setQuantity(id, Math.max(0, n))}
                            min={0}
                            max={20}
                            label={`Quantity of ${item.name}`}
                          />
                        ) : (
                          <button type="button" className="add-btn" disabled={!r.isOpen || isDifferentRestaurant}
                            onClick={() => (hasOptions ? openCustomize(item) : doAdd(item))}>
                            {!r.isOpen ? 'Closed' : hasOptions ? 'Customise' : 'ADD'}
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {data.nearby?.length > 0 && (
        <section className="section mt-5">
          <div className="section-head">
            <div><h2>Similar restaurants nearby</h2><p className="section-sub">Other kitchens in {r.city}</p></div>
          </div>
          <RestaurantGrid items={data.nearby} />
        </section>
      )}

      {/* ------------------------ customisation modal --------------------- */}
      <Modal
        open={!!customizing}
        onClose={() => setCustomizing(null)}
        title={customizing?.name}
        footer={customizing && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCustomizing(null)}>Cancel</button>
            <button type="button" className="btn"
              onClick={() => { doAdd(customizing, buildOptions(customizing)); setCustomizing(null); }}>
              Add · {formatInr(customizing.price + optionsTotal(customizing))}
            </button>
          </>
        )}
      >
        {customizing && (
          <div className="col" style={{ gap: 16 }}>
            {(customizing.variations || []).map((group) => (
              <div key={group[0]}>
                <div className="row-between mb-2">
                  <h4>{group[0]}</h4>
                  {group[1] === 1 && <span className="tiny muted">Required</span>}
                </div>
                <div className="filter-options">
                  {group[2].map((opt) => (
                    <label className="check" key={opt[0]}>
                      <input
                        type="radio"
                        name={group[0]}
                        checked={choices[group[0]]?.[0] === opt[0]}
                        onChange={() => setChoices((c) => ({ ...c, [group[0]]: opt }))}
                      />
                      <span className="grow">{opt[0]}</span>
                      {opt[1] !== 0 && <span className="small muted">{opt[1] > 0 ? '+' : '−'}₹{Math.abs(opt[1])}</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {(customizing.addons || []).length > 0 && (
              <div>
                <h4 className="mb-2">Add-ons</h4>
                <div className="filter-options">
                  {customizing.addons.map((addon) => {
                    const checked = (choices.__addons || []).some((a) => a[0] === addon[0]);
                    return (
                      <label className="check" key={addon[0]}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setChoices((c) => ({
                            ...c,
                            __addons: e.target.checked
                              ? [...(c.__addons || []), addon]
                              : (c.__addons || []).filter((a) => a[0] !== addon[0]),
                          }))}
                        />
                        <span className="grow">{addon[0]}</span>
                        <span className="small muted">+₹{addon[1]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="tiny muted">
              Different options are kept as separate cart lines, so “half plate” and “full plate” never
              merge into a single quantity.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
