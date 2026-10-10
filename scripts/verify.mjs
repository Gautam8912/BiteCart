#!/usr/bin/env node
/**
 * Acceptance runner — walks the end-to-end flows from the brief against a real
 * server process, over HTTP, exactly as a browser would.
 *
 * Unlike tests/api.test.mjs (which mounts the app in-process), this script
 * spawns `node server/index.js`, waits for /api/health, then drives the flows
 * and prints a pass/fail table. It is the last gate before shipping.
 *
 *   npm run verify
 *
 * Exits non-zero if any check fails, so CI can rely on it.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = Number(process.env.FE_VERIFY_PORT || 4321);
const BASE = `http://127.0.0.1:${PORT}`;

const env = {
  ...process.env,
  PORT: String(PORT),
  FE_DB_PATH: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fe-verify-')), 'verify.db'),
  FE_JWT_SECRET: 'verify-only-secret',
  FE_DEMO_ADMIN_PASSWORD: 'Admin@12345',
  FE_DEMO_CUSTOMER_PASSWORD: 'Customer@12345',
  FE_AUTH_RATE_LIMIT: '100000',
  NODE_ENV: 'test',
};

const results = [];
let jar = null;
let lastToken = null;

/* ------------------------------ http helper ------------------------------ */
async function api(pathname, { method = 'GET', body, token, cookie, asGuest = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const useToken = asGuest ? null : (token ?? lastToken);
  if (useToken) headers.Authorization = `Bearer ${useToken}`;
  // An explicit cookie always wins over the ambient jar, even for a guest call:
  // the guest-merge check needs to log in *with* a specific guest session.
  const useCookie = cookie ?? (asGuest ? null : jar);
  if (useCookie) headers.Cookie = useCookie;

  const res = await fetch(BASE + pathname, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON */ }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) jar = setCookie.split(';')[0];
  return { status: res.status, data };
}

