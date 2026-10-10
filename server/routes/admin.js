/**
 * Admin API.
 *
 * SECURITY: every route here sits behind requireAdmin, which re-reads the
 * caller's role from the users table on each request. Removing the admin link
 * from the UI would not grant access, and forging a cookie would not either.
 *
 * Every mutation is written to audit_log with the acting admin's id.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { sanitize, clampInt } from '../utils/helpers.js';
import { settingsMap, setSetting } from '../utils/settings.js';
import { publicOrder } from './checkout.js';

const router = express.Router();
router.use(requireAdmin);

function audit(userId, action, entity, entityId, detail) {
  getDb().prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)')
    .run(userId, action, entity, entityId ? String(entityId) : null, detail ? JSON.stringify(detail).slice(0, 2000) : null);
}

/* ------------------------------ dashboard -------------------------------- */
router.get('/stats', (_req, res) => {
  const d = getDb();
  const today = d.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total_paise),0) AS revenue
                           FROM orders WHERE date(placed_at) = date('now')`).get();
  const all = d.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total_paise),0) AS revenue FROM orders`).get();
  const byStatus = d.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
  const lowStock = d.prepare('SELECT id, slug, name, stock FROM products WHERE is_active = 1 AND stock <= 10 ORDER BY stock ASC LIMIT 15').all();
  const inactive = d.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 0').get().n;
  const last14 = d.prepare(`SELECT date(placed_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total_paise),0) AS revenue
                            FROM orders WHERE placed_at >= datetime('now','-14 days')
                            GROUP BY date(placed_at) ORDER BY day ASC`).all();
  const topProducts = d.prepare(`SELECT oi.name, SUM(oi.quantity) AS units, SUM(oi.line_total_paise) AS revenue
                                 FROM order_items oi GROUP BY oi.name ORDER BY units DESC LIMIT 8`).all();
  const byCategory = d.prepare(`SELECT p.category_slug, COUNT(oi.id) AS lines, SUM(oi.line_total_paise) AS revenue
                                FROM order_items oi JOIN products p ON ('p:' || p.id) = oi.item_id
                                GROUP BY p.category_slug ORDER BY revenue DESC LIMIT 10`).all();

  res.json({
    today: { orders: today.orders, revenue: today.revenue },
    totals: {
      orders: all.orders, revenue: all.revenue,
      products: d.prepare('SELECT COUNT(*) AS n FROM products').get().n,
      activeProducts: d.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').get().n,
      inactiveProducts: inactive,
      outOfStock: d.prepare('SELECT COUNT(*) AS n FROM products WHERE stock = 0').get().n,
      restaurants: d.prepare('SELECT COUNT(*) AS n FROM restaurants').get().n,
      menuItems: d.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n,
      customers: d.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get().n,
      openTickets: d.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open'").get().n,
    },
    ordersByStatus: byStatus,
    lowStock,
    last14Days: last14,
    topProducts,
    revenueByCategory: byCategory,
  });
});

/* ------------------------------- products -------------------------------- */
router.get('/products', (req, res) => {
  const d = getDb();
  const q = req.query.q ? `AND (p.name LIKE @q OR p.slug LIKE @q)` : '';
  const params = req.query.q ? { q: `%${req.query.q}%` } : {};
  const rows = d.prepare(`SELECT p.*, c.name AS category_name FROM products p
                          LEFT JOIN categories c ON c.slug = p.category_slug
                          WHERE 1 = 1 ${q} ORDER BY p.id DESC LIMIT 300`).all(params);
  res.json({ items: rows });
});

