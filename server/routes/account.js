/**
 * Account API: addresses, wishlist, saved payment methods, loyalty, coupons.
 * Every query is scoped by the authenticated user id, so one account can never
 * read another account's addresses, orders or wishlist.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitize, isValidPincode, isValidIndianMobile } from '../utils/helpers.js';

const router = express.Router();
router.use(requireAuth);

/* ------------------------------- addresses ------------------------------- */
router.get('/addresses', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id);
  res.json({ items: rows.map(publicAddress) });
});

router.post('/addresses', asyncHandler((req, res) => {
  const d = getDb();
  const a = normalizeAddress(req.body, req.user.name);
  const info = d.prepare(`INSERT INTO addresses
    (user_id, label, full_name, phone, line1, line2, city, state, pincode, landmark, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, a.label, a.fullName, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, a.landmark, a.isDefault ? 1 : 0);
  if (a.isDefault) clearOtherDefaults(d, req.user.id, Number(info.lastInsertRowid));
  // First address always becomes the default so checkout is never blocked.
  const count = d.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').get(req.user.id).n;
  if (count === 1) d.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(info.lastInsertRowid);
  res.status(201).json({ address: publicAddress(d.prepare('SELECT * FROM addresses WHERE id = ?').get(info.lastInsertRowid)) });
}));

router.put('/addresses/:id', asyncHandler((req, res) => {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) throw ApiError.notFound('That address is not saved to your account.');
  const a = normalizeAddress(req.body, existing.full_name, existing);
  d.prepare(`UPDATE addresses SET label = ?, full_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?,
             pincode = ?, landmark = ?, is_default = ? WHERE id = ?`)
    .run(a.label, a.fullName, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, a.landmark, a.isDefault ? 1 : 0, existing.id);
  if (a.isDefault) clearOtherDefaults(d, req.user.id, existing.id);
  res.json({ address: publicAddress(d.prepare('SELECT * FROM addresses WHERE id = ?').get(existing.id)) });
}));

router.delete('/addresses/:id', asyncHandler((req, res) => {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) throw ApiError.notFound('That address is not saved to your account.');
  d.prepare('DELETE FROM addresses WHERE id = ?').run(existing.id);
  // Keep exactly one default if any addresses remain.
  const remaining = d.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  if (remaining) {
    const anyDefault = d.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ? AND is_default = 1').get(req.user.id).n;
    if (!anyDefault) d.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(remaining.id);
  }
  res.json({ ok: true });
}));

router.post('/addresses/:id/default', asyncHandler((req, res) => {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) throw ApiError.notFound('That address is not saved to your account.');
  clearOtherDefaults(d, req.user.id, existing.id);
  d.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(existing.id);
  res.json({ address: publicAddress(d.prepare('SELECT * FROM addresses WHERE id = ?').get(existing.id)) });
}));

/* -------------------------------- wishlist ------------------------------- */
router.get('/wishlist', (req, res) => {
  const rows = getDb().prepare(`
    SELECT p.*, c.name AS category_name, c.color AS category_color, w.created_at AS added_at
    FROM wishlist_items w
    JOIN products p ON p.id = w.product_id
    LEFT JOIN categories c ON c.slug = p.category_slug
    WHERE w.owner_key = ? ORDER BY w.id DESC`).all(`u:${req.user.id}`);
  res.json({ items: rows.map(shapeProduct) });
});

router.post('/wishlist', asyncHandler((req, res) => {
  const d = getDb();
  const id = Number.parseInt(req.body?.productId, 10);
  const p = d.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(id);
  if (!p) throw ApiError.notFound('That product is not available.');
  d.prepare('INSERT OR IGNORE INTO wishlist_items (owner_key, product_id) VALUES (?, ?)').run(`u:${req.user.id}`, p.id);
  res.status(201).json({ ok: true, productId: p.id });
}));

router.delete('/wishlist/:productId', asyncHandler((req, res) => {
  const info = getDb().prepare('DELETE FROM wishlist_items WHERE owner_key = ? AND product_id = ?')
    .run(`u:${req.user.id}`, Number.parseInt(req.params.productId, 10));
  if (info.changes === 0) throw ApiError.notFound('That product is not in your wishlist.');
  res.json({ ok: true });
}));

/* ------------------------- saved payment methods -------------------------
 * Demo-only: stores brand + last 4 for the UI. No real card data is accepted
 * or stored, and no gateway is contacted. Replace with a PSP token vault.
 */
router.get('/payment-methods', (req, res) => {
  res.json({
    items: getDb().prepare('SELECT id, brand, label, last4, is_default, created_at FROM saved_payment_methods WHERE user_id = ?').all(req.user.id),
    note: 'Saved cards are a demo feature: only brand and last-4 digits are stored. No real payment gateway is connected.',
  });
});

router.post('/payment-methods', asyncHandler((req, res) => {
  const d = getDb();
  const number = String(req.body?.number || '').replace(/\s+/g, '');
  if (!/^\d{12,19}$/.test(number)) throw ApiError.unprocessable('Enter a 12–19 digit card number.');
  const label = sanitize(req.body?.label, 40) || 'Card';
  const brand = number.startsWith('4') ? 'Visa' : (number.startsWith('5') ? 'Mastercard' : (number.startsWith('6') ? 'RuPay' : 'Card'));
  const info = d.prepare('INSERT INTO saved_payment_methods (user_id, brand, label, last4, is_default) VALUES (?, ?, ?, ?, 0)')
    .run(req.user.id, brand, label, number.slice(-4));
  res.status(201).json({ id: info.lastInsertRowid, brand, label, last4: number.slice(-4), is_default: 0,
    note: 'Stored as demo data only — no real card was charged.' });
}));

router.delete('/payment-methods/:id', (req, res) => {
  const info = getDb().prepare('DELETE FROM saved_payment_methods WHERE id = ? AND user_id = ?')
    .run(Number.parseInt(req.params.id, 10), req.user.id);
  if (info.changes === 0) throw ApiError.notFound('That payment method is not saved to your account.');
  res.json({ ok: true });
});

/* -------------------------- coupons + loyalty ---------------------------- */
router.get('/coupons', (req, res) => {
  const d = getDb();
  const rows = d.prepare(`SELECT * FROM coupons WHERE is_active = 1 ORDER BY expires_at ASC`).all();
  res.json({
    items: rows.map((c) => ({
      code: c.code, title: c.title, description: c.description, type: c.type, value: c.value,
      minSubtotal: c.min_subtotal_paise, maxDiscount: c.max_discount_paise, categorySlug: c.category_slug,
      stackable: !!c.stackable, expiresAt: c.expires_at, isDemo: !!c.is_demo,
      expired: !!(c.expires_at && new Date(c.expires_at.replace(' ', 'T') + 'Z') < new Date()),
      perUserLimit: c.per_user_limit,
      usedByMe: d.prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?').get(c.id, req.user.id).n,
    })),
  });
});

router.get('/loyalty', (req, res) => {
  const d = getDb();
  const user = d.prepare('SELECT loyalty_points FROM users WHERE id = ?').get(req.user.id);
  res.json({
    points: user.loyalty_points,
    valueInr: Math.floor(user.loyalty_points / 10),
    history: d.prepare('SELECT delta, reason, order_id, created_at FROM loyalty_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id),
    note: 'Loyalty points are recorded by this demo build and are not redeemable for money.',
  });
});

/* ------------------------------- helpers --------------------------------- */
function clearOtherDefaults(d, userId, keepId) {
  d.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id != ?').run(userId, keepId);
}

function normalizeAddress(body, fallbackName, existing = null) {
  const fullName = sanitize(body?.fullName, 60) || fallbackName;
  const phone = String(body?.phone || '').replace(/\D/g, '').slice(-10);
  const line1 = sanitize(body?.line1, 120);
  const city = sanitize(body?.city, 60);
  const state = sanitize(body?.state, 60);
  const pincode = String(body?.pincode || '').replace(/\D/g, '').slice(0, 6);

  if (fullName.length < 2) throw ApiError.unprocessable('Please enter the recipient name.');
  if (!isValidIndianMobile(phone)) throw ApiError.unprocessable('Enter a valid 10-digit mobile number.');
  if (!line1) throw ApiError.unprocessable('Please enter the flat / house / street.');
  if (!city) throw ApiError.unprocessable('Please enter a city.');
  if (!state) throw ApiError.unprocessable('Please enter a state.');
  if (!isValidPincode(pincode)) throw ApiError.unprocessable('PIN code must be 6 digits.');

  return {
    label: sanitize(body?.label, 20) || existing?.label || 'Home',
    fullName, phone, line1,
    line2: sanitize(body?.line2, 120),
    city, state, pincode,
    landmark: sanitize(body?.landmark, 80),
    isDefault: body?.isDefault === true || body?.isDefault === 1 || body?.isDefault === 'true',
  };
}

function publicAddress(a) {
  return {
    id: a.id, label: a.label, fullName: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2,
    city: a.city, state: a.state, pincode: a.pincode, landmark: a.landmark, isDefault: !!a.is_default,
  };
}

function shapeProduct(p) {
  return {
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, categorySlug: p.category_slug,
    categoryName: p.category_name, categoryColor: p.category_color,
    price: p.price_paise, mrp: p.mrp_paise, unit: p.unit, image: p.image_url,
    inStock: p.stock > 0, rating: Number(p.rating).toFixed(1), ratingCount: p.rating_count,
    discountPercent: p.mrp_paise > 0 ? Math.round(((p.mrp_paise - p.price_paise) / p.mrp_paise) * 100) : 0,
  };
}

export default router;
