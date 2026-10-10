/** Money + response helpers. All amounts are integer paise. */

export const paiseToRupees = (p) => (Number(p) || 0) / 100;
export const rupeesToPaise = (r) => Math.round((Number(r) || 0) * 100);

export function formatInr(paise) {
  const n = paiseToRupees(paise);
  const rounded = Math.round(n * 100) / 100;
  const s = rounded.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2, maximumFractionDigits: 2 });
  return `₹${s}`;
}

export function clampInt(value, min, max, fallback = min) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Strips control characters and trims; used before every write. */
export function sanitize(value, max = 500) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function isValidEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
}

/** Indian mobile: 10 digits starting 6–9. */
export function isValidIndianMobile(v) {
  return typeof v === 'string' && /^[6-9]\d{9}$/.test(v);
}

export function isValidPincode(v) {
  return typeof v === 'string' && /^[1-9]\d{5}$/.test(v);
}

/**
 * Password policy: 8+ chars with at least one letter and one digit.
 * Kept deliberately modest — this is a demo build, not a security certification.
 */
export function passwordProblems(password) {
  const problems = [];
  if (typeof password !== 'string' || password.length < 8) problems.push('Password must be at least 8 characters.');
  if (password && !/[A-Za-z]/.test(password)) problems.push('Password must contain a letter.');
  if (password && !/\d/.test(password)) problems.push('Password must contain a number.');
  return problems;
}

export function generateOrderNumber(d) {
  const seq = d.prepare('SELECT COUNT(*) AS n FROM orders').get().n + 1;
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `FE${ymd}${String(seq).padStart(4, '0')}`;
}

export const ORDER_STATUSES = {
  grocery: ['placed', 'confirmed', 'packing', 'out_for_delivery', 'delivered'],
  food: ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'],
};

export const ORDER_STATUS_LABELS = {
  placed: 'Order placed',
  confirmed: 'Confirmed',
  packing: 'Packing',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Statuses a customer is still allowed to cancel from. */
export const CANCELLABLE_STATUSES = ['placed', 'confirmed', 'packing', 'preparing'];
