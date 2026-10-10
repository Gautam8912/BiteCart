/**
 * Cart engine (server-side, authoritative).
 *
 * Line identity is `item_id`:
 *   - retail product  -> `p:<productId>`
 *   - restaurant dish -> `r:<restaurantId>:<menuItemId>`
 *
 * The UNIQUE (owner_key, item_id, options) constraint means clicking
 * "Add to cart" twice on the same product can only ever increment the quantity —
 * it cannot create a second unrelated entry. Restaurant dishes additionally
 * carry their variation/addon selection in `options`, so "Half plate, extra
 * spicy" and "Full plate" are legitimately separate lines.
 *
 * BUSINESS RULE enforced here: an order may contain items from at most ONE
 * restaurant, plus any number of grocery items. Mixing two kitchens is refused
 * with a clear message rather than silently accepted.
 */
import { getDb } from '../db/index.js';
import { ApiError } from '../middleware/errors.js';

export function parseItemId(itemId) {
  if (typeof itemId !== 'string') return null;
  const productMatch = itemId.match(/^p:(\d+)$/);
  if (productMatch) return { kind: 'product', productId: Number(productMatch[1]) };
  const menuMatch = itemId.match(/^r:(\d+):(\d+)$/);
  if (menuMatch) return { kind: 'menu_item', restaurantId: Number(menuMatch[1]), menuItemId: Number(menuMatch[2]) };
  return null;
}

export function makeItemId(kind, ids) {
  return kind === 'menu_item' ? `r:${ids.restaurantId}:${ids.menuItemId}` : `p:${ids.productId}`;
}

/** Normalises a client-supplied options payload into a stable, sorted JSON string. */
export function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return '[]';
  const clean = options
    .filter((o) => o && typeof o === 'object')
    .map((o) => {
      if (o.addon) return { addon: String(o.addon).slice(0, 80), pricePaise: Math.max(0, Math.round(Number(o.pricePaise) || 0)) };
      return {
        group: String(o.group || '').slice(0, 60),
        option: String(o.option || '').slice(0, 60),
        pricePaise: Math.round(Number(o.pricePaise) || 0),
      };
    });
  clean.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(clean);
}

export function readCart(ownerKey) {
  return getDb()
    .prepare(`SELECT id, item_id, item_kind, restaurant_id, quantity, unit_price_paise, options, is_saved, updated_at
              FROM cart_items WHERE owner_key = ? ORDER BY is_saved ASC, updated_at DESC`)
    .all(ownerKey);
}

/**
 * Adds (or increments) a line. Returns the resulting line.
 * `delta` is normally +1; the quantity endpoint passes an absolute target instead.
 */
