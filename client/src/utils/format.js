/** Formatting + small helpers shared across the app. All money arrives in paise. */

export const formatInr = (paise, { decimals = 'auto' } = {}) => {
  const n = (Number(paise) || 0) / 100;
  const useDecimals = decimals === 'auto' ? !Number.isInteger(n) : decimals === 'always';
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  })}`;
};

export const discountPercent = (price, mrp) => (mrp > 0 && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const inrFromPaise = (paise) => (Number(paise) || 0) / 100;

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function relativeTime(value) {
  if (!value) return '';
  const d = new Date(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(value);
}

export function debounce(fn, wait = 300) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

/** Cart line identity — must match the server's item_id format exactly. */
export const productId = (id) => `p:${id}`;
export const menuItemId = (restaurantId, id) => `r:${restaurantId}:${id}`;

/** Stable JSON for an option selection, mirroring server/utils/cart.normalizeOptions. */
export function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return '[]';
  const clean = options
    .filter(Boolean)
    .map((o) => (o.addon
      ? { addon: String(o.addon).slice(0, 80), pricePaise: Math.max(0, Math.round(Number(o.pricePaise) || 0)) }
      : { group: String(o.group || '').slice(0, 60), option: String(o.option || '').slice(0, 60), pricePaise: Math.round(Number(o.pricePaise) || 0) }));
  clean.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(clean);
}

export function optionsLabel(options) {
  if (!Array.isArray(options) || !options.length) return '';
  return options.map((o) => (o.addon ? o.addon : o.option)).filter(Boolean).join(' · ');
}