router.post('/products', asyncHandler((req, res) => {
  const d = getDb();
  const body = req.body || {};
  const name = sanitize(body.name, 120);
  const slug = sanitize(body.slug, 120) || slugify(name);
  const categorySlug = sanitize(body.categorySlug, 60);
  if (!name) throw ApiError.unprocessable('Product name is required.');
  if (!categorySlug) throw ApiError.unprocessable('Category is required.');
  if (!d.prepare('SELECT id FROM categories WHERE slug = ?').get(categorySlug)) throw ApiError.unprocessable('That category does not exist.');
  if (d.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) throw ApiError.conflict('That product slug already exists.');

  const price = clampInt(body.price, 0, 10_000_000, 0);
  const mrp = clampInt(body.mrp, price, 10_000_000, price);
  const info = d.prepare(`INSERT INTO products
    (slug, name, brand, category_slug, description, specs, price_paise, mrp_paise, unit, weight, image_url,
     is_veg, is_active, stock, rating, rating_count, rating_is_demo, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, 1, ?)`)
    .run(slug, name, sanitize(body.brand, 60), categorySlug, sanitize(body.description, 2000) ?? '',
      JSON.stringify(body.specs ?? {}), price, mrp, sanitize(body.unit, 30), sanitize(body.weight, 30),
      `/api/images/${slug}.svg`, body.isVeg === false ? 0 : 1, clampInt(body.stock, 0, 1_000_000, 0),
      sanitize(body.tags, 200) ?? '');

  audit(req.user.id, 'product.create', 'product', info.lastInsertRowid, { slug, price });
  res.status(201).json({ product: d.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/products/:id', asyncHandler((req, res) => {
  const d = getDb();
  const id = Number.parseInt(req.params.id, 10);
  const p = d.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) throw ApiError.notFound('That product does not exist.');
  const b = req.body || {};

  const price = b.price !== undefined ? clampInt(b.price, 0, 10_000_000, p.price_paise) : p.price_paise;
  const mrp = b.mrp !== undefined ? clampInt(b.mrp, price, 10_000_000, p.mrp_paise) : Math.max(p.mrp_paise, price);
  if (mrp < price) throw ApiError.unprocessable('MRP cannot be lower than the selling price.');

  const categorySlug = b.categorySlug ? sanitize(b.categorySlug, 60) : p.category_slug;
  if (!d.prepare('SELECT id FROM categories WHERE slug = ?').get(categorySlug)) throw ApiError.unprocessable('That category does not exist.');

  d.prepare(`UPDATE products SET name = ?, brand = ?, category_slug = ?, description = ?, price_paise = ?,
             mrp_paise = ?, unit = ?, weight = ?, is_veg = ?, is_active = ?, stock = ?, tags = ?,
             updated_at = datetime('now') WHERE id = ?`)
    .run(sanitize(b.name, 120) ?? p.name, sanitize(b.brand, 60) ?? p.brand, categorySlug,
      sanitize(b.description, 2000) ?? p.description, price, mrp,
      sanitize(b.unit, 30) ?? p.unit, sanitize(b.weight, 30) ?? p.weight,
      b.isVeg === undefined ? p.is_veg : (b.isVeg ? 1 : 0),
      b.isActive === undefined ? p.is_active : (b.isActive ? 1 : 0),
      b.stock === undefined ? p.stock : clampInt(b.stock, 0, 1_000_000, p.stock),
      sanitize(b.tags, 200) ?? p.tags, id);

  audit(req.user.id, 'product.update', 'product', id, { price, stock: b.stock, isActive: b.isActive });
  res.json({ product: d.prepare('SELECT * FROM products WHERE id = ?').get(id) });
}));

router.post('/products/:id/stock', asyncHandler((req, res) => {
  const d = getDb();
  const id = Number.parseInt(req.params.id, 10);
  const p = d.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) throw ApiError.notFound('That product does not exist.');
  const stock = clampInt(req.body?.stock, 0, 1_000_000, p.stock);
  d.prepare(`UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?`).run(stock, id);
  audit(req.user.id, 'product.stock', 'product', id, { from: p.stock, to: stock });
  res.json({ product: d.prepare('SELECT * FROM products WHERE id = ?').get(id) });
}));