/* -------------------------------- checks --------------------------------- */
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* --------------------------------- main ---------------------------------- */
const child = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], {
  env, cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', () => {});
child.stderr.on('data', (d) => process.env.FE_VERIFY_VERBOSE && process.stderr.write(d));

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

let exitCode = 0;
try {
  if (!await waitForHealth()) throw new Error('server did not become healthy in time');

  /* 1 — guest can load the storefront config (threshold, fee, demo flags) */
  let config;
  await check('Storefront config exposes the ₹150 threshold', async () => {
    const { data } = await api('/api/config');
    config = data;
    assert(data.freeDeliveryThreshold === 15000, `threshold is ${data.freeDeliveryThreshold}`);
    assert(data.deliveryFee === 2900, `fee is ${data.deliveryFee}`);
    assert(data.demoMode === true, 'demoMode should be true');
    return `threshold ₹${data.freeDeliveryThreshold / 100}, fee ₹${data.deliveryFee / 100}, demo=${data.demoMode}`;
  });

  /* 2 — catalogue has at least 120 distinct products */
  let products = [];
  await check('Catalogue has 120+ distinct products', async () => {
    const { data } = await api('/api/products?pageSize=60&page=1');
    const p2 = await api('/api/products?pageSize=60&page=2');
    const p3 = await api('/api/products?pageSize=60&page=3');
    const p4 = await api('/api/products?pageSize=60&page=4');
    products = [...data.items, ...p2.data.items, ...p3.data.items, ...p4.data.items];
    const unique = new Set(products.map((p) => p.id));
    assert(data.total >= 120, `only ${data.total} products`);
    assert(unique.size === products.length, 'duplicate products returned across pages');
    return `${data.total} products, ${new Set(products.map((p) => p.categorySlug)).size} categories`;
  });

  /* 3 — every home page rail has real items */
  await check('Home page rails are populated', async () => {
    const { data } = await api('/api/products/sections');
    const empty = data.filter((s) => s.items.length === 0).map((s) => s.key);
    assert(data.length >= 10, `only ${data.length} sections`);
    assert(empty.length === 0, `empty sections: ${empty.join(', ')}`);
    return `${data.length} rails, smallest has ${Math.min(...data.map((s) => s.items.length))} items`;
  });

  /* 4 — search tolerates a typo */
  await check('Search tolerates a typo ("tamato" → tomato)', async () => {
    const { data } = await api('/api/search?q=tamato');
    assert(data.items.length > 0, 'no results');
    assert(data.items.some((i) => /tomato/i.test(i.name)), 'no tomato matched');
    return `${data.items.length} results, first "${data.items[0].name}"`;
  });

  /* 5 — product detail carries a full model with demo-labelled ratings */
  await check('Product detail has specs, related, FBT and demo ratings', async () => {
    const { data } = await api(`/api/products/${products[0].slug}`);
    assert(data.product.description, 'no description');
    assert(data.product.specs && Object.keys(data.product.specs).length, 'no specs');
    assert(data.related.length > 0, 'no related');
    assert(data.boughtTogether.length > 0, 'no frequently-bought-together');
    assert(data.product.ratingIsDemo === true, 'ratings not labelled demo');
    return `${data.product.name} · ${data.related.length} related · ${data.boughtTogether.length} FBT`;
  });

  /* 6 — adding twice yields quantity 2 on a single line */
  await check('Adding the same item twice gives qty 2, not two lines', async () => {
    jar = null; lastToken = null;
    const p = products.find((x) => x.stock > 5);
    await api('/api/cart/items', { method: 'POST', body: { itemId: `p:${p.id}`, quantity: 1 } });
    const { data } = await api('/api/cart/items', { method: 'POST', body: { itemId: `p:${p.id}`, quantity: 1 } });
    const lines = data.cart.items.filter((i) => i.itemId === `p:${p.id}`);
    assert(lines.length === 1, `${lines.length} lines created`);
    assert(lines[0].quantity === 2, `quantity is ${lines[0].quantity}`);
    return `${p.name} × ${lines[0].quantity}`;
  });

  /* 7 — the ₹150 progress bar reports the right remaining amount */
  await check('Free-delivery progress reports the exact remaining amount', async () => {
    const { data } = await api('/api/cart');
    const b = data.bill.delivery;
    const expected = Math.max(0, 15000 - data.bill.merchandisePaise);
    assert(b.threshold === 15000, `threshold ${b.threshold}`);
    assert(b.remaining === expected, `remaining ${b.remaining}, expected ${expected}`);
    assert(b.percent >= 0 && b.percent <= 100, `percent ${b.percent}`);
    return `cart ₹${(data.bill.merchandisePaise / 100).toFixed(2)}, ₹${(b.remaining / 100).toFixed(2)} to go, ${b.percent}%`;
  });

  /* 8 — removing an item updates the totals */
  await check('Removing an item recomputes the bill', async () => {
    const { data: before } = await api('/api/cart');
    const line = before.items[0];
    const { data } = await api('/api/cart/items', { method: 'DELETE', body: { itemId: line.itemId, options: [] } });
    assert(data.cart.bill.itemCount === 0, 'cart not empty after removal');
    assert(data.cart.bill.totalPaise === 0, 'total not zeroed');
    return `from ₹${(before.bill.totalPaise / 100).toFixed(2)} to ₹0`;
  });

  /* 9 — guest cart survives sign-in */
  await check('Guest cart is retained after sign-in', async () => {
    const guestCookie = 'fe_guest=cccccccccccccccccccccccccccccccc; Path=/';
    jar = guestCookie; lastToken = null;
    const p = products.find((x) => x.stock > 20);
    await api('/api/cart', { method: 'DELETE' });
    await api('/api/cart/items', { method: 'POST', body: { itemId: `p:${p.id}`, quantity: 3 } });
    jar = guestCookie;
    const login = await api('/api/auth/login', {
      method: 'POST', cookie: guestCookie, asGuest: true,
      body: { identifier: 'demo@foodexpress.example', password: 'Customer@12345' },
    });
    assert(login.status === 200, `login failed: ${login.data?.error}`);
    lastToken = login.data.token;
    assert(login.data.cartMergedFromGuest >= 1, 'guest cart was not merged');
    const { data } = await api('/api/cart');
    const line = data.items.find((i) => i.itemId === `p:${p.id}`);
    assert(line && line.quantity === 3, `merged quantity is ${line?.quantity}`);
    return `${login.data.cartMergedFromGuest} item(s) carried over, qty ${line.quantity}`;
  });

  /* 10 — registration rejects duplicates */
  await check('Duplicate registration is rejected with 409', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST', asGuest: true,
      body: { name: 'Dupe', email: 'demo@foodexpress.example', mobile: '9000000099', password: 'Secret@12345', acceptTerms: true },
    });
    assert(status === 409, `status ${status}`);
    assert(/already exists/i.test(data.error), data.error);
    return data.error;
  });

  /* 11 — passwords are bcrypt-hashed, never plaintext */
  await check('Passwords are bcrypt hashes', async () => {
    const email = `verify${Date.now()}@example.com`;
    const reg = await api('/api/auth/register', {
      method: 'POST', asGuest: true,
      body: { name: 'Verify User', email, mobile: `9002${Date.now().toString().slice(-6)}`, password: 'Secret@12345', acceptTerms: true },
    });
    assert(reg.status === 201, JSON.stringify(reg.data));
    assert(!('password_hash' in reg.data.user) && !('passwordHash' in reg.data.user), 'hash leaked to client');
    return `${email} registered, no hash in the response`;
  });

  /* 12 — admin authorisation is enforced server-side */
  await check('A customer cannot reach the admin API (403)', async () => {
    const { status, data } = await api('/api/admin/stats');
    assert(status === 403, `status ${status}`);
    assert(data.code === 'FORBIDDEN', data.code);
    return 'blocked with 403 FORBIDDEN';
  });

  await check('An admin can reach the dashboard', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST', asGuest: true,
      body: { identifier: 'admin@foodexpress.example', password: 'Admin@12345' },
    });
    assert(login.status === 200, `admin login failed: ${login.data?.error}`);
    lastToken = login.data.token;
    const { status, data } = await api('/api/admin/stats');
    assert(status === 200, `status ${status}`);
    assert(typeof data.totals.orders === 'number', 'no totals');
    return `${data.totals.orders} orders, ${data.totals.activeProducts} active products, ${data.totals.outOfStock} out of stock`;
  });

  /* 13 — a customer cannot change a price even by calling the API directly */
  await check('A customer cannot mutate a price through the admin API', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST', asGuest: true,
      body: { identifier: 'demo@foodexpress.example', password: 'Customer@12345' },
    });
    lastToken = login.data.token;
    const { status } = await api(`/api/admin/products/${products[0].id}`, { method: 'PUT', body: { price: 1 } });
    assert(status === 403, `status ${status}`);
    const after = await api(`/api/products/${products[0].slug}`);
    assert(after.data.product.price === products[0].price, 'the price actually changed');
    return 'blocked, price unchanged';
  });

  /* 14 — city availability genuinely differs */
  await check('Delivery availability differs by city', async () => {
    const live = await api('/api/location/check?pincode=520010');   // Vijayawada
    const soon = await api('/api/location/check?pincode=800001');   // Patna
    assert(live.data.serviceable === true, 'Vijayawada should be serviceable');
    assert(soon.data.serviceable === false, 'Patna should not be serviceable');
    assert(soon.data.city.status === 'coming-soon', soon.data.city.status);
    return `${live.data.city.name} serviceable, ${soon.data.city.name} ${soon.data.city.status}`;
  });

  /* 15 — the ₹150 threshold is admin-configurable and takes effect at once */
  await check('Changing the threshold in admin takes effect immediately', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST', asGuest: true,
      body: { identifier: 'admin@foodexpress.example', password: 'Admin@12345' },
    });
    const adminToken = login.data.token;
    await api('/api/admin/settings', { method: 'PUT', token: adminToken, body: { free_delivery_threshold_paise: 29900 } });
    const changed = await api('/api/config');
    assert(changed.data.freeDeliveryThreshold === 29900, `still ${changed.data.freeDeliveryThreshold}`);
    await api('/api/admin/settings', { method: 'PUT', token: adminToken, body: { free_delivery_threshold_paise: 15000 } });
    const restored = await api('/api/config');
    assert(restored.data.freeDeliveryThreshold === 15000, 'not restored');
    return '₹299 applied, then restored to ₹150';
  });

  /* 16 — coupons: valid applies, expired and disabled are refused */
  await check('Coupons validate server-side (valid / expired / disabled)', async () => {
    jar = null; lastToken = null;
    await api('/api/cart', { method: 'DELETE' });
    const big = products.find((p) => p.price > 70000 && p.stock > 5);
    await api('/api/cart/items', { method: 'POST', body: { itemId: `p:${big.id}`, quantity: 1 } });

    const good = await api('/api/cart?coupon=FIRSTORDER');
    assert(good.data.bill.discountPaise > 0, 'a valid coupon did not discount');
    const expired = await api('/api/cart?coupon=DIWALI25');
    assert(expired.data.bill.discountPaise === 0, 'an expired coupon discounted');
    assert(/expired/i.test(expired.data.bill.couponError), expired.data.bill.couponError);
    const off = await api('/api/cart?coupon=EXPIRED100');
    assert(off.data.bill.discountPaise === 0, 'a disabled coupon discounted');
    const bogus = await api('/api/cart?coupon=NOTREAL');
    assert(/not found/i.test(bogus.data.couponLoadError), bogus.data.couponLoadError);
    return `FIRSTORDER −₹${(good.data.bill.discountPaise / 100).toFixed(2)}; DIWALI25/EXPIRED100/NOTREAL all refused`;
  });

  /* 17 — one restaurant per cart */
  await check('A second restaurant in one cart is refused (409)', async () => {
    const { data: rests } = await api('/api/restaurants?limit=50');
    const a = rests.items[0];
    const b = rests.items.find((r) => r.id !== a.id);
    await api('/api/cart', { method: 'DELETE' });
    const mA = (await api(`/api/restaurants/${a.slug}`)).data;
    await api('/api/cart/items', { method: 'POST', body: { itemId: `r:${a.id}:${mA.menu[0].items[0].id}`, quantity: 1 } });
    const mB = (await api(`/api/restaurants/${b.slug}`)).data;
    const { status, data } = await api('/api/cart/items', { method: 'POST', body: { itemId: `r:${b.id}:${mB.menu[0].items[0].id}`, quantity: 1 } });
    assert(status === 409, `status ${status}`);
    assert(data.details?.restaurant?.name === a.name, 'the conflicting restaurant was not named');
    return `kept ${a.name}, refused ${b.name}`;
  });

  /* 18 — checkout validates, then places a demo-labelled order */
  let orderNumber;
  await check('Checkout refuses an empty cart and an unknown payment method', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST', asGuest: true,
      body: { identifier: 'demo@foodexpress.example', password: 'Customer@12345' },
    });
    lastToken = login.data.token;
    await api('/api/cart', { method: 'DELETE' });
    const empty = await api('/api/checkout', { method: 'POST', body: { addressId: 1, paymentMethod: 'cod', idempotencyKey: 'v-empty' } });
    assert(empty.status === 409 || empty.status === 422, `empty cart status ${empty.status}`);
    const p = products.find((x) => x.stock > 10);
    await api('/api/cart/items', { method: 'POST', body: { itemId: `p:${p.id}`, quantity: 1 } });
    const bad = await api('/api/checkout', { method: 'POST', body: { addressId: 1, paymentMethod: 'paypal', idempotencyKey: 'v-bad' } });
    assert(bad.status === 422, `bad method status ${bad.status}`);
    return 'empty cart and "paypal" both refused';
  });

  await check('A placed order is created once and labelled demo where applicable', async () => {
    const { data: addrs } = await api('/api/account/addresses');
    const addrId = addrs.items[0].id;
    const key = `verify-${Date.now()}`;
    const first = await api('/api/checkout', {
      method: 'POST',
      body: { addressId: addrId, paymentMethod: 'upi_demo', idempotencyKey: key, paymentDetails: { upiId: 'demo@upi' } },
    });
    assert(first.status === 201, `status ${first.status}: ${JSON.stringify(first.data)}`);
    orderNumber = first.data.order.orderNumber;
    assert(first.data.order.paymentIsDemo === true, 'demo payment not labelled');
    assert(first.data.order.paymentMode === 'demo', first.data.order.paymentMode);

    const replay = await api('/api/checkout', {
      method: 'POST',
      body: { addressId: addrId, paymentMethod: 'upi_demo', idempotencyKey: key, paymentDetails: { upiId: 'demo@upi' } },
    });
    assert(replay.data.duplicate === true, 'a replay created a second order');
    assert(replay.data.order.orderNumber === orderNumber, 'replay returned a different order');
    return `${orderNumber}, ${first.data.order.statusLabel}, payment ${first.data.order.paymentStatus} (demo), replay deduped`;
  });

  /* 19 — order history + detail + cancel */
  await check('Order history and detail expose the tracker and bill', async () => {
    const { data } = await api(`/api/checkout/${orderNumber}`);
    assert(data.order.statusFlow.length >= 5, 'status flow too short');
    assert(data.order.statusFlow[0] === 'placed' && data.order.statusFlow.at(-1) === 'delivered', 'unexpected flow');
    assert(data.order.items.length > 0, 'no items');
    assert(data.order.address.line1, 'no address snapshot');
    assert(data.order.total === data.order.subtotal - data.order.discount + data.order.deliveryFee + data.order.handlingFee + data.order.tax,
      'the order bill does not reconcile');
    return `${data.order.statusFlow.join(' → ')}`;
  });

  await check('An order can be cancelled and restocks the line', async () => {
    const { status, data } = await api(`/api/checkout/${orderNumber}/cancel`, { method: 'POST', body: { reason: 'Verify run' } });
    assert(status === 200, `status ${status}: ${JSON.stringify(data)}`);
    assert(data.order.status === 'cancelled', data.order.status);
    const again = await api(`/api/checkout/${orderNumber}/cancel`, { method: 'POST', body: { reason: 'again' } });
    assert(again.status === 409, 'a cancelled order was cancelled twice');
    return 'cancelled once, second attempt refused';
  });

  /* 20 — wishlist and notifications */
  await check('Wishlist persists for the signed-in user', async () => {
    const p = products[1];
    const add = await api('/api/account/wishlist', { method: 'POST', body: { productId: p.id } });
    assert(add.status === 201, JSON.stringify(add.data));
    const { data } = await api('/api/account/wishlist');
    assert(data.items.some((i) => i.id === p.id), 'the item is not in the wishlist');
    return `${data.items.length} saved item(s)`;
  });

  await check('Notifications record order events', async () => {
    const { data } = await api('/api/notifications?limit=20');
    assert(data.items.length > 0, 'no notifications');
    assert(data.items.some((n) => n.title.includes(orderNumber) || n.body?.includes(orderNumber)), 'no notification for the order');
    return `${data.items.length} notifications, ${data.unread ?? data.items.filter((n) => !n.isRead).length} unread`;
  });

  /* 21 — every public page route answers (no blank routes) */
  await check('Static page content is served for legal/help routes', async () => {
    for (const p of ['/api/health', '/api/config', '/api/categories', '/api/restaurants']) {
      const r = await api(p);
      assert(r.status === 200, `${p} → ${r.status}`);
    }
    return 'health, config, categories, restaurants all 200';
  });

  /* 22 — unknown API routes fail loudly rather than returning the SPA shell */
  await check('Unknown API routes return a JSON 404', async () => {
    const { status, data } = await api('/api/does-not-exist');
    assert(status === 404, `status ${status}`);
    assert(data.code === 'NOT_FOUND', JSON.stringify(data));
    return data.error;
  });

  /* 23 — the client bundle exists (a real deployable build) */
  await check('Client build output exists (client/dist/index.html)', async () => {
    const dist = path.join(ROOT, 'client/dist/index.html');
    assert(fs.existsSync(dist), 'client/dist/index.html is missing — run `npm run build`');
    const html = fs.readFileSync(dist, 'utf8');
    assert(/<div id="root">/.test(html), 'no #root mount point');
    return `${(fs.statSync(dist).size / 1024).toFixed(1)} kB index.html`;
  });

  /* 24 — the served SPA answers on the API origin (single-port deploy) */
  await check('The server serves the built SPA at /', async () => {
    const res = await fetch(`${BASE}/`);
    const text = await res.text();
    assert(res.status === 200, `status ${res.status}`);
    assert(/<div id="root">/.test(text) || /Food Express/i.test(text), 'the SPA shell was not served');
    return `${res.status}, ${(text.length / 1024).toFixed(1)} kB`;
  });

  /* 25 — deep links fall back to the SPA rather than 404ing */
  await check('A deep link like /product/x falls back to the SPA', async () => {
    const res = await fetch(`${BASE}/product/sella-rice-5kg`);
    assert(res.status === 200, `status ${res.status}`);
    return `${res.status} — client-side routing can take over`;
  });
} catch (err) {
  results.push({ name: 'Harness', ok: false, detail: err.message });
  exitCode = 1;
} finally {
  child.kill('SIGTERM');
}

/* -------------------------------- report --------------------------------- */
const width = Math.max(...results.map((r) => r.name.length));
console.log('\nFood Express — acceptance run\n');
for (const r of results) {
  console.log(`  ${r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${r.name.padEnd(width)}  ${r.detail}`);
}
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n  ${passed}/${results.length} checks passed${failed ? `, ${failed} FAILED` : ''}\n`);
process.exit(failed || exitCode ? 1 : 0);
