/**
 * Cart API. Every mutation returns the fully recomputed cart so the badge,
 * subtotal and the ₹150 free-delivery progress bar update from one response.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import {
  readCart, addToCart, setCartQuantity, removeFromCart, setSavedFlag,
  clearCart, mergeCarts, resolveCartForBilling, normalizeOptions,
} from '../utils/cart.js';
import { computeBill } from '../utils/pricing.js';
import { settingsMap } from '../utils/settings.js';

const router = express.Router();

/** Loads + validates a coupon for a cart, returning { coupon, error }. */
export function loadCoupon(code) {
  if (!code) return { coupon: null, error: null };
  const row = getDb().prepare('SELECT * FROM coupons WHERE code = ?').get(String(code).trim().toUpperCase());
  if (!row) return { coupon: null, error: `Coupon ${String(code).toUpperCase()} was not found.` };
  return { coupon: row, error: null };
}

/** Builds the payload every cart-touching endpoint returns. */
export function buildCartPayload(ownerKey, { couponCode = null, includeSaved = true } = {}) {
  const d = getDb();
  const settings = settingsMap(d);
  const { items, unavailable } = resolveCartForBilling(ownerKey, { includeSaved: false });
  const { coupon, error: loadError } = loadCoupon(couponCode);
  const bill = computeBill(items, settings, coupon);

  const restaurantIds = [...new Set(items.filter((i) => i.restaurantId).map((i) => i.restaurantId))];
  let restaurant = null;
  if (restaurantIds.length) {
    const r = d.prepare('SELECT id, slug, name, min_order_paise, eta_min, eta_max FROM restaurants WHERE id = ?').get(restaurantIds[0]);
    if (r) {
      restaurant = {
        id: r.id, slug: r.slug, name: r.name, minOrder: r.min_order_paise,
        etaMin: r.eta_min, etaMax: r.eta_max,
        minOrderMet: bill.merchandisePaise >= r.min_order_paise,
      };
    }
  }

  const saved = includeSaved
    ? readCart(ownerKey).filter((l) => l.is_saved === 1).map((l) => hydrateSaved(d, l))
    : [];

  return {
    items,
    saved,
    unavailable: unavailable.map((u) => ({ itemId: u.item_id, name: u.name, reason: u.reason, image: u.image_url })),
    bill,
    restaurant,
    settings: {
      freeDeliveryThreshold: settings.free_delivery_threshold_paise,
      deliveryFee: settings.delivery_fee_paise,
      handlingFee: settings.handling_fee_paise,
      demoPayments: !!settings.demo_payments_enabled,
    },
    isEmpty: items.length === 0,
    couponCode: couponCode || null,
    // A code that does not exist never reaches computeBill, so its message is
    // carried here. Validation failures (expired, min spend, category) come
    // back on bill.couponError instead — see server/utils/pricing.js.
    couponLoadError: loadError || null,
  };
}

function hydrateSaved(d, line) {
  const isProduct = line.item_id.startsWith('p:');
  if (isProduct) {
    const p = d.prepare('SELECT * FROM products WHERE id = ?').get(Number(line.item_id.slice(2)));
    return { ...line, name: p?.name ?? 'Unavailable product', image: p?.image_url, price: p?.price_paise ?? line.unit_price_paise, unit: p?.unit, inStock: (p?.stock ?? 0) > 0 };
  }
  const [, rid, mid] = line.item_id.split(':');
  const m = d.prepare('SELECT m.*, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id WHERE m.id = ?').get(Number(mid));
  return { ...line, name: m?.name ?? 'Unavailable dish', image: m?.image_url, price: m?.price_paise ?? line.unit_price_paise, restaurantName: m?.restaurant_name, inStock: !!m };
}

/* ---------------------------------- read --------------------------------- */
router.get('/', (req, res) => {
  res.json(buildCartPayload(req.cartOwnerKey, { couponCode: req.query.coupon }));
});

router.get('/summary', (req, res) => {
  const settings = settingsMap(getDb());
  const { items } = resolveCartForBilling(req.cartOwnerKey);
  const bill = computeBill(items, settings, null);
  res.json({ count: bill.itemCount, itemCount: bill.itemCount, merchandisePaise: bill.merchandisePaise, totalPaise: bill.totalPaise, delivery: bill.delivery });
});

/* --------------------------------- add ----------------------------------- */
router.post('/items', asyncHandler((req, res) => {
  const itemId = String(req.body?.itemId || '');
  const delta = Math.max(-50, Math.min(50, Number.parseInt(req.body?.quantity ?? 1, 10) || 1));
  addToCart(req.cartOwnerKey, itemId, { delta, options: req.body?.options || [] });
  res.status(201).json({ message: 'Added to cart', cart: buildCartPayload(req.cartOwnerKey) });
}));

/* ------------------------------- quantity -------------------------------- */
router.patch('/items', asyncHandler((req, res) => {
  const itemId = String(req.body?.itemId || '');
  const quantity = Number.parseInt(req.body?.quantity, 10);
  if (!Number.isFinite(quantity) || quantity < 0) throw ApiError.unprocessable('Quantity must be zero or more.');
  const optionsKey = normalizeOptions(req.body?.options || []);
  const line = setCartQuantity(req.cartOwnerKey, itemId, optionsKey, quantity);
  res.json({ removed: line === null, cart: buildCartPayload(req.cartOwnerKey) });
}));

router.delete('/items', asyncHandler((req, res) => {
  removeFromCart(req.cartOwnerKey, String(req.body?.itemId || ''), normalizeOptions(req.body?.options || []));
  res.json({ message: 'Item removed', cart: buildCartPayload(req.cartOwnerKey) });
}));

/* ---------------------------- save for later ----------------------------- */
router.post('/items/save', asyncHandler((req, res) => {
  setSavedFlag(req.cartOwnerKey, String(req.body?.itemId || ''), normalizeOptions(req.body?.options || []), true);
  res.json({ message: 'Saved for later', cart: buildCartPayload(req.cartOwnerKey) });
}));

router.post('/items/unsave', asyncHandler((req, res) => {
  setSavedFlag(req.cartOwnerKey, String(req.body?.itemId || ''), normalizeOptions(req.body?.options || []), false);
  res.json({ message: 'Moved back to cart', cart: buildCartPayload(req.cartOwnerKey) });
}));

/* -------------------------------- clear ---------------------------------- */
router.delete('/', (req, res) => {
  clearCart(req.cartOwnerKey);
  res.json({ message: 'Cart cleared', cart: buildCartPayload(req.cartOwnerKey) });
});

/* ------------------------ merge after guest login ------------------------ */
router.post('/merge', requireAuth, (req, res) => {
  const guestId = String(req.body?.guestSessionId || '');
  if (!/^[a-f0-9]{32}$/.test(guestId)) throw ApiError.unprocessable('No guest cart to merge.');
  const { merged } = mergeCarts(`u:${req.user.id}`, `s:${guestId}`);
  res.json({ merged, cart: buildCartPayload(`u:${req.user.id}`) });
});

export default router;