/** Soft-delete: deactivates instead of destroying rows referenced by old orders. */
router.delete('/products/:id', asyncHandler((req, res) => {
  const d = getDb();
  const p = d.prepare('SELECT * FROM products WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!p) throw ApiError.notFound('That product does not exist.');
  d.prepare(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(p.id);
  audit(req.user.id, 'product.deactivate', 'product', p.id, { slug: p.slug });
  res.json({ ok: true, note: 'Product deactivated (order history keeps its reference).' });
}));

/* ------------------------------ categories ------------------------------- */
router.get('/categories', (_req, res) => {
  res.json({ items: getDb().prepare('SELECT * FROM categories ORDER BY sort_order ASC').all() });
});

router.post('/categories', asyncHandler((req, res) => {
  const d = getDb();
  const slug = sanitize(req.body?.slug, 60) || slugify(req.body?.name || '');
  const name = sanitize(req.body?.name, 60);
  if (!name || !slug) throw ApiError.unprocessable('Name and slug are required.');
  if (d.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) throw ApiError.conflict('That category slug already exists.');
  const info = d.prepare(`INSERT INTO categories (slug, name, color, icon, tagline, is_food, is_active, sort_order)
                          VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(slug, name, sanitize(req.body?.color, 20) || '#666666', sanitize(req.body?.icon, 8),
      sanitize(req.body?.tagline, 120), req.body?.isFood ? 1 : 0, clampInt(req.body?.sortOrder, 1, 999, 100));
  audit(req.user.id, 'category.create', 'category', info.lastInsertRowid, { slug });
  res.status(201).json({ category: d.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/categories/:id', asyncHandler((req, res) => {
  const d = getDb();
  const c = d.prepare('SELECT * FROM categories WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!c) throw ApiError.notFound('That category does not exist.');
  const b = req.body || {};
  d.prepare(`UPDATE categories SET name = ?, color = ?, icon = ?, tagline = ?, is_active = ?, sort_order = ? WHERE id = ?`)
    .run(sanitize(b.name, 60) ?? c.name, sanitize(b.color, 20) ?? c.color, sanitize(b.icon, 8) ?? c.icon,
      sanitize(b.tagline, 120) ?? c.tagline, b.isActive === undefined ? c.is_active : (b.isActive ? 1 : 0),
      clampInt(b.sortOrder, 1, 999, c.sort_order), c.id);
  audit(req.user.id, 'category.update', 'category', c.id, { name: b.name });
  res.json({ category: d.prepare('SELECT * FROM categories WHERE id = ?').get(c.id) });
}));

/* ----------------------------- restaurants ------------------------------- */
router.get('/restaurants', (_req, res) => {
  res.json({ items: getDb().prepare('SELECT * FROM restaurants ORDER BY id ASC').all() });
});

router.put('/restaurants/:id', asyncHandler((req, res) => {
  const d = getDb();
  const r = d.prepare('SELECT * FROM restaurants WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!r) throw ApiError.notFound('That restaurant does not exist.');
  const b = req.body || {};
  d.prepare(`UPDATE restaurants SET name = ?, cuisines = ?, area = ?, city = ?, min_order_paise = ?,
             cost_for_two_paise = ?, eta_min = ?, eta_max = ?, is_open = ?, is_promoted = ? WHERE id = ?`)
    .run(sanitize(b.name, 80) ?? r.name, sanitize(b.cuisines, 120) ?? r.cuisines, sanitize(b.area, 120) ?? r.area,
      sanitize(b.city, 60) ?? r.city,
      b.minOrder === undefined ? r.min_order_paise : clampInt(b.minOrder, 0, 1_000_000, r.min_order_paise),
      b.costForTwo === undefined ? r.cost_for_two_paise : clampInt(b.costForTwo, 0, 1_000_000, r.cost_for_two_paise),
      clampInt(b.etaMin, 1, 240, r.eta_min), clampInt(b.etaMax, 1, 240, r.eta_max),
      b.isOpen === undefined ? r.is_open : (b.isOpen ? 1 : 0),
      b.isPromoted === undefined ? r.is_promoted : (b.isPromoted ? 1 : 0), r.id);
  audit(req.user.id, 'restaurant.update', 'restaurant', r.id, { isOpen: b.isOpen, minOrder: b.minOrder });
  res.json({ restaurant: d.prepare('SELECT * FROM restaurants WHERE id = ?').get(r.id) });
}));

router.post('/restaurants/:id/menu', asyncHandler((req, res) => {
  const d = getDb();
  const r = d.prepare('SELECT * FROM restaurants WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!r) throw ApiError.notFound('That restaurant does not exist.');
  const b = req.body || {};
  const name = sanitize(b.name, 120);
  const slug = sanitize(b.slug, 120) || slugify(name);
  if (!name) throw ApiError.unprocessable('Dish name is required.');
  if (d.prepare('SELECT id FROM menu_items WHERE restaurant_id = ? AND slug = ?').get(r.id, slug)) throw ApiError.conflict('That dish already exists on this menu.');
  const price = clampInt(b.price, 0, 1_000_000, 0);
  const info = d.prepare(`INSERT INTO menu_items (restaurant_id, slug, name, description, price_paise, mrp_paise,
                          is_veg, category, variations, addons, is_best_seller, is_available, image_url)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, 1, ?)`)
    .run(r.id, slug, name, sanitize(b.description, 600) ?? '', price, clampInt(b.mrp, price, 1_000_000, price),
      b.isVeg === false ? 0 : 1, sanitize(b.category, 60) || 'Main Course', b.isBestSeller ? 1 : 0,
      `/api/images/dish-${slug}.svg`);
  audit(req.user.id, 'menu.create', 'menu_item', info.lastInsertRowid, { restaurant: r.slug, slug });
  res.status(201).json({ menuItem: d.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/menu/:id', asyncHandler((req, res) => {
  const d = getDb();
  const m = d.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!m) throw ApiError.notFound('That dish does not exist.');
  const b = req.body || {};
  const price = b.price === undefined ? m.price_paise : clampInt(b.price, 0, 1_000_000, m.price_paise);
  d.prepare(`UPDATE menu_items SET name = ?, description = ?, price_paise = ?, mrp_paise = ?, category = ?,
             is_veg = ?, is_available = ?, is_best_seller = ? WHERE id = ?`)
    .run(sanitize(b.name, 120) ?? m.name, sanitize(b.description, 600) ?? m.description, price,
      b.mrp === undefined ? Math.max(m.mrp_paise, price) : clampInt(b.mrp, price, 1_000_000, m.mrp_paise),
      sanitize(b.category, 60) ?? m.category,
      b.isVeg === undefined ? m.is_veg : (b.isVeg ? 1 : 0),
      b.isAvailable === undefined ? m.is_available : (b.isAvailable ? 1 : 0),
      b.isBestSeller === undefined ? m.is_best_seller : (b.isBestSeller ? 1 : 0), m.id);
  audit(req.user.id, 'menu.update', 'menu_item', m.id, { price, isAvailable: b.isAvailable });
  res.json({ menuItem: d.prepare('SELECT * FROM menu_items WHERE id = ?').get(m.id) });
}));

/* -------------------------------- orders --------------------------------- */
router.get('/orders', (req, res) => {
  const d = getDb();
  const where = [];
  const params = {};
  if (req.query.status) { where.push('o.status = @status'); params.status = req.query.status; }
  if (req.query.q) { where.push('(o.order_number LIKE @q OR u.name LIKE @q OR u.email LIKE @q)'); params.q = `%${req.query.q}%`; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = d.prepare(`SELECT o.*, u.name AS customer_name, u.email AS customer_email, r.name AS restaurant_name,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id) AS unit_count
    FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN restaurants r ON r.id = o.restaurant_id
    ${whereSql} ORDER BY o.id DESC LIMIT 200`).all(params);
  res.json({ items: rows.map((o) => ({ ...publicOrder(d, o), customer: { name: o.customer_name, email: o.customer_email } })) });
});

router.put('/orders/:orderNumber/status', asyncHandler((req, res) => {
  const d = getDb();
  const o = d.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!o) throw ApiError.notFound('That order does not exist.');
  const status = String(req.body?.status || '');
  const allowed = ['placed', 'confirmed', 'packing', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) throw ApiError.unprocessable(`Status must be one of: ${allowed.join(', ')}.`);

  d.transaction(() => {
    d.prepare(`UPDATE orders SET status = ?, cancelled_at = CASE WHEN ? = 'cancelled' THEN datetime('now') ELSE cancelled_at END WHERE id = ?`)
      .run(status, status, o.id);
    d.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)')
      .run(o.id, status, sanitize(req.body?.note, 200) || `Updated by ${req.user.name}.`);
    d.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
      .run(o.user_id, 'order', `Order ${o.order_number}: ${status.replace(/_/g, ' ')}`,
        sanitize(req.body?.note, 200) || 'Your order status was updated.', `/orders/${o.order_number}`);
    // Restock if an admin cancels an order that is still on the books.
    if (status === 'cancelled' && o.status !== 'cancelled') {
      const inc = d.prepare(`UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`);
      for (const item of d.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id)) {
        const m = item.item_id.match(/^p:(\d+)$/);
        if (m) inc.run(item.quantity, Number(m[1]));
      }
    }
  })();
  audit(req.user.id, 'order.status', 'order', o.id, { from: o.status, to: status });
  res.json({ order: publicOrder(d, d.prepare('SELECT * FROM orders WHERE id = ?').get(o.id), true) });
}));

/* -------------------------------- coupons -------------------------------- */
router.get('/coupons', (_req, res) => {
  res.json({ items: getDb().prepare('SELECT * FROM coupons ORDER BY id ASC').all() });
});

router.post('/coupons', asyncHandler((req, res) => {
  const d = getDb();
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw ApiError.unprocessable('Coupon code must be 3–20 letters or digits.');
  if (d.prepare('SELECT id FROM coupons WHERE code = ?').get(code)) throw ApiError.conflict('That coupon code already exists.');
  if (!['percent', 'flat', 'free_delivery'].includes(b.type)) throw ApiError.unprocessable('Type must be percent, flat or free_delivery.');
  if (b.type === 'percent' && !(b.value > 0 && b.value <= 100)) throw ApiError.unprocessable('Percent value must be between 1 and 100.');

  const info = d.prepare(`INSERT INTO coupons (code, title, description, type, value, min_subtotal_paise,
    max_discount_paise, category_slug, stackable, usage_limit, per_user_limit, starts_at, expires_at, is_active, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`)
    .run(code, sanitize(b.title, 120) || code, sanitize(b.description, 300),
      b.type, Number(b.value) || 0, clampInt(b.minSubtotal, 0, 10_000_000, 0),
      b.maxDiscount === undefined || b.maxDiscount === null ? null : clampInt(b.maxDiscount, 0, 10_000_000, 0),
      sanitize(b.categorySlug, 60) || null, b.stackable ? 1 : 0,
      clampInt(b.usageLimit, 0, 1_000_000, 500), clampInt(b.perUserLimit, 0, 100, 1),
      b.expiresAt || `datetime('now','+90 days')`, b.isActive === false ? 0 : 1, b.isDemo === false ? 0 : 1);
  audit(req.user.id, 'coupon.create', 'coupon', info.lastInsertRowid, { code });
  res.status(201).json({ coupon: d.prepare('SELECT * FROM coupons WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/coupons/:id', asyncHandler((req, res) => {
  const d = getDb();
  const c = d.prepare('SELECT * FROM coupons WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!c) throw ApiError.notFound('That coupon does not exist.');
  const b = req.body || {};
  d.prepare(`UPDATE coupons SET title = ?, description = ?, type = ?, value = ?, min_subtotal_paise = ?,
             max_discount_paise = ?, category_slug = ?, stackable = ?, usage_limit = ?, per_user_limit = ?,
             is_active = ?, is_demo = ? WHERE id = ?`)
    .run(sanitize(b.title, 120) ?? c.title, sanitize(b.description, 300) ?? c.description,
      ['percent', 'flat', 'free_delivery'].includes(b.type) ? b.type : c.type,
      b.value === undefined ? c.value : Number(b.value),
      b.minSubtotal === undefined ? c.min_subtotal_paise : clampInt(b.minSubtotal, 0, 10_000_000, c.min_subtotal_paise),
      b.maxDiscount === undefined ? c.max_discount_paise : (b.maxDiscount === null ? null : clampInt(b.maxDiscount, 0, 10_000_000, c.max_discount_paise)),
      b.categorySlug === undefined ? c.category_slug : (sanitize(b.categorySlug, 60) || null),
      b.stackable === undefined ? c.stackable : (b.stackable ? 1 : 0),
      b.usageLimit === undefined ? c.usage_limit : clampInt(b.usageLimit, 0, 1_000_000, c.usage_limit),
      b.perUserLimit === undefined ? c.per_user_limit : clampInt(b.perUserLimit, 0, 100, c.per_user_limit),
      b.isActive === undefined ? c.is_active : (b.isActive ? 1 : 0),
      b.isDemo === undefined ? c.is_demo : (b.isDemo ? 1 : 0), c.id);
  audit(req.user.id, 'coupon.update', 'coupon', c.id, { code: c.code });
  res.json({ coupon: d.prepare('SELECT * FROM coupons WHERE id = ?').get(c.id) });
}));

/* --------------------- settings: fees + delivery zones -------------------- */
router.get('/settings', (_req, res) => {
  res.json({ settings: settingsMap(getDb()) });
});

router.put('/settings', asyncHandler((req, res) => {
  const d = getDb();
  const allowed = ['free_delivery_threshold_paise', 'delivery_fee_paise', 'handling_fee_paise',
    'gst_grocery_percent', 'gst_restaurant_percent', 'loyalty_points_per_rupee',
    'demo_payments_enabled', 'simulated_order_tracking', 'coupons_are_demo'];
  const changes = {};
  d.transaction(() => {
    for (const key of allowed) {
      if (req.body?.[key] === undefined) continue;
      const value = Number(req.body[key]);
      if (!Number.isFinite(value)) throw ApiError.unprocessable(`${key} must be a number.`);
      if (value < 0) throw ApiError.unprocessable(`${key} cannot be negative.`);
      setSetting(d, key, value);
      changes[key] = value;
    }
  })();
  audit(req.user.id, 'settings.update', 'settings', null, changes);
  res.json({ settings: settingsMap(d), changed: Object.keys(changes) });
}));

router.get('/cities', (_req, res) => {
  res.json({ items: getDb().prepare('SELECT * FROM cities ORDER BY is_default_city DESC, name ASC').all() });
});

router.put('/cities/:id', asyncHandler((req, res) => {
  const d = getDb();
  const c = d.prepare('SELECT * FROM cities WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!c) throw ApiError.notFound('That city does not exist.');
  const b = req.body || {};
  const status = ['live-simulated', 'limited', 'coming-soon'].includes(b.status) ? b.status : c.status;
  d.prepare(`UPDATE cities SET name = ?, state = ?, eta_min = ?, eta_max = ?, delivery_fee_paise = ?,
             status = ?, is_default_city = ? WHERE id = ?`)
    .run(sanitize(b.name, 60) ?? c.name, sanitize(b.state, 60) ?? c.state,
      clampInt(b.etaMin, 1, 240, c.eta_min), clampInt(b.etaMax, 1, 240, c.eta_max),
      b.deliveryFee === undefined ? c.delivery_fee_paise : clampInt(b.deliveryFee, 0, 100_000, c.delivery_fee_paise),
      status, b.isDefault ? 1 : 0, c.id);
  if (b.isDefault) d.prepare('UPDATE cities SET is_default_city = 0 WHERE id != ?').run(c.id);
  audit(req.user.id, 'city.update', 'city', c.id, { status, fee: b.deliveryFee });
  res.json({ city: d.prepare('SELECT * FROM cities WHERE id = ?').get(c.id) });
}));

/* --------------------------- users + support ----------------------------- */
router.get('/users', (req, res) => {
  const d = getDb();
  const q = req.query.q ? 'WHERE (name LIKE @q OR email LIKE @q OR mobile LIKE @q)' : '';
  const params = req.query.q ? { q: `%${req.query.q}%` } : {};
  res.json({
    items: d.prepare(`SELECT id, name, email, mobile, role, loyalty_points, is_email_verified, created_at
                      FROM users ${q} ORDER BY id DESC LIMIT 200`).all(params),
  });
});

/** Role changes are the one admin power that can lock you out — guarded explicitly. */
router.put('/users/:id/role', asyncHandler((req, res) => {
  const d = getDb();
  const id = Number.parseInt(req.params.id, 10);
  const target = d.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) throw ApiError.notFound('That user does not exist.');
  const role = String(req.body?.role || '');
  if (!['customer', 'admin'].includes(role)) throw ApiError.unprocessable('Role must be customer or admin.');
  if (target.id === req.user.id && role !== 'admin') throw ApiError.conflict('You cannot remove your own admin access.');

  const remainingAdmins = d.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  if (target.role === 'admin' && role !== 'admin' && remainingAdmins <= 1) {
    throw ApiError.conflict('At least one admin account must remain.');
  }
  d.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  audit(req.user.id, 'user.role', 'user', id, { from: target.role, to: role });
  res.json({ ok: true });
}));

router.get('/tickets', (req, res) => {
  const d = getDb();
  const rows = d.prepare(`SELECT t.*, u.name AS user_name, u.email, o.order_number
                          FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
                          LEFT JOIN orders o ON o.id = t.order_id
                          ${req.query.status ? 'WHERE t.status = @status' : ''} ORDER BY t.id DESC LIMIT 200`)
    .all(req.query.status ? { status: req.query.status } : {});
  res.json({ items: rows });
});

router.put('/tickets/:id', asyncHandler((req, res) => {
  const d = getDb();
  const t = d.prepare('SELECT * FROM support_tickets WHERE id = ?').get(Number.parseInt(req.params.id, 10));
  if (!t) throw ApiError.notFound('That ticket does not exist.');
  const status = ['open', 'in_progress', 'resolved', 'closed'].includes(req.body?.status) ? req.body.status : t.status;
  d.prepare('UPDATE support_tickets SET status = ? WHERE id = ?').run(status, t.id);
  if (t.user_id) {
    d.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
      .run(t.user_id, 'support', `Support request ${status.replace('_', ' ')}`, t.subject, '/support');
  }
  audit(req.user.id, 'ticket.update', 'ticket', t.id, { status });
  res.json({ ok: true });
}));

router.get('/audit-log', (_req, res) => {
  res.json({
    items: getDb().prepare(`SELECT a.*, u.name AS actor_name FROM audit_log a
                            LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 200`).all(),
  });
});

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

export default router;
