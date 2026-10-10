/**
 * Checkout + orders.
 *
 * PRICE INTEGRITY: the client sends only an address id, a coupon code, a payment
 * method and an idempotency key. Every price is re-read from the catalogue and
 * recomputed here — a client that lies about a total gets the server's number,
 * not its own. Stock is decremented inside the same transaction, and the
 * idempotency key makes a double-clicked "Place order" produce one order.
 *
 * PAYMENTS: only `cod` and `demo_card` are implemented. `demo_card` is a
 * clearly-labelled simulation — it never contacts a gateway. There is no route
 * that lets the frontend declare a real payment successful.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { buildCartPayload, loadCoupon } from './cart.js';
import { resolveCartForBilling, parseItemId } from '../utils/cart.js';
import { computeBill, couponProblems, couponCategorySubtotal } from '../utils/pricing.js';
import { settingsMap } from '../utils/settings.js';
import { generateOrderNumber, ORDER_STATUSES, ORDER_STATUS_LABELS, CANCELLABLE_STATUSES, paiseToRupees } from '../utils/helpers.js';

const router = express.Router();

const DEMO_METHODS = [
  { id: 'cod', label: 'Cash on delivery', mode: 'cod', note: 'Pay the delivery partner in cash.' },
  { id: 'demo_card', label: 'Demo card (simulated)', mode: 'demo', note: 'Simulated payment for development. No money moves and no gateway is contacted.' },
  { id: 'upi_demo', label: 'UPI (demo — not connected)', mode: 'demo', note: 'Requires a PSP integration; kept as a demo method.' },
];

/** Validates an address for the current order. Throws with a human-readable reason. */
function loadAndValidateAddress(userId, addressId) {
  const d = getDb();
  let address;
  if (addressId) {
    address = d.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addressId, userId);
    if (!address) throw ApiError.unprocessable('That address is not saved to your account.');
  } else {
    address = d.prepare('SELECT * FROM addresses WHERE user_id = ? AND is_default = 1').get(userId)
      || d.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC LIMIT 1').get(userId);
    if (!address) throw ApiError.unprocessable('Please add a delivery address before placing the order.');
  }
  const city = d.prepare('SELECT * FROM cities WHERE name = ?').get(address.city);
  if (!city) throw ApiError.unprocessable(`We do not have delivery configuration for ${address.city} yet.`);
  if (city.status === 'coming-soon') {
    throw ApiError.unprocessable(`${address.city} is listed as coming soon — delivery is not operational there yet. Choose another address.`);
  }
  return { address, city };
}

/** Recomputes the authoritative bill for the current cart + coupon + address. */
export function recomputeOrder(userId, { couponCode = null, addressId = null } = {}) {
  const d = getDb();
  const ownerKey = `u:${userId}`;
  const settings = settingsMap(d);
  const { items, unavailable } = resolveCartForBilling(ownerKey);
  if (items.length === 0) throw ApiError.unprocessable('Your cart is empty.');
  if (unavailable.length > 0) {
    throw ApiError.unprocessable(
      `${unavailable.length} item(s) in your cart are unavailable right now. Remove them to continue.`,
      { unavailable: unavailable.map((u) => u.item_id) },
    );
  }

  // Stock check against live inventory.
  for (const item of items) {
    if (item.kind === 'product') {
      const p = d.prepare('SELECT stock, name FROM products WHERE id = ?').get(item.productId);
      if (!p || p.stock < item.quantity) {
        throw ApiError.unprocessable(`Only ${p?.stock ?? 0} left of ${p?.name ?? 'this item'} — reduce the quantity.`);
      }
    }
  }

  const { coupon } = loadCoupon(couponCode);
  if (coupon) {
    const eligible = couponCategorySubtotal(items, coupon.category_slug);
    const merchandise = items.reduce((s, i) => s + i.pricePaise * i.quantity, 0);
    const problem = couponProblems(coupon, eligible, merchandise);
    if (problem) throw ApiError.unprocessable(problem, { coupon: couponCode });
  }

  const { address, city } = loadAndValidateAddress(userId, addressId);

  // Restaurant minimum order.
  const restaurant = items.find((i) => i.restaurantId)
    ? d.prepare('SELECT * FROM restaurants WHERE id = ?').get(items.find((i) => i.restaurantId).restaurantId)
    : null;

  // The selected city can carry its own minimum delivery charge. The ₹150 rule
  // still waives the platform fee, but a zone fee is a floor rather than an add-on.
  const bill = computeBill(items, settings, coupon, {
    zoneDeliveryFeePaise: city?.delivery_fee_paise ?? 0,
  });

  if (restaurant && bill.merchandisePaise < restaurant.min_order_paise) {
    throw ApiError.unprocessable(
      `${restaurant.name} needs a minimum order of ₹${paiseToRupees(restaurant.min_order_paise)}. Add ₹${paiseToRupees(restaurant.min_order_paise - bill.merchandisePaise)} more.`,
    );
  }

  const etaMinutes = restaurant
    ? restaurant.eta_max
    : (city?.eta_max ?? 40);

  return { items, bill, coupon, settings, address, city, restaurant, etaMinutes, kind: restaurant ? 'food' : 'grocery' };
}

