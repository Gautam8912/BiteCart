/**
 * Application settings.
 *
 * The free-delivery threshold and delivery fee live in the `settings` table and
 * are editable from the admin dashboard — the number 150 is never hard-coded in
 * business logic. Numeric keys are coerced to Number so the bill engine can do
 * integer arithmetic directly.
 */
const NUMERIC_KEYS = new Set([
  'free_delivery_threshold_paise', 'delivery_fee_paise', 'handling_fee_paise',
  'gst_grocery_percent', 'gst_restaurant_percent', 'loyalty_points_per_rupee',
  'demo_mode', 'demo_payments_enabled', 'simulated_order_tracking', 'coupons_are_demo',
]);

export function settingsMap(d) {
  const rows = d.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = NUMERIC_KEYS.has(r.key) ? Number(r.value) : r.value;
  // Safety net: the business rule must exist even if a row is deleted by hand.
  if (!Number.isFinite(out.free_delivery_threshold_paise)) out.free_delivery_threshold_paise = 15000;
  if (!Number.isFinite(out.delivery_fee_paise)) out.delivery_fee_paise = 0;
  if (!Number.isFinite(out.handling_fee_paise)) out.handling_fee_paise = 0;
  return out;
}

export function setSetting(d, key, value) {
  d.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}