export function addToCart(ownerKey, itemId, { delta = 1, options = [] } = {}) {
  const d = getDb();
  const parsed = parseItemId(itemId);
  if (!parsed) throw ApiError.badRequest('That item cannot be added to the cart.');

  const optionsKey = normalizeOptions(options);
  let line;
  let resolved;

  if (parsed.kind === 'product') {
    resolved = d.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(parsed.productId);
    if (!resolved) throw ApiError.notFound('That product is no longer available.');
    if (resolved.stock <= 0) throw ApiError.conflict(`${resolved.name} is out of stock.`);
  } else {
    const menu = d.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ? AND is_available = 1')
      .get(parsed.menuItemId, parsed.restaurantId);
    if (!menu) throw ApiError.notFound('That dish is no longer available.');
    const restaurant = d.prepare('SELECT * FROM restaurants WHERE id = ? AND is_open = 1').get(parsed.restaurantId);
    if (!restaurant) throw ApiError.conflict(`${restaurantName(restaurant)} is not accepting orders right now.`);
    resolved = { ...menu, name: menu.name, price_paise: menu.price_paise, category_slug: 'restaurants', restaurant_slug: restaurant.slug };
  }

  enforceRestaurantRule(ownerKey, parsed.restaurantId ?? null);

  const existing = d.prepare('SELECT * FROM cart_items WHERE owner_key = ? AND item_id = ? AND options = ? AND is_saved = 0')
    .get(ownerKey, itemId, optionsKey);

  const maxQty = parsed.kind === 'product' ? Math.max(1, resolved.stock) : 20;

  if (existing) {
    const nextQty = Math.min(maxQty, existing.quantity + delta);
    if (nextQty <= 0) {
      d.prepare('DELETE FROM cart_items WHERE id = ?').run(existing.id);
      return null;
    }
    d.prepare(`UPDATE cart_items SET quantity = ?, unit_price_paise = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(nextQty, resolved.price_paise, existing.id);
    line = { ...existing, quantity: nextQty, unit_price_paise: resolved.price_paise };
  } else {
    if (delta <= 0) throw ApiError.badRequest('Quantity must be at least 1.');
    const qty = Math.min(maxQty, delta);
    const info = d.prepare(`INSERT INTO cart_items (owner_key, item_id, item_kind, restaurant_id, quantity, unit_price_paise, options)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(ownerKey, itemId, parsed.kind, parsed.restaurantId ?? null, qty, resolved.price_paise, optionsKey);
    line = { id: info.lastInsertRowid, item_id: itemId, item_kind: parsed.kind, restaurant_id: parsed.restaurantId ?? null, quantity: qty, unit_price_paise: resolved.price_paise, options: optionsKey };
  }

  return { ...line, resolved };
}

export function setCartQuantity(ownerKey, itemId, optionsKey, quantity) {
  const d = getDb();
  const line = d.prepare('SELECT * FROM cart_items WHERE owner_key = ? AND item_id = ? AND options = ?')
    .get(ownerKey, itemId, optionsKey ?? '[]');
  if (!line) throw ApiError.notFound('That item is not in your cart.');
  if (quantity <= 0) {
    d.prepare('DELETE FROM cart_items WHERE id = ?').run(line.id);
    return null;
  }
  const maxQty = line.item_kind === 'product'
    ? Math.max(1, (d.prepare('SELECT stock FROM products WHERE id = ?').get(parseItemId(line.item_id).productId)?.stock ?? 1))
    : 20;
  const next = Math.min(maxQty, quantity);
  d.prepare(`UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?`).run(next, line.id);
  return { ...line, quantity: next };
}

export function removeFromCart(ownerKey, itemId, optionsKey) {
  const info = getDb().prepare('DELETE FROM cart_items WHERE owner_key = ? AND item_id = ? AND options = ?')
    .run(ownerKey, itemId, optionsKey ?? '[]');
  if (info.changes === 0) throw ApiError.notFound('That item is not in your cart.');
}

export function setSavedFlag(ownerKey, itemId, optionsKey, isSaved) {
  const info = getDb().prepare(`UPDATE cart_items SET is_saved = ?, updated_at = datetime('now')
                                WHERE owner_key = ? AND item_id = ? AND options = ?`)
    .run(isSaved ? 1 : 0, ownerKey, itemId, optionsKey ?? '[]');
  if (info.changes === 0) throw ApiError.notFound('That item is not in your cart.');
}

export function clearCart(ownerKey) {
  getDb().prepare('DELETE FROM cart_items WHERE owner_key = ? AND is_saved = 0').run(ownerKey);
}

/**
 * Guest -> account merge. Uses MAX(guestQty, userQty) per line, as required:
 * a guest who already had 2 and signs in with 2 in the account ends with 2,
 * not 4. Returns how many lines were merged.
 */
export function mergeCarts(userKey, guestKey) {
  if (!guestKey || userKey === guestKey) return { merged: 0 };
  const d = getDb();
  const guestLines = readCart(guestKey);
  let merged = 0;
  const tx = d.transaction(() => {
    for (const g of guestLines) {
      const existing = d.prepare('SELECT * FROM cart_items WHERE owner_key = ? AND item_id = ? AND options = ?')
        .get(userKey, g.item_id, g.options);
      if (existing) {
        const qty = Math.max(existing.quantity, g.quantity);
        d.prepare(`UPDATE cart_items SET quantity = ?, is_saved = 0, updated_at = datetime('now') WHERE id = ?`)
          .run(qty, existing.id);
      } else {
        d.prepare(`INSERT INTO cart_items (owner_key, item_id, item_kind, restaurant_id, quantity, unit_price_paise, options, is_saved)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)`)
          .run(userKey, g.item_id, g.item_kind, g.restaurant_id, g.quantity, g.unit_price_paise, g.options);
      }
      merged += 1;
    }
    d.prepare('DELETE FROM cart_items WHERE owner_key = ?').run(guestKey);
  });
  tx();
  return { merged };
}

/** Refuses a second restaurant in one cart. */
function enforceRestaurantRule(ownerKey, restaurantId) {
  if (!restaurantId) return;
  const existing = getDb()
    .prepare('SELECT DISTINCT restaurant_id FROM cart_items WHERE owner_key = ? AND is_saved = 0 AND restaurant_id IS NOT NULL')
    .all(ownerKey)
    .map((r) => r.restaurant_id);
  const others = existing.filter((id) => id !== restaurantId);
  if (others.length > 0) {
    const current = getDb().prepare('SELECT id, slug, name FROM restaurants WHERE id = ?').get(others[0]);
    throw ApiError.conflict(
      `Your cart already has items from ${current?.name ?? 'another restaurant'}. Orders can only contain items from one restaurant — remove those items or save them for later first.`,
      // The client shows this so the shopper knows which cart to clear.
      { restaurant: current ? { id: current.id, slug: current.slug, name: current.name } : null },
    );
  }
}

function restaurantName(r) {
  return r?.name ?? 'This restaurant';
}

/**
 * Resolves cart lines against CURRENT catalogue data and returns the objects the
 * bill engine expects. Any line whose product was deactivated or de-stocked is
 * reported separately so the UI can show it instead of silently dropping it.
 */
export function resolveCartForBilling(ownerKey, { includeSaved = false } = {}) {
  const d = getDb();
  const lines = readCart(ownerKey).filter((l) => includeSaved || l.is_saved === 0);
  const items = [];
  const unavailable = [];

  for (const line of lines) {
    const parsed = parseItemId(line.item_id);
    if (!parsed) { unavailable.push({ ...line, reason: 'unknown-item' }); continue; }
    const options = safeParse(line.options);

    if (parsed.kind === 'product') {
      const p = d.prepare('SELECT * FROM products WHERE id = ?').get(parsed.productId);
      if (!p || p.is_active !== 1) { unavailable.push({ ...line, name: p?.name ?? 'Unavailable product', reason: 'inactive' }); continue; }
      if (p.stock <= 0) { unavailable.push({ ...line, name: p.name, reason: 'out-of-stock', image_url: p.image_url }); continue; }
      items.push({
        lineId: line.id, itemId: line.item_id, kind: 'product', productId: p.id,
        name: p.name, brand: p.brand, unit: p.unit, image_url: p.image_url,
        categorySlug: p.category_slug, quantity: Math.min(line.quantity, p.stock),
        pricePaise: p.price_paise, mrpPaise: p.mrp_paise, options,
        slug: p.slug, stock: p.stock,
      });
    } else {
      const m = d.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(parsed.menuItemId, parsed.restaurantId);
      if (!m || m.is_available !== 1) { unavailable.push({ ...line, name: m?.name ?? 'Unavailable dish', reason: 'inactive' }); continue; }
      const r = d.prepare('SELECT * FROM restaurants WHERE id = ?').get(parsed.restaurantId);
      items.push({
        lineId: line.id, itemId: line.item_id, kind: 'menu_item',
        productId: m.id, restaurantId: r.id, restaurantSlug: r.slug, restaurantName: r.name,
        name: m.name, unit: undefined, image_url: m.image_url,
        categorySlug: 'restaurants', quantity: line.quantity,
        pricePaise: m.price_paise, mrpPaise: m.mrp_paise, options, slug: m.slug,
      });
    }
  }
  return { items, unavailable };
}

function safeParse(json) {
  try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
