/**
 * Admin dashboard.
 *
 * The UI is a convenience; the server re-checks the `admin` role on every
 * request, so a customer cannot reach these endpoints even by calling them
 * directly. Every mutation here writes an audit log entry.
 */
import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Endpoints } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Breadcrumbs, Alert, BlockSkeleton, Tabs, Modal } from '../../components/ui/index.jsx';
import { formatInr, formatDate } from '../../utils/format.js';

const NAV = [
  ['/admin', 'Overview', true],
  ['/admin/products', 'Products'],
  ['/admin/restaurants', 'Restaurants'],
  ['/admin/orders', 'Orders'],
  ['/admin/coupons', 'Coupons'],
  ['/admin/settings', 'Settings & fees'],
  ['/admin/zones', 'Cities & zones'],
  ['/admin/users', 'Users'],
  ['/admin/tickets', 'Support'],
  ['/admin/audit', 'Audit log'],
];

/* ------------------------------- Overview -------------------------------- */
function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const load = () => Endpoints.admin.stats().then(setStats).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!stats) return <BlockSkeleton height={120} count={3} />;

  const maxRev = Math.max(1, ...stats.last14Days.map((d) => d.revenue));

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="stat-grid">
        <div className="stat"><b>{stats.today.orders}</b><span>Orders today</span></div>
        <div className="stat"><b>{formatInr(stats.today.revenue)}</b><span>Revenue today</span></div>
        <div className="stat"><b>{stats.totals.orders}</b><span>Orders total</span></div>
        <div className="stat"><b>{formatInr(stats.totals.revenue)}</b><span>Revenue total</span></div>
        <div className="stat"><b>{stats.totals.activeProducts}</b><span>Active products</span></div>
        <div className="stat"><b>{stats.totals.outOfStock}</b><span>Out of stock</span></div>
        <div className="stat"><b>{stats.totals.customers}</b><span>Customers</span></div>
        <div className="stat"><b>{stats.totals.openTickets}</b><span>Open tickets</span></div>
      </div>

      <div className="card card-pad">
        <h3 className="mb-3">Revenue, last 14 days</h3>
        {stats.last14Days.length === 0 ? (
          <p className="small muted">No orders yet — place one from the storefront to see it here.</p>
        ) : (
          <>
            <div className="bar-chart">
              {stats.last14Days.map((d) => (
                <div key={d.day} className="bar" title={`${d.day}: ${formatInr(d.revenue)} (${d.orders} orders)`}>
                  <span style={{ height: `${Math.max(3, (d.revenue / maxRev) * 100)}%` }} />
                </div>
              ))}
            </div>
            <p className="tiny muted mt-2">Hover a bar for the exact figure.</p>
          </>
        )}
      </div>

      <div className="card card-pad">
        <h3 className="mb-3">Low stock (≤ 10 units)</h3>
        {stats.lowStock.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Nothing is running low.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Product</th><th>Slug</th><th className="num">Stock</th></tr></thead>
              <tbody>
                {stats.lowStock.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="tiny muted">{p.slug}</td>
                    <td className="num">
                      <span className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>{p.stock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <h3 className="mb-3">Orders by status</h3>
        <div className="chips">
          {stats.ordersByStatus.length === 0 && <span className="small muted">No orders yet.</span>}
          {stats.ordersByStatus.map((s) => (
            <span key={s.status} className="pill">{s.status.replace(/_/g, ' ')}: <b>{s.n}</b></span>
          ))}
        </div>
      </div>

      {stats.topProducts.length > 0 && (
        <div className="card card-pad">
          <h3 className="mb-3">Top products</h3>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {stats.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td><td className="num">{p.units}</td><td className="num">{formatInr(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Products -------------------------------- */
function Products() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = (query) => {
    setLoading(true);
    Endpoints.admin.products(query).then((r) => setItems(r.items)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); Endpoints.admin.categories().then((r) => setCats(r.items)); }, []);

  const open = (p) => {
    setEditing(p);
    setForm({
      name: p.name, brand: p.brand, categorySlug: p.category_slug, description: p.description,
      price: (p.price_paise / 100).toFixed(0), mrp: (p.mrp_paise / 100).toFixed(0),
      unit: p.unit, weight: p.weight, stock: p.stock, tags: p.tags,
      isActive: !!p.is_active, isVeg: !!p.is_veg,
    });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        price: Math.round(Number(form.price) * 100),
        mrp: Math.round(Number(form.mrp) * 100),
        stock: Number(form.stock),
      };
      if (editing.id) {
        const res = await Endpoints.admin.updateProduct(editing.id, body);
        setItems((list) => list.map((p) => (p.id === res.product.id ? res.product : p)));
        toast.success('Product updated');
      } else {
        const res = await Endpoints.admin.createProduct(body);
        setItems((list) => [res.product, ...list]);
        toast.success('Product created');
      }
      setEditing(null);
    } catch (err) { toast.error(err.message); }
  };

  const quickStock = async (p) => {
    const next = window.prompt(`New stock for ${p.name}`, p.stock);
    if (next === null) return;
    try {
      const res = await Endpoints.admin.setStock(p.id, Number(next));
      setItems((list) => list.map((x) => (x.id === p.id ? res.product : x)));
      toast.success('Stock updated');
    } catch (err) { toast.error(err.message); }
  };

  const deactivate = async (p) => {
    if (!window.confirm(`Deactivate ${p.name}? It disappears from the storefront but stays in order history.`)) return;
    try {
      await Endpoints.admin.deactivateProduct(p.id);
      setItems((list) => list.map((x) => (x.id === p.id ? { ...x, is_active: 0 } : x)));
      toast.info('Product deactivated');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-between wrap">
        <h2>Products</h2>
        <button type="button" className="btn btn-sm" onClick={() => open({ id: null })}>+ New product</button>
      </div>

      <div className="row wrap">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search name or slug" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(q); }} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(q)}>Search</button>
      </div>

      {loading ? <BlockSkeleton height={300} /> : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Product</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.slice(0, 200).map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <div className="tiny muted">{p.slug} · {p.brand || '—'}</div>
                  </td>
                  <td className="small">{p.category_name || p.category_slug}</td>
                  <td className="num">{formatInr(p.price_paise)}</td>
                  <td className="num">
                    <span className={`badge ${p.stock === 0 ? 'badge-danger' : p.stock <= 10 ? 'badge-warning' : 'badge-neutral'}`}>{p.stock}</span>
                  </td>
                  <td>{p.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" className="link-btn" onClick={() => quickStock(p)}>Stock</button>
                      <button type="button" className="link-btn" onClick={() => open(p)}>Edit</button>
                      {p.is_active ? <button type="button" className="link-btn" onClick={() => deactivate(p)}>Deactivate</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tiny muted">Showing the first 200 of {items.length} matching rows.</p>

      <Modal open={!!editing} onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit product' : 'New product'} size={620}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="product-form" className="btn">Save product</button>
          </>
        )}>
        <form id="product-form" onSubmit={save} className="col" style={{ gap: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="pf-name">Name</label>
            <input id="pf-name" className="input" required value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="pf-brand">Brand</label>
              <input id="pf-brand" className="input" value={form.brand || ''}
                onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="pf-cat">Category</label>
              <select id="pf-cat" className="select" required value={form.categorySlug || ''}
                onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}>
                <option value="">Choose…</option>
                {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pf-desc">Description</label>
            <textarea id="pf-desc" className="textarea" value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="pf-price">Price ₹</label>
              <input id="pf-price" className="input" type="number" min="0" required value={form.price ?? ''}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="pf-mrp">MRP ₹</label>
              <input id="pf-mrp" className="input" type="number" min="0" required value={form.mrp ?? ''}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="pf-stock">Stock</label>
              <input id="pf-stock" className="input" type="number" min="0" value={form.stock ?? 0}
                onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
          </div>
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="pf-unit">Unit</label>
              <input id="pf-unit" className="input" placeholder="500 g" value={form.unit || ''}
                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="pf-tags">Tags (space separated)</label>
              <input id="pf-tags" className="input" placeholder="bestseller daily" value={form.tags || ''}
                onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active (visible on the storefront)
          </label>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------ Restaurants ------------------------------ */
function Restaurants() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Endpoints.admin.restaurants().then((r) => setItems(r.items)).finally(() => setLoading(false)); }, []);

  const toggle = async (r, patch) => {
    try {
      const res = await Endpoints.admin.updateRestaurant(r.id, patch);
      setItems((list) => list.map((x) => (x.id === r.id ? res.restaurant : x)));
      toast.success('Restaurant updated');
    } catch (err) { toast.error(err.message); }
  };

  const setMinOrder = async (r) => {
    const next = window.prompt(`Minimum order for ${r.name} (₹)`, (r.min_order_paise / 100).toFixed(0));
    if (next === null) return;
    toggle(r, { minOrder: Math.round(Number(next) * 100) });
  };

  if (loading) return <BlockSkeleton height={300} />;

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Restaurants</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Restaurant</th><th>City</th><th className="num">ETA</th><th className="num">Min order</th><th>Open</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b><div className="tiny muted">{r.cuisines}</div></td>
                <td className="small">{r.city}</td>
                <td className="num">{r.eta_min}–{r.eta_max}m</td>
                <td className="num">{formatInr(r.min_order_paise)}</td>
                <td>
                  <button type="button" className={`badge ${r.is_open ? 'badge-success' : 'badge-neutral'}`}
                    style={{ cursor: 'pointer', border: 0 }}
                    onClick={() => toggle(r, { isOpen: !r.is_open })}>
                    {r.is_open ? 'Open' : 'Closed'}
                  </button>
                </td>
                <td>
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="link-btn" onClick={() => setMinOrder(r)}>Min order</button>
                    <button type="button" className="link-btn" onClick={() => toggle(r, { isPromoted: !r.is_promoted })}>
                      {r.is_promoted ? 'Unpromote' : 'Promote'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">Menu editing is available through the API (<code>POST /api/admin/restaurants/:id/menu</code> and <code>PUT /api/admin/menu/:id</code>).</p>
    </div>
  );
}

/* -------------------------------- Orders --------------------------------- */
function Orders() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => {
    setLoading(true);
    Endpoints.admin.orders({ status: status || undefined })
      .then((r) => setItems(r.items)).finally(() => setLoading(false));
  };
  useEffect(load, [status]);

  const advance = async (o, next) => {
    try {
      const res = await Endpoints.admin.setOrderStatus(o.orderNumber, next, 'Updated from the admin dashboard.');
      setItems((list) => list.map((x) => (x.orderNumber === o.orderNumber ? { ...x, status: res.order.status, statusLabel: res.order.statusLabel } : x)));
      toast.success(`${o.orderNumber} → ${res.order.statusLabel}`);
    } catch (err) { toast.error(err.message); }
  };

  const FLOW = { grocery: ['placed', 'confirmed', 'packing', 'out_for_delivery', 'delivered'], food: ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'] };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-between wrap">
        <h2>Orders</h2>
        <select className="select" style={{ width: 'auto', minHeight: 38 }} value={status} onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status">
          <option value="">All statuses</option>
          {['placed', 'confirmed', 'packing', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {loading ? <BlockSkeleton height={300} /> : items.length === 0 ? (
        <p className="small muted">No orders match this filter.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Order</th><th>Customer</th><th className="num">Total</th><th>Status</th><th>Advance</th></tr></thead>
            <tbody>
              {items.map((o) => {
                const flow = FLOW[o.kind] || FLOW.grocery;
                const next = flow[flow.indexOf(o.status) + 1];
                return (
                  <tr key={o.id}>
                    <td>
                      <button type="button" className="link-btn" style={{ fontSize: 13.5 }} onClick={() => setDetail(o)}>{o.orderNumber}</button>
                      <div className="tiny muted">{formatDate(o.placedAt, true)} · {o.kind}</div>
                    </td>
                    <td className="small">{o.customer?.name}<div className="tiny muted">{o.customer?.email}</div></td>
                    <td className="num">{formatInr(o.total)}</td>
                    <td><span className="badge badge-neutral">{o.statusLabel}</span></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {next && <button type="button" className="btn btn-sm btn-secondary" onClick={() => advance(o, next)}>→ {next.replace(/_/g, ' ')}</button>}
                        {o.status !== 'cancelled' && o.status !== 'delivered' && (
                          <button type="button" className="link-btn" onClick={() => advance(o, 'cancelled')}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.orderNumber} size={620}>
        {detail && (
          <div className="col" style={{ gap: 10 }}>
            <p className="small"><b>Customer:</b> {detail.customer?.name} ({detail.customer?.email})</p>
            <p className="small"><b>Address:</b> {detail.address?.line1}, {detail.address?.city} {detail.address?.pincode}</p>
            <p className="small"><b>Payment:</b> {detail.paymentMethod} · {detail.paymentStatus}
              {detail.paymentMode !== 'cod' && <span className="demo-tag" style={{ marginLeft: 6 }}>Simulated</span>}</p>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Line</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  <tr><td>Subtotal</td><td className="num">{formatInr(detail.subtotal)}</td></tr>
                  <tr><td>Discount {detail.couponCode ? `(${detail.couponCode})` : ''}</td><td className="num">−{formatInr(detail.discount)}</td></tr>
                  <tr><td>Delivery</td><td className="num">{detail.deliveryFee === 0 ? 'FREE' : formatInr(detail.deliveryFee)}</td></tr>
                  <tr><td>Tax</td><td className="num">{formatInr(detail.tax)}</td></tr>
                  <tr><td><b>Total</b></td><td className="num"><b>{formatInr(detail.total)}</b></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------- Coupons -------------------------------- */
function Coupons() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { Endpoints.admin.coupons().then((r) => setItems(r.items)).finally(() => setLoading(false)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        minSubtotal: Math.round(Number(form.minSubtotal || 0) * 100),
        maxDiscount: form.maxDiscount ? Math.round(Number(form.maxDiscount) * 100) : null,
      };
      if (form.id) {
        const res = await Endpoints.admin.updateCoupon(form.id, body);
        setItems((list) => list.map((c) => (c.id === res.coupon.id ? res.coupon : c)));
        toast.success('Coupon updated');
      } else {
        const res = await Endpoints.admin.createCoupon(body);
        setItems((list) => [...list, res.coupon]);
        toast.success('Coupon created');
      }
      setEditing(null);
    } catch (err) { toast.error(err.message); }
  };

  const toggleActive = async (c) => {
    try {
      const res = await Endpoints.admin.updateCoupon(c.id, { isActive: !c.is_active });
      setItems((list) => list.map((x) => (x.id === c.id ? res.coupon : x)));
      toast.info(`${c.code} ${res.coupon.is_active ? 'activated' : 'deactivated'}`);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-between">
        <h2>Coupons</h2>
        <button type="button" className="btn btn-sm" onClick={() => { setEditing({}); setForm({ type: 'percent', value: 10, minSubtotal: 0, usageLimit: 500, perUserLimit: 1, isActive: true, isDemo: true }); }}>
          + New coupon
        </button>
      </div>

      {loading ? <BlockSkeleton height={240} /> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Code</th><th>Type</th><th className="num">Min spend</th><th className="num">Used</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.code}</b><div className="tiny muted">{c.title}</div></td>
                  <td className="small">{c.type}{c.type === 'percent' ? ` ${c.value}%` : c.type === 'flat' ? ` ${formatInr(c.value)}` : ''}</td>
                  <td className="num">{formatInr(c.min_subtotal_paise)}</td>
                  <td className="num">{c.used_count}/{c.usage_limit}</td>
                  <td className="small">{formatDate(c.expires_at)}</td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-success' : 'badge-neutral'}`}>{c.is_active ? 'Active' : 'Off'}</span>
                    {c.is_demo ? <span className="demo-tag" style={{ marginLeft: 6 }}>Demo</span> : null}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" className="link-btn" onClick={() => {
                        setEditing(c);
                        setForm({
                          id: c.id, title: c.title, description: c.description, type: c.type, value: c.value,
                          minSubtotal: (c.min_subtotal_paise / 100).toFixed(0),
                          maxDiscount: c.max_discount_paise ? (c.max_discount_paise / 100).toFixed(0) : '',
                          categorySlug: c.category_slug || '', stackable: !!c.stackable,
                          usageLimit: c.usage_limit, perUserLimit: c.per_user_limit,
                          isActive: !!c.is_active, isDemo: !!c.is_demo,
                        });
                      }}>Edit</button>
                      <button type="button" className="link-btn" onClick={() => toggleActive(c)}>
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={form.id ? 'Edit coupon' : 'New coupon'}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="coupon-form" className="btn">Save coupon</button>
          </>
        )}>
        <form id="coupon-form" onSubmit={save} className="col" style={{ gap: 12 }}>
          {!form.id && (
            <div className="field">
              <label className="field-label" htmlFor="cf-code">Code</label>
              <input id="cf-code" className="input" required value={form.code || ''}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE10" />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="cf-title">Title</label>
            <input id="cf-title" className="input" required value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="cf-type">Type</label>
              <select id="cf-type" className="select" value={form.type || 'percent'}
                onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="percent">Percent off</option>
                <option value="flat">Flat amount off</option>
                <option value="free_delivery">Free delivery</option>
              </select>
            </div>
            {form.type !== 'free_delivery' && (
              <div className="field grow">
                <label className="field-label" htmlFor="cf-value">{form.type === 'percent' ? 'Percent' : 'Amount ₹'}</label>
                <input id="cf-value" className="input" type="number" min="0" value={form.value ?? 0}
                  onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            )}
          </div>
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="cf-min">Minimum spend ₹</label>
              <input id="cf-min" className="input" type="number" min="0" value={form.minSubtotal ?? 0}
                onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="cf-max">Max discount ₹ (optional)</label>
              <input id="cf-max" className="input" type="number" min="0" value={form.maxDiscount ?? ''}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
            </div>
          </div>
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="cf-cat">Category (optional)</label>
              <input id="cf-cat" className="input" placeholder="groceries" value={form.categorySlug || ''}
                onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="cf-per">Per-user limit</label>
              <input id="cf-per" className="input" type="number" min="0" value={form.perUserLimit ?? 1}
                onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={!!form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
            Stackable with other coupons
          </label>
          <label className="check">
            <input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <label className="check">
            <input type="checkbox" checked={form.isDemo !== false} onChange={(e) => setForm({ ...form, isDemo: e.target.checked })} />
            Mark as a demo promotion
          </label>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------- Settings -------------------------------- */
function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Endpoints.admin.settings().then((r) => {
      setSettings(r.settings);
      setForm({
        free_delivery_threshold_paise: (r.settings.free_delivery_threshold_paise / 100).toFixed(0),
        delivery_fee_paise: (r.settings.delivery_fee_paise / 100).toFixed(0),
        handling_fee_paise: (r.settings.handling_fee_paise / 100).toFixed(0),
        gst_grocery_percent: r.settings.gst_grocery_percent,
        gst_restaurant_percent: r.settings.gst_restaurant_percent,
        loyalty_points_per_rupee: r.settings.loyalty_points_per_rupee,
      });
    });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await Endpoints.admin.updateSettings({
        free_delivery_threshold_paise: Math.round(Number(form.free_delivery_threshold_paise) * 100),
        delivery_fee_paise: Math.round(Number(form.delivery_fee_paise) * 100),
        handling_fee_paise: Math.round(Number(form.handling_fee_paise) * 100),
        gst_grocery_percent: Number(form.gst_grocery_percent),
        gst_restaurant_percent: Number(form.gst_restaurant_percent),
        loyalty_points_per_rupee: Number(form.loyalty_points_per_rupee),
      });
      setSettings(res.settings);
      toast.success(`Settings updated (${res.changed.join(', ')})`);
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  if (!settings) return <BlockSkeleton height={200} />;

  const num = (id, label, hint) => (
    <div className="field grow">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" min="0" step="0.01" value={form[id] ?? 0}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))} />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Settings &amp; delivery fees</h2>
      <Alert tone="info">
        <span className="grow">
          These values drive the live bill engine. Changing the threshold immediately changes the
          free-delivery message on the storefront — no redeploy and no code change.
        </span>
      </Alert>

      <form onSubmit={save} className="card card-pad col" style={{ gap: 12 }}>
        <div className="row wrap">
          {num('free_delivery_threshold_paise', 'Free delivery threshold (₹)', 'Eligible merchandise subtotal needed for free delivery.')}
          {num('delivery_fee_paise', 'Delivery fee below threshold (₹)', 'Set 0 to always deliver free.')}
          {num('handling_fee_paise', 'Handling fee (₹)')}
        </div>
        <div className="row wrap">
          {num('gst_grocery_percent', 'GST % — retail goods')}
          {num('gst_restaurant_percent', 'GST % — restaurant food')}
          {num('loyalty_points_per_rupee', 'Loyalty points per ₹')}
        </div>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form>

      <div className="card card-pad">
        <h3 className="mb-2">Demo flags</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Demo payments: <b>{settings.demo_payments_enabled ? 'enabled' : 'disabled'}</b> · Simulated tracking:{' '}
          <b>{settings.simulated_order_tracking ? 'enabled' : 'disabled'}</b> · Coupons marked as demo:{' '}
          <b>{settings.coupons_are_demo ? 'yes' : 'no'}</b>
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- Cities & zones ----------------------------- */
function Zones() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Endpoints.admin.cities().then((r) => setItems(r.items)).finally(() => setLoading(false)); }, []);

  const patch = async (c, body) => {
    try {
      const res = await Endpoints.admin.updateCity(c.id, body);
      setItems((list) => list.map((x) => (x.id === c.id ? res.city : x)));
      toast.success(`${res.city.name} updated`);
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <BlockSkeleton height={300} />;

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Cities &amp; delivery zones</h2>
      <Alert tone="warning">
        <span className="grow">
          The status shown here is what customers see. Marking a city <b>coming soon</b> blocks checkout
          for addresses in it — do not mark a city live unless delivery is actually operational.
        </span>
      </Alert>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>City</th><th className="num">ETA</th><th className="num">Zone fee</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b><div className="tiny muted">{c.state}</div></td>
                <td className="num">{c.eta_min}–{c.eta_max}m</td>
                <td className="num">{formatInr(c.delivery_fee_paise)}</td>
                <td>
                  <select className="select" style={{ minHeight: 34, width: 'auto' }} value={c.status}
                    onChange={(e) => patch(c, { status: e.target.value })} aria-label={`Status for ${c.name}`}>
                    <option value="live-simulated">Simulated live</option>
                    <option value="limited">Limited</option>
                    <option value="coming-soon">Coming soon</option>
                  </select>
                </td>
                <td>
                  <button type="button" className="link-btn" onClick={() => {
                    const fee = window.prompt(`Zone delivery fee for ${c.name} (₹)`, (c.delivery_fee_paise / 100).toFixed(0));
                    if (fee !== null) patch(c, { deliveryFee: Math.round(Number(fee) * 100) });
                  }}>Set fee</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Users --------------------------------- */
function Users() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Endpoints.admin.users().then((r) => setItems(r.items)).finally(() => setLoading(false)); }, []);

  const setRole = async (u, role) => {
    try {
      await Endpoints.admin.setUserRole(u.id, role);
      setItems((list) => list.map((x) => (x.id === u.id ? { ...x, role } : x)));
      toast.success(`${u.name} is now ${role}`);
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <BlockSkeleton height={240} />;

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Users</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Contact</th><th className="num">Points</th><th>Role</th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b><div className="tiny muted">Joined {formatDate(u.created_at)}</div></td>
                <td className="small">{u.email || '—'}<div className="tiny muted">{u.mobile || '—'}</div></td>
                <td className="num">{u.loyalty_points}</td>
                <td>
                  <select className="select" style={{ minHeight: 34, width: 'auto' }} value={u.role}
                    onChange={(e) => setRole(u, e.target.value)} aria-label={`Role for ${u.name}`}>
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">You cannot remove your own admin access, and at least one admin must remain.</p>
    </div>
  );
}

/* -------------------------------- Tickets -------------------------------- */
function Tickets() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Endpoints.admin.tickets().then((r) => setItems(r.items)).finally(() => setLoading(false)); }, []);

  const set = async (t, status) => {
    try {
      await Endpoints.admin.updateTicket(t.id, status);
      setItems((list) => list.map((x) => (x.id === t.id ? { ...x, status } : x)));
      toast.success('Ticket updated');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <BlockSkeleton height={200} />;

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Support tickets</h2>
      {items.length === 0 ? <p className="small muted">No tickets yet.</p> : (
        <div className="col" style={{ gap: 12 }}>
          {items.map((t) => (
            <div className="card card-pad" key={t.id}>
              <div className="row-between wrap">
                <div>
                  <b>{t.subject}</b>
                  <div className="tiny muted">{t.user_name || t.email} · {formatDate(t.created_at, true)} {t.order_number ? `· ${t.order_number}` : ''}</div>
                </div>
                <select className="select" style={{ width: 'auto', minHeight: 34 }} value={t.status}
                  onChange={(e) => set(t, e.target.value)} aria-label={`Status for ticket ${t.id}`}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <p className="small muted mt-2" style={{ margin: '8px 0 0' }}>{t.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Audit log ------------------------------- */
function Audit() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Endpoints.admin.auditLog().then((r) => setItems(r.items)).finally(() => setLoading(false)); }, []);
  if (loading) return <BlockSkeleton height={240} />;
  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Audit log</h2>
      {items.length === 0 ? <p className="small muted">No admin actions recorded yet.</p> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="small">{formatDate(a.created_at, true)}</td>
                  <td className="small">{a.actor_name || 'system'}</td>
                  <td><span className="badge badge-neutral">{a.action}</span></td>
                  <td className="small">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Shell ---------------------------------- */
export default function AdminDashboard() {
  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Admin' }]} />
      <h1 className="mb-2">Admin dashboard</h1>
      <Alert tone="info" className="mb-4">
        <span className="grow">
          Every request here is re-authorised on the server against your role in the database, and every
          change is written to the audit log.
        </span>
      </Alert>

      <div className="account-layout">
        <nav className="card card-pad account-nav" aria-label="Admin sections">
          {NAV.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
        </nav>
        <div>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="restaurants" element={<Restaurants />} />
            <Route path="orders" element={<Orders />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="settings" element={<Settings />} />
            <Route path="zones" element={<Zones />} />
            <Route path="users" element={<Users />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="audit" element={<Audit />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