/* ------------------------------ checkout --------------------------------- */
router.get('/methods', requireAuth, (req, res) => {
  const saved = getDb().prepare('SELECT id, brand, label, last4, is_default FROM saved_payment_methods WHERE user_id = ?').all(req.user.id);
  res.json({ methods: DEMO_METHODS, saved });
});

router.post('/preview', requireAuth, asyncHandler((req, res) => {
  const { items, bill, address, restaurant, etaMinutes, kind } = recomputeOrder(req.user.id, {
    couponCode: req.body?.couponCode ?? null,
    addressId: req.body?.addressId ?? null,
  });
  res.json({
    items, bill, kind, etaMinutes,
    address: address && publicAddress(address),
    restaurant: restaurant && { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    thresholdPaise: bill.delivery.threshold,
  });
}));

/* ---------------------------- place the order ---------------------------- */
router.post('/', requireAuth, asyncHandler((req, res) => {
  const d = getDb();
  const idempotencyKey = String(req.body?.idempotencyKey || '').slice(0, 64);
  if (!idempotencyKey) throw ApiError.unprocessable('An idempotency key is required to place an order.');

  // Duplicate submission (double click / retry) → return the original order.
  const existing = d.prepare('SELECT * FROM orders WHERE idempotency_key = ? AND user_id = ?')
    .get(idempotencyKey, req.user.id);
  if (existing) {
    return res.status(200).json({ order: publicOrder(d, existing), duplicate: true });
  }

  const method = String(req.body?.paymentMethod || '');
  const allowed = DEMO_METHODS.find((m) => m.id === method);
  if (!allowed) throw ApiError.unprocessable('Choose a supported payment method.');

  const { items, bill, coupon, settings, address, restaurant, etaMinutes, kind } = recomputeOrder(req.user.id, {
    couponCode: req.body?.couponCode ?? null,
    addressId: req.body?.addressId ?? null,
  });

  const order = d.transaction(() => {
    const number = generateOrderNumber(d);
    const info = d.prepare(`INSERT INTO orders
      (order_number, user_id, kind, restaurant_id, status, subtotal_paise, discount_paise, coupon_code,
       delivery_fee_paise, handling_fee_paise, tax_paise, total_paise, free_delivery_applied, threshold_paise,
       address_snapshot, payment_method, payment_status, payment_mode, eta_minutes, idempotency_key,
       tracking_is_simulated, loyalty_earned)
      VALUES (@order_number, @user_id, @kind, @restaurant_id, 'placed', @subtotal_paise, @discount_paise, @coupon_code,
              @delivery_fee_paise, @handling_fee_paise, @tax_paise, @total_paise, @free_delivery_applied, @threshold_paise,
              @address_snapshot, @payment_method, @payment_status, @payment_mode, @eta_minutes, @idempotency_key,
              @tracking_is_simulated, @loyalty_earned)`)
      .run({
        order_number: number,
        user_id: req.user.id,
        kind,
        restaurant_id: restaurant?.id ?? null,
        subtotal_paise: bill.subtotalPaise,
        discount_paise: bill.discountPaise,
        coupon_code: bill.couponApplied?.code ?? null,
        delivery_fee_paise: bill.delivery.feePaise,
        handling_fee_paise: bill.handlingFeePaise,
        tax_paise: bill.taxPaise,
        total_paise: bill.totalPaise,
        free_delivery_applied: bill.delivery.feePaise === 0 && bill.subtotalPaise > 0 ? 1 : 0,
        threshold_paise: bill.delivery.threshold,
        address_snapshot: JSON.stringify(publicAddress(address)),
        payment_method: allowed.id,
        payment_status: allowed.mode === 'cod' ? 'pending' : 'paid-demo',
        payment_mode: allowed.mode,
        eta_minutes: etaMinutes,
        idempotency_key: idempotencyKey,
        tracking_is_simulated: settings.simulated_order_tracking ? 1 : 0,
        loyalty_earned: Math.floor((bill.totalPaise / 100) * (settings.loyalty_points_per_rupee || 0)),
      });
    const orderId = Number(info.lastInsertRowid);

    const insItem = d.prepare(`INSERT INTO order_items
      (order_id, item_id, item_kind, name, brand, unit, image_url, quantity, unit_price_paise, options, line_total_paise)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of items) {
      insItem.run(orderId, item.itemId, item.kind, item.name, item.brand ?? null, item.unit ?? null,
        item.image_url ?? null, item.quantity, item.pricePaise, JSON.stringify(item.options || []),
        item.pricePaise * item.quantity);
    }

    // Decrement stock for retail SKUs.
    const dec = d.prepare('UPDATE products SET stock = MAX(0, stock - ?), updated_at = datetime(\'now\') WHERE id = ?');
    for (const item of items) if (item.kind === 'product') dec.run(item.quantity, item.productId);

    // Coupon accounting (per-user limit enforced at redemption time).
    if (bill.couponApplied) {
      const c = d.prepare('SELECT * FROM coupons WHERE code = ?').get(bill.couponApplied.code);
      if (c.per_user_limit > 0) {
        const used = d.prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?').get(c.id, req.user.id).n;
        if (used >= c.per_user_limit) throw ApiError.unprocessable(`${c.code} can only be used ${c.per_user_limit} time(s) per account.`);
      }
      d.prepare('INSERT INTO coupon_redemptions (coupon_id, user_id, order_id) VALUES (?, ?, ?)').run(c.id, req.user.id, orderId);
      d.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(c.id);
    }

    // Loyalty.
    const earned = Math.floor((bill.totalPaise / 100) * (settings.loyalty_points_per_rupee || 0));
    if (earned > 0) {
      d.prepare('UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?').run(earned, req.user.id);
      d.prepare('INSERT INTO loyalty_ledger (user_id, delta, reason, order_id) VALUES (?, ?, ?, ?)')
        .run(req.user.id, earned, `Earned on order ${number}`, orderId);
    }

    d.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)')
      .run(orderId, 'placed', 'We received your order.');
    d.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, 'order', `Order ${number} placed`,
        `${items.length} item(s), ${`₹${paiseToRupees(bill.totalPaise)}`}. ${kind === 'food' ? 'The kitchen has been notified.' : 'Packing will start shortly.'}`,
        `/orders/${number}`);

    // Cart is emptied only after the order row exists.
    d.prepare('DELETE FROM cart_items WHERE owner_key = ? AND is_saved = 0').run(`u:${req.user.id}`);

    return d.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  })();

  res.status(201).json({ order: publicOrder(d, order), paymentMode: allowed.mode });
}));

/* ------------------------------ order list ------------------------------- */
router.get('/', requireAuth, (req, res) => {
  const d = getDb();
  const rows = d.prepare(`SELECT o.*, r.name AS restaurant_name,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id) AS unit_count
    FROM orders o LEFT JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 100`).all(req.user.id);
  res.json({ items: rows.map((o) => publicOrder(d, o)) });
});

router.get('/:orderNumber', requireAuth, (req, res) => {
  const d = getDb();
  const o = d.prepare('SELECT o.*, r.name AS restaurant_name FROM orders o LEFT JOIN restaurants r ON r.id = o.restaurant_id WHERE o.order_number = ? AND o.user_id = ?')
    .get(req.params.orderNumber, req.user.id);
  if (!o) throw ApiError.notFound('We could not find that order in your account.');
  res.json({ order: publicOrder(d, o, true) });
});

/* ------------------------- cancel + reorder ------------------------------ */
router.post('/:orderNumber/cancel', requireAuth, asyncHandler((req, res) => {
  const d = getDb();
  const o = d.prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?').get(req.params.orderNumber, req.user.id);
  if (!o) throw ApiError.notFound('We could not find that order.');
  if (!CANCELLABLE_STATUSES.includes(o.status)) {
    throw ApiError.conflict(`This order is already ${ORDER_STATUS_LABELS[o.status]?.toLowerCase() ?? o.status} and can no longer be cancelled.`);
  }
  d.transaction(() => {
    d.prepare(`UPDATE orders SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?`).run(o.id);
    d.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)')
      .run(o.id, 'cancelled', 'Cancelled by customer.');
    // Restore stock.
    const inc = d.prepare('UPDATE products SET stock = stock + ?, updated_at = datetime(\'now\') WHERE id = ?');
    for (const item of d.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id)) {
      const parsed = parseItemId(item.item_id);
      if (parsed?.kind === 'product') inc.run(item.quantity, parsed.productId);
    }
    // Reverse loyalty earned on a cancelled order.
    if (o.loyalty_earned > 0) {
      d.prepare('UPDATE users SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?').run(o.loyalty_earned, req.user.id);
      d.prepare('INSERT INTO loyalty_ledger (user_id, delta, reason, order_id) VALUES (?, ?, ?, ?)')
        .run(req.user.id, -o.loyalty_earned, `Reversed for cancelled order ${o.order_number}`, o.id);
    }
    // Refund the coupon use so it is not lost.
    if (o.coupon_code) {
      const c = d.prepare('SELECT * FROM coupons WHERE code = ?').get(o.coupon_code);
      if (c) {
        d.prepare('DELETE FROM coupon_redemptions WHERE order_id = ?').run(o.id);
        d.prepare('UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE id = ?').run(c.id);
      }
    }
    d.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, 'order', `Order ${o.order_number} cancelled`,
        o.payment_mode === 'cod' ? 'No payment was taken, so nothing will be refunded.' : 'Any demo payment is not real money and is not refunded.',
        `/orders/${o.order_number}`);
  })();
  res.json({ order: publicOrder(d, d.prepare('SELECT * FROM orders WHERE id = ?').get(o.id), true) });
}));

/** Re-adds every in-stock item of a past order back into the cart. */
router.post('/:orderNumber/reorder', requireAuth, asyncHandler((req, res) => {
  const d = getDb();
  const o = d.prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?').get(req.params.orderNumber, req.user.id);
  if (!o) throw ApiError.notFound('We could not find that order.');
  const items = d.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  const skipped = [];
  const ownerKey = `u:${req.user.id}`;

  d.transaction(() => {
    for (const item of items) {
      const parsed = parseItemId(item.item_id);
      if (!parsed) { skipped.push({ name: item.name, reason: 'unavailable' }); continue; }
      if (parsed.kind === 'product') {
        const p = d.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(parsed.productId);
        if (!p || p.stock <= 0) { skipped.push({ name: item.name, reason: 'out of stock' }); continue; }
      } else {
        const m = d.prepare('SELECT * FROM menu_items WHERE id = ? AND is_available = 1').get(parsed.menuItemId);
        if (!m) { skipped.push({ name: item.name, reason: 'off the menu' }); continue; }
      }
      const existing = d.prepare('SELECT * FROM cart_items WHERE owner_key = ? AND item_id = ? AND options = ? AND is_saved = 0')
        .get(ownerKey, item.item_id, item.options);
      if (existing) {
        d.prepare(`UPDATE cart_items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?`)
          .run(item.quantity, existing.id);
      } else {
        d.prepare(`INSERT INTO cart_items (owner_key, item_id, item_kind, restaurant_id, quantity, unit_price_paise, options)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(ownerKey, item.item_id, item.item_kind, item.item_id.startsWith('r:') ? parsed.restaurantId : null,
            item.quantity, item.unit_price_paise, item.options);
      }
    }
  })();

  res.json({ added: items.length - skipped.length, skipped, cart: buildCartPayload(ownerKey) });
}));

/* ------------------------------ helpers ---------------------------------- */
function publicAddress(a) {
  return {
    id: a.id, label: a.label, fullName: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2,
    city: a.city, state: a.state, pincode: a.pincode, landmark: a.landmark, isDefault: !!a.is_default,
  };
}

function publicOrder(d, o, withItems = false) {
  const payload = {
    id: o.id,
    orderNumber: o.order_number,
    kind: o.kind,
    restaurantName: o.restaurant_name ?? null,
    status: o.status,
    statusLabel: ORDER_STATUS_LABELS[o.status] ?? o.status,
    statusFlow: ORDER_STATUSES[o.kind] ?? ORDER_STATUSES.grocery,
    canCancel: CANCELLABLE_STATUSES.includes(o.status),
    subtotal: o.subtotal_paise,
    discount: o.discount_paise,
    couponCode: o.coupon_code,
    deliveryFee: o.delivery_fee_paise,
    handlingFee: o.handling_fee_paise,
    tax: o.tax_paise,
    total: o.total_paise,
    freeDeliveryApplied: !!o.free_delivery_applied,
    threshold: o.threshold_paise,
    address: safeJson(o.address_snapshot),
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    paymentMode: o.payment_mode,
    paymentIsDemo: o.payment_mode !== 'cod',
    etaMinutes: o.eta_minutes,
    trackingIsSimulated: !!o.tracking_is_simulated,
    loyaltyEarned: o.loyalty_earned,
    placedAt: o.placed_at,
    cancelledAt: o.cancelled_at,
    itemCount: o.item_count,
    unitCount: o.unit_count,
  };
  if (withItems) {
    payload.items = d.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(o.id).map((i) => ({
      itemId: i.item_id, kind: i.item_kind, name: i.name, brand: i.brand, unit: i.unit,
      image: i.image_url, quantity: i.quantity, unitPrice: i.unit_price_paise,
      lineTotal: i.line_total_paise, options: safeJson(i.options),
    }));
    payload.events = d.prepare('SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY id ASC').all(o.id);
  }
  return payload;
}

function safeJson(v) {
  try { return JSON.parse(v || 'null'); } catch { return null; }
}

export { publicOrder, publicAddress };
export default router;
