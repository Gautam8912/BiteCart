/**
 * Integration tests against a live in-process server on a throwaway database.
 * Covers the acceptance criteria that must be enforced server-side:
 * auth, cart validation/merge, coupon enforcement, idempotent checkout,
 * order cancellation, and role-based admin access.
 *
 *   npm run test:api
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-test-'));
process.env.FE_DB_PATH = path.join(tmpDir, 'test.db');
process.env.FE_JWT_SECRET = 'integration-test-secret';
process.env.FE_DEMO_ADMIN_PASSWORD = 'Admin@12345';
process.env.FE_DEMO_CUSTOMER_PASSWORD = 'Customer@12345';
process.env.NODE_ENV = 'test';
// The suite legitimately signs in dozens of times; production keeps the default 25/15min.
process.env.FE_AUTH_RATE_LIMIT = '100000';

const { getDb, closeDb, seed } = await import('../server/db/index.js');
const { createApp } = await import('../server/index.js');

let server;
let baseUrl;
/** The cookie jar for whoever is "signed in" (or the current guest session). */
let jar = null;

const ADMIN = { identifier: 'admin@foodexpress.example', password: 'Admin@12345' };
const DEMO = { identifier: 'demo@foodexpress.example', password: 'Customer@12345' };

/* ------------------------------ helpers ---------------------------------- */
/** Token from the most recent successful sign-in, so tests can stay terse. */
let lastToken = null;

async function api(pathname, { method = 'GET', body, token, cookie, asGuest = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const useToken = asGuest ? null : (token ?? lastToken);
  if (useToken) headers.Authorization = `Bearer ${useToken}`;
  const useCookie = asGuest ? null : (cookie ?? jar);
  if (useCookie) headers.Cookie = useCookie;

  const res = await fetch(baseUrl + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON body */ }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) jar = setCookie.split(';')[0];
  return { status: res.status, data };
}

/** Sign in and keep that session as the ambient cookie jar. */
async function loginAs(creds) {
  jar = null;
  const res = await api('/api/auth/login', { method: 'POST', body: creds, asGuest: true });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  lastToken = res.data.token;
  return res.data.token;
}

/** Drop to an anonymous guest; the server hands out a fresh session cookie. */
async function guest() { jar = null; lastToken = null; }

/** Reset the cart for the given session (token) or the ambient guest jar. */
const clearCart = (token) => api('/api/cart', { method: 'DELETE', token });

const add = (itemId, quantity = 1, options = [], token) =>
  api('/api/cart/items', { method: 'POST', body: { itemId, quantity, options }, token });

const cart = (coupon, token) => api(`/api/cart${coupon ? `?coupon=${encodeURIComponent(coupon)}` : ''}`, { token });

const placeOrder = (body, token) => api('/api/checkout', { method: 'POST', body, token });

before(async () => {
  seed({ force: true });
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/* -------------------------------- config --------------------------------- */
describe('storefront configuration', () => {
  test('exposes the ₹150 threshold and the delivery fee', async () => {
    const { status, data } = await api('/api/config');
    assert.equal(status, 200);
    assert.equal(data.freeDeliveryThreshold, 15000);
    assert.equal(data.deliveryFee, 2900);
    assert.equal(data.demoMode, true);
    assert.equal(data.couponsAreDemo, true);
  });

  test('seeds at least 120 retail products', async () => {
    const { data } = await api('/api/products?limit=500');
    assert.ok(data.total >= 120, `only ${data.total} products`);
  });

  test('seeds 11 cities', async () => {
    const { data } = await api('/api/location/cities');
    assert.equal(data.items.length, 11);
    assert.ok(data.items.find((c) => c.name === 'Vijayawada'));
  });
});

/* ---------------------------------- auth ---------------------------------- */
describe('authentication', () => {
  test('rejects wrong credentials with a generic message', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST', body: { identifier: DEMO.identifier, password: 'wrong-password' },
    });
    assert.equal(status, 401);
    assert.equal(data.error, 'Incorrect credentials. Please check and try again.');
  });

  test('signs in with a mobile number as well as an email', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST', body: { identifier: '9000000001', password: DEMO.password },
    });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.user.mobile, '9000000001');
  });

  test('never returns the password hash', async () => {
    const token = await loginAs(DEMO);
    const { data } = await api('/api/auth/me', { token });
    assert.ok(!('passwordHash' in data.user), 'hash leaked');
    assert.ok(!('password_hash' in data.user), 'hash leaked');
    assert.equal(data.user.email, DEMO.identifier);
  });

  test('stores passwords as bcrypt hashes, never plaintext', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Hash Check', email: 'hashcheck@example.com', mobile: '9000000077', password: 'Secret@12345', acceptTerms: true },
    });
    assert.equal(status, 201, JSON.stringify(data));
    const row = getDb().prepare('SELECT password_hash FROM users WHERE email = ?').get('hashcheck@example.com');
    assert.match(row.password_hash, /^\$2[aby]\$/, 'not a bcrypt hash');
    assert.ok(!row.password_hash.includes('Secret@12345'));
  });

  test('rejects duplicate email and mobile registration', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Dupe', email: DEMO.identifier, mobile: '9000000099', password: 'Secret@12345', acceptTerms: true },
    });
    assert.equal(status, 409);
    assert.match(data.error, /already exists/);

    const { status: s2, data: d2 } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Dupe Mobile', email: `mobile${Date.now()}@example.com`, mobile: '9000000001', password: 'Secret@12345', acceptTerms: true },
    });
    assert.equal(s2, 409);
    assert.match(d2.error, /mobile/i);
  });

  test('rejects a weak password and missing terms', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Weak', email: 'weak@example.com', mobile: '9000000088', password: 'short', acceptTerms: true },
    });
    assert.equal(status, 422);

    const { status: s2, data: d2 } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'No Terms', email: 'noterms@example.com', mobile: '9000000089', password: 'Secret@12345', acceptTerms: false },
    });
    assert.equal(s2, 422);
    assert.match(d2.error, /terms/i);
  });

  test('sign-out clears the session', async () => {
    const token = await loginAs(DEMO);
    const { status } = await api('/api/auth/logout', { method: 'POST', token });
    assert.equal(status, 200);
  });

  test('a forgotten-password request always succeeds but issues no real email', async () => {
    const { status, data } = await api('/api/auth/forgot-password', { method: 'POST', body: { email: DEMO.identifier } });
    assert.equal(status, 200);
    assert.ok(data.demoResetToken, 'no demo token returned in dev');

    // An unknown address must not leak whether the account exists.
    const unknown = await api('/api/auth/forgot-password', { method: 'POST', body: { email: 'nobody@example.com' } });
    assert.equal(unknown.status, 200);
  });

  test('a reset token rotates the password and is single-use', async () => {
    await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Reset Me', email: 'resetme@example.com', mobile: '9000000091', password: 'OldPass@123', acceptTerms: true },
    });
    const fp = await api('/api/auth/forgot-password', { method: 'POST', body: { email: 'resetme@example.com' } });
    const token = fp.data.demoResetToken;

    const first = await api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'BrandNew@456' } });
    assert.equal(first.status, 200, JSON.stringify(first.data));

    const second = await api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'AnotherOne@789' } });
    assert.equal(second.status, 422, 'a used token must not work twice');

    const login = await api('/api/auth/login', { method: 'POST', body: { identifier: 'resetme@example.com', password: 'BrandNew@456' } });
    assert.equal(login.status, 200);
  });

  test('the unconfigured Google route fails loudly instead of pretending', async () => {
    const { status, data } = await api('/api/auth/google', { method: 'POST', body: {} });
    assert.equal(status, 501);
    assert.equal(data.code, 'PROVIDER_NOT_CONFIGURED');
  });
});

/* --------------------------------- cart ----------------------------------- */
describe('cart validation and pricing', () => {
  test('an out-of-stock item cannot be added', async () => {
    await guest();
    const oos = getDb().prepare('SELECT id, slug, stock FROM products WHERE stock = 0 LIMIT 1').get();
    assert.ok(oos, 'the seed should contain an out-of-stock product');
    const { status, data } = await add(`p:${oos.id}`, 1);
    assert.equal(status, 409);
    assert.match(data.error, /out of stock/i);
  });

  test('an over-large quantity is clamped to the available stock', async () => {
    await guest();
    await clearCart();
    const p = getDb().prepare('SELECT id, slug, stock FROM products WHERE stock > 0 ORDER BY stock ASC LIMIT 1').get();
    const { status, data } = await add(`p:${p.id}`, p.stock + 50);
    assert.equal(status, 201);
    const line = data.cart.items.find((i) => i.itemId === `p:${p.id}`);
    assert.equal(line.quantity, p.stock, 'the line exceeded available stock');
  });

  test('a client-supplied price is ignored; the server computes it', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug, price_paise FROM products WHERE stock > 10 LIMIT 1').get();
    const { data } = await add(`p:${row.id}`, 1);
    const line = data.cart.items.find((i) => i.itemId === `p:${row.id}`);
    assert.equal(line.pricePaise, row.price_paise, 'the server trusted a client price');
  });

  test('adding the same product again increments quantity instead of duplicating', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 1);
    const { data } = await add(`p:${row.id}`, 1);
    const lines = data.cart.items.filter((i) => i.itemId === `p:${row.id}`);
    assert.equal(lines.length, 1, 'a duplicate row was created');
    assert.equal(lines[0].quantity, 2);
  });

  test('setting quantity to zero removes the line', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 2);
    const { data } = await api('/api/cart/items', { method: 'PATCH', body: { itemId: `p:${row.id}`, quantity: 0 } });
    assert.equal(data.cart.items.filter((i) => i.itemId === `p:${row.id}`).length, 0);
  });

  test('a negative quantity is refused', async () => {
    await guest();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 10 LIMIT 1').get();
    const { status } = await api('/api/cart/items', { method: 'PATCH', body: { itemId: `p:${row.id}`, quantity: -5 } });
    assert.equal(status, 422);
  });

  test('the bill exposes the threshold and the remaining amount, and reconciles', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug, price_paise FROM products WHERE price_paise BETWEEN 2000 AND 5000 AND stock > 10 LIMIT 1').get();
    const { data } = await add(`p:${row.id}`, 1);
    assert.equal(data.cart.bill.delivery.threshold, 15000);
    assert.equal(data.cart.bill.delivery.remaining, Math.max(0, 15000 - row.price_paise));
    const b = data.cart.bill;
    assert.equal(b.subtotalPaise + b.delivery.feePaise + b.handlingFeePaise + b.taxPaise, b.totalPaise, 'the bill does not reconcile');
  });

  test('crossing ₹150 makes delivery free', async () => {
    await guest();
    await clearCart();
    const rows = getDb().prepare('SELECT id, slug, price_paise FROM products WHERE price_paise BETWEEN 8000 AND 12000 AND stock > 10 LIMIT 2').all();
    await add(`p:${rows[0].id}`, 1);
    const { data } = await add(`p:${rows[1].id}`, 1);
    assert.ok(data.cart.bill.merchandisePaise >= 15000, 'fixture should exceed the threshold');
    assert.equal(data.cart.bill.delivery.unlocked, true);
    assert.equal(data.cart.bill.delivery.platformFeePaise, 0);
  });

  test('an invalid coupon code is rejected and a valid one applies', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE price_paise > 60000 AND stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 1);

    const bad = await cart('NOPE123');
    assert.match(bad.data.couponLoadError, /not found/i);
    assert.equal(bad.data.bill.discountPaise, 0);

    const good = await cart('FIRSTORDER');
    assert.ok(good.data.bill.discountPaise > 0, 'the coupon did not discount');
    assert.equal(good.data.bill.couponApplied?.code, 'FIRSTORDER');
  });

  test('a coupon below its minimum spend is refused', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE price_paise < 30000 AND stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 1);
    const { data } = await cart('FIRSTORDER');
    assert.equal(data.bill.discountPaise, 0);
    assert.match(data.bill.couponError, /₹|minimum/i);
  });

  test('a disabled coupon is refused even though it exists', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE price_paise > 60000 AND stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 1);
    const { data } = await cart('EXPIRED100');
    assert.equal(data.bill.discountPaise, 0);
    assert.match(data.bill.couponError, /not active/i);
  });

  test('an expired coupon is refused', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug FROM products WHERE price_paise > 60000 AND stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 1);
    const { data } = await cart('DIWALI25');
    assert.equal(data.bill.discountPaise, 0);
    assert.match(data.bill.couponError, /expired/i);
  });

  test('save for later moves a line out of the bill but keeps it in the cart', async () => {
    await guest();
    await clearCart();
    const row = getDb().prepare('SELECT id, slug, price_paise FROM products WHERE stock > 10 LIMIT 1').get();
    await add(`p:${row.id}`, 1);
    const saved = await api('/api/cart/items/save', { method: 'POST', body: { itemId: `p:${row.id}`, options: [] } });
    assert.equal(saved.data.cart.bill.itemCount, 0, 'a saved line was still billed');
    assert.ok(saved.data.cart.saved.some((i) => i.item_id === `p:${row.id}`));
    await api('/api/cart/items/unsave', { method: 'POST', body: { itemId: `p:${row.id}`, options: [] } });
  });
});

/* --------------------------- one restaurant per cart ---------------------- */
describe('restaurant ordering rules', () => {
  let restaurants = [];
  before(async () => {
    const { data } = await api('/api/restaurants?limit=50');
    restaurants = data.items;
  });

  test('a second restaurant in the same cart is refused', async () => {
    await guest();
    await clearCart();
    const a = restaurants[0];
    const b = restaurants.find((r) => r.id !== a.id);
    const menuA = (await api(`/api/restaurants/${a.slug}`)).data;
    await add(`r:${a.id}:${menuA.menu[0].items[0].id}`, 1);

    const menuB = (await api(`/api/restaurants/${b.slug}`)).data;
    const { status, data } = await add(`r:${b.id}:${menuB.menu[0].items[0].id}`, 1);
    assert.equal(status, 409);
    assert.ok(data.details?.restaurant, 'the conflicting restaurant should be named');
    assert.equal(data.details.restaurant.name, a.name);
  });

  test('restaurant items are taxed at the restaurant GST rate', async () => {
    await guest();
    await clearCart();
    const a = restaurants[0];
    const menu = (await api(`/api/restaurants/${a.slug}`)).data;
    const { data } = await add(`r:${a.id}:${menu.menu[0].items[0].id}`, 1);
    assert.equal(data.cart.bill.taxRate, 5);
  });

  test('the same dish added twice increments one line', async () => {
    await guest();
    await clearCart();
    const a = restaurants[0];
    const menu = (await api(`/api/restaurants/${a.slug}`)).data;
    const dish = menu.menu[0].items[0];
    await add(`r:${a.id}:${dish.id}`, 1);
    const { data } = await add(`r:${a.id}:${dish.id}`, 1);
    const lines = data.cart.items.filter((i) => i.itemId === `r:${a.id}:${dish.id}`);
    assert.equal(lines.length, 1, 'a duplicate line was created');
    assert.equal(lines[0].quantity, 2);
  });

  test('a third restaurant is still refused after several adds from the first', async () => {
    await guest();
    await clearCart();
    const a = restaurants[0];
    const c = restaurants.find((r) => r.id !== a.id && r.id !== restaurants[1].id) || restaurants[1];
    const menuA = (await api(`/api/restaurants/${a.slug}`)).data;
    await add(`r:${a.id}:${menuA.menu[0].items[0].id}`, 2);
    await add(`r:${a.id}:${menuA.menu[0].items[1].id}`, 1);
    const menuC = (await api(`/api/restaurants/${c.slug}`)).data;
    const { status, data } = await add(`r:${c.id}:${menuC.menu[0].items[0].id}`, 1);
    assert.equal(status, 409);
    assert.equal(data.details.restaurant.name, a.name);
  });
});

/* --------------------------- guest cart merge ----------------------------- */
describe('guest to signed-in cart merge', () => {
  test('guest items carry over into the account cart on sign-in', async () => {
    const guestCookie = 'fe_guest=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; Path=/';
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 20 LIMIT 1').get();

    jar = guestCookie;
    await clearCart();
    const added = await add(`p:${row.id}`, 3);
    assert.equal(added.status, 201, JSON.stringify(added.data));

    // Sign in with the same guest cookie: the server merges and keeps the session.
    jar = guestCookie;
    const login = await api('/api/auth/login', { method: 'POST', cookie: guestCookie, body: DEMO });
    assert.equal(login.status, 200);
    assert.ok(login.data.cartMergedFromGuest >= 1, 'the guest cart was not merged');

    const c = await cart();
    const line = c.data.items.find((i) => i.itemId === `p:${row.id}`);
    assert.ok(line, 'the guest line is missing after merge');
    assert.equal(line.quantity, 3);
  });

  test('a shared item keeps the larger quantity, never the sum', async () => {
    const guestCookie = 'fe_guest=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; Path=/';
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 20 LIMIT 1').get();

    // Sign the user in first and give them 2 of the item.
    const token = await loginAs(DEMO);
    await clearCart();
    await add(`p:${row.id}`, 2);

    // Now put 5 of the same item in a guest cart under that guest id.
    jar = guestCookie;
    await clearCart();
    await add(`p:${row.id}`, 5);

    // Merge the guest cart into the account.
    const merged = await api('/api/cart/merge', { method: 'POST', token, body: { guestSessionId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } });
    assert.equal(merged.status, 200, JSON.stringify(merged.data));
    const line = merged.data.cart.items.find((i) => i.itemId === `p:${row.id}`);
    assert.equal(line.quantity, 5, 'expected MAX(guest, account), not the sum');
    assert.notEqual(line.quantity, 7);
  });

  test('an explicit merge endpoint rejects a malformed guest id', async () => {
    const token = await loginAs(DEMO);
    const { status } = await api('/api/cart/merge', { method: 'POST', token, body: { guestSessionId: 'not-a-real-id' } });
    assert.equal(status, 422);
  });
});

/* -------------------------------- checkout -------------------------------- */
describe('checkout integrity', () => {
  let addrId;
  let token;

  before(async () => {
    token = await loginAs(DEMO);
    const { data } = await api('/api/account/addresses', { token });
    addrId = data.items[0]?.id;
    assert.ok(addrId, 'the demo user should have a seeded address');
  });

  const fillCart = async (qty = 1) => {
    await clearCart(token);
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 60 LIMIT 1').get();
    await add(`p:${row.id}`, qty, [], token);
    return row;
  };

  test('an empty cart cannot be ordered', async () => {
    await clearCart(token);
    const { status } = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: 'empty-cart' }, token);
    assert.ok(status === 409 || status === 422, `expected 409/422, got ${status}`);
  });

  test('checkout requires an authenticated user', async () => {
    await guest();
    const { status } = await api('/api/checkout', { method: 'POST', asGuest: true, body: { addressId: 1, paymentMethod: 'cod', idempotencyKey: 'anon' } });
    assert.equal(status, 401);
  });

  test('an unknown payment method is refused', async () => {
    await loginAs(DEMO);
    await fillCart(2);
    const { status, data } = await placeOrder({ addressId: addrId, paymentMethod: 'credit_card', idempotencyKey: 'bad-method' }, token);
    assert.equal(status, 422);
    assert.match(data.error, /payment method/i);
  });

  test('replaying the same idempotency key returns the original order, not a second one', async () => {
    await loginAs(DEMO);
    await fillCart(2);
    const key = `replay-${Date.now()}`;

    const first = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: key }, token);
    assert.equal(first.status, 201, JSON.stringify(first.data));

    const second = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: key }, token);
    assert.equal(second.status, 200);
    assert.equal(second.data.duplicate, true);
    assert.equal(second.data.order.orderNumber, first.data.order.orderNumber);

    const count = getDb().prepare('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?').get(key).n;
    assert.equal(count, 1, 'a duplicate order row was created');
  });

  test('stock is decremented by the ordered quantity', async () => {
    await loginAs(DEMO);
    await clearCart(token);
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 60 LIMIT 1').get();
    const before = getDb().prepare('SELECT stock FROM products WHERE slug = ?').get(row.slug).stock;
    await add(`p:${row.id}`, 2, [], token);
    const placed = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `stock-${Date.now()}` }, token);
    assert.equal(placed.status, 201);
    const after = getDb().prepare('SELECT stock FROM products WHERE slug = ?').get(row.slug).stock;
    assert.equal(after, before - 2);
  });

  test('a COD payment is recorded as pending, never as paid', async () => {
    await loginAs(DEMO);
    await fillCart(1);
    const { data } = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `cod-${Date.now()}` }, token);
    assert.equal(data.order.paymentStatus, 'pending');
    assert.equal(data.order.paymentMode, 'cod');
  });

  test('a demo payment is clearly labelled simulated, not real', async () => {
    await loginAs(DEMO);
    await fillCart(1);
    const { data } = await placeOrder({
      addressId: addrId, paymentMethod: 'demo_card', idempotencyKey: `card-${Date.now()}`,
      paymentDetails: { cardNumber: '4242424242424242', name: 'Test', expiry: '12/30', cvv: '123' },
    }, token);
    assert.equal(data.order.paymentStatus, 'paid-demo');
    assert.equal(data.order.paymentMode, 'demo');
    assert.equal(data.order.paymentIsDemo, true);
  });

  test('the order bill matches what the cart previewed', async () => {
    await loginAs(DEMO);
    await fillCart(2);
    const previewed = (await cart(null, token)).data.bill;
    const { data } = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `match-${Date.now()}` }, token);
    assert.equal(data.order.total, previewed.totalPaise);
    assert.equal(data.order.subtotal, previewed.subtotalPaise);
    assert.equal(data.order.deliveryFee, previewed.delivery.feePaise);
  });

  test('loyalty points are awarded on a placed order', async () => {
    await loginAs(DEMO);
    const before = (await api('/api/auth/me')).data.user.loyaltyPoints;
    await fillCart(1);
    await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `points-${Date.now()}` }, token);
    const after = (await api('/api/auth/me')).data.user.loyaltyPoints;
    assert.ok(after > before, `points did not increase (${before} → ${after})`);
  });

  test('checkout is blocked in a city where delivery is not live', async () => {
    const t = await loginAs(DEMO);
    const added = await api('/api/account/addresses', {
      method: 'POST', token: t,
      body: { label: 'Other', fullName: 'Test', phone: '9000000001', line1: '12 Test Road', city: 'Patna', state: 'Bihar', pincode: '800001' },
    });
    assert.equal(added.status, 201, JSON.stringify(added.data));
    await fillCart(1);
    const { status, data } = await placeOrder({ addressId: added.data.address.id, paymentMethod: 'cod', idempotencyKey: `zone-${Date.now()}` }, token);
    assert.equal(status, 422);
    assert.match(data.error, /coming soon/i);
  });
});

/* --------------------------------- orders --------------------------------- */
describe('order lifecycle', () => {
  let orderNumber;
  let token;

  before(async () => {
    token = await loginAs(DEMO);
    const addrId = (await api('/api/account/addresses', { token })).data.items[0].id;
    await clearCart(token);
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 60 LIMIT 1').get();
    await add(`p:${row.id}`, 1, [], token);
    const { data } = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `cancel-${Date.now()}` }, token);
    orderNumber = data.order.orderNumber;
  });

  test('a customer can read their own orders', async () => {
    const { data } = await api('/api/checkout', { token });
    assert.ok(data.items.length > 0);
    assert.ok(data.items.some((o) => o.orderNumber === orderNumber));
  });

  test('another user cannot read that order', async () => {
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Nosy', email: `nosy${Date.now()}@example.com`,
        mobile: `9000${Date.now().toString().slice(-6)}`, password: 'Secret@12345', acceptTerms: true,
      },
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.data));
    const { status } = await api(`/api/checkout/${orderNumber}`, { token: reg.data.token });
    assert.equal(status, 404, 'cross-user order leak');
  });

  test('an order detail page exposes the tracker, items and bill', async () => {
    const { data } = await api(`/api/checkout/${orderNumber}`, { token });
    assert.equal(data.order.orderNumber, orderNumber);
    assert.ok(data.order.items.length > 0);
    assert.ok(data.order.statusFlow.length >= 5, 'expected a Placed → Delivered flow');
    assert.equal(data.order.statusFlow[0], 'placed');
    assert.equal(data.order.statusFlow.at(-1), 'delivered');
    assert.ok(data.order.address.line1);
  });

  test('a cancellable order can be cancelled and restocks the item', async () => {
    // order_items.item_id is TEXT ('p:217'), so strip the prefix before joining.
    const stockOf = () => getDb().prepare(
      `SELECT p.stock FROM products p
         JOIN order_items oi ON CAST(SUBSTR(oi.item_id, 3) AS INTEGER) = p.id
         JOIN orders o ON o.id = oi.order_id
        WHERE o.order_number = ? AND oi.item_kind = 'product'`,
    ).get(orderNumber).stock;
    const before = stockOf();
    const { status, data } = await api(`/api/checkout/${orderNumber}/cancel`, { method: 'POST', token, body: { reason: 'Changed my mind' } });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.order.status, 'cancelled');
    assert.equal(stockOf(), before + 1, 'stock was not restored');
  });

  test('a cancelled order cannot be cancelled twice', async () => {
    const { status } = await api(`/api/checkout/${orderNumber}/cancel`, { method: 'POST', token, body: { reason: 'again' } });
    assert.equal(status, 409);
  });

  test('a delivered order cannot be cancelled', async () => {
    const adminToken = await loginAs(ADMIN);
    const userToken = await loginAs(DEMO);
    const addrId = (await api('/api/account/addresses', { token: userToken })).data.items[0].id;
    await clearCart(token);
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 60 LIMIT 1').get();
    await add(`p:${row.id}`, 1, [], token);
    const placed = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `delivered-${Date.now()}` }, userToken);
    const num = placed.data.order.orderNumber;

    for (const s of ['confirmed', 'packing', 'out_for_delivery', 'delivered']) {
      const r = await api(`/api/admin/orders/${num}/status`, { method: 'PUT', token: adminToken, body: { status: s, note: 'test' } });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    const { status } = await api(`/api/checkout/${num}/cancel`, { method: 'POST', token: userToken, body: { reason: 'too late' } });
    assert.equal(status, 409);
  });

  test('reorder puts the original items back in the cart', async () => {
    const userToken = await loginAs(DEMO);
    await clearCart(userToken);
    const { status, data } = await api(`/api/checkout/${orderNumber}/reorder`, { method: 'POST', token: userToken });
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(data.cart.items.length > 0, 'the cart is empty after reorder');
  });
});

/* ------------------------- authorization (server-side) -------------------- */
describe('role-based access control', () => {
  test('an anonymous caller cannot read the admin dashboard', async () => {
    const { status } = await api('/api/admin/stats', { asGuest: true });
    assert.equal(status, 401);
  });

  test('a signed-in customer cannot read the admin dashboard', async () => {
    const token = await loginAs(DEMO);
    const { status, data } = await api('/api/admin/stats', { token });
    assert.equal(status, 403);
    assert.equal(data.code, 'FORBIDDEN');
  });

  test('a customer cannot change a price through the admin API', async () => {
    const token = await loginAs(DEMO);
    const row = getDb().prepare('SELECT id, price_paise FROM products LIMIT 1').get();
    const { status } = await api(`/api/admin/products/${row.id}`, { method: 'PUT', token, body: { price: 1 } });
    assert.equal(status, 403);
    assert.equal(getDb().prepare('SELECT price_paise FROM products WHERE id = ?').get(row.id).price_paise, row.price_paise, 'the price was modified');
  });

  test('a customer cannot deactivate a coupon', async () => {
    const token = await loginAs(DEMO);
    const c = getDb().prepare("SELECT id FROM coupons WHERE code = 'SAVE10'").get();
    const { status } = await api(`/api/admin/coupons/${c.id}`, { method: 'PUT', token, body: { isActive: false } });
    assert.equal(status, 403);
    assert.equal(getDb().prepare('SELECT is_active FROM coupons WHERE id = ?').get(c.id).is_active, 1);
  });

  test('a customer cannot change a delivery setting', async () => {
    const token = await loginAs(DEMO);
    const { status } = await api('/api/admin/settings', { method: 'PUT', token, body: { free_delivery_threshold_paise: 1 } });
    assert.equal(status, 403);
  });

  test('an admin can change a setting and it takes effect immediately', async () => {
    const adminToken = await loginAs(ADMIN);
    const { status, data } = await api('/api/admin/settings', {
      method: 'PUT', token: adminToken, body: { free_delivery_threshold_paise: 29900, delivery_fee_paise: 4900 },
    });
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(data.changed.includes('free_delivery_threshold_paise'));

    await guest();
    const cfg = await api('/api/config');
    assert.equal(cfg.data.freeDeliveryThreshold, 29900);
    assert.equal(cfg.data.deliveryFee, 4900);

    await api('/api/admin/settings', {
      method: 'PUT', token: adminToken, body: { free_delivery_threshold_paise: 15000, delivery_fee_paise: 2900 },
    });
    assert.equal((await api('/api/config')).data.freeDeliveryThreshold, 15000);
  });

  test('an admin edit is written to the audit log', async () => {
    const adminToken = await loginAs(ADMIN);
    const before = getDb().prepare('SELECT COUNT(*) AS n FROM audit_log').get().n;
    await api('/api/admin/settings', { method: 'PUT', token: adminToken, body: { handling_fee_paise: 500 } });
    assert.ok(getDb().prepare('SELECT COUNT(*) AS n FROM audit_log').get().n > before, 'no audit entry written');
    await api('/api/admin/settings', { method: 'PUT', token: adminToken, body: { handling_fee_paise: 0 } });
  });
});

/* ------------------------- catalog, search, location ---------------------- */
describe('catalog, search and location', () => {
  test('a typo still finds the product', async () => {
    await guest();
    const { data } = await api('/api/search?q=tamato');
    assert.ok(data.items.length > 0, 'no fuzzy match for "tamato"');
    assert.ok(data.items.some((r) => r.name.toLowerCase().includes('tomato')));
  });

  test('search matches brand and category, not just the name', async () => {
    // Original branding: the seed uses invented brands, so pick one that exists.
    const brand = getDb().prepare('SELECT brand FROM products WHERE brand IS NOT NULL GROUP BY brand ORDER BY COUNT(*) DESC LIMIT 1').get().brand;
    const { data } = await api(`/api/search?q=${encodeURIComponent(brand)}`);
    assert.ok(data.items.length > 0, `a brand search for "${brand}" returned nothing`);
    assert.ok(data.items.some((i) => i.brand === brand), 'no result carried the searched brand');
  });

  test('a price filter actually filters', async () => {
    const { data } = await api('/api/products?maxPrice=50&pageSize=60');
    assert.ok(data.items.length > 0, 'no products under ₹50');
    assert.ok(data.items.every((r) => r.price <= 5000), 'a product above the max price slipped through');
  });

  test('an in-stock filter excludes zero-stock products', async () => {
    const { data } = await api('/api/products?inStock=true&pageSize=60');
    assert.ok(data.items.length > 0);
    assert.ok(data.items.every((p) => p.stock > 0), 'an out-of-stock product slipped through');

    const out = await api('/api/products?inStock=false&pageSize=60');
    assert.ok(out.data.items.every((p) => p.stock === 0));
  });

  test('a discount filter only returns marked-down products', async () => {
    const { data } = await api('/api/products?discount=true&pageSize=60');
    assert.ok(data.items.length > 0);
    assert.ok(data.items.every((p) => p.mrp > p.price));
  });

  test('home page sections return real products', async () => {
    const { data } = await api('/api/products/sections');
    assert.ok(Array.isArray(data), 'sections should be an array');
    const byKey = Object.fromEntries(data.map((sec) => [sec.key, sec.items]));
    for (const key of ['best-sellers', 'popular-near-you', 'under-99', 'todays-deals', 'daily-essentials']) {
      assert.ok(byKey[key]?.length > 0, `section ${key} is empty`);
    }
    assert.ok(byKey['under-99'].every((prod) => prod.price <= 9900), 'under-99 contains a product over ₹99');
    assert.ok(byKey['fruits-vegetables'].every((prod) => prod.categorySlug === 'fruits-vegetables'));
  });

  test('a product detail page has a full model and demo-labelled ratings', async () => {
    const row = getDb().prepare('SELECT slug FROM products LIMIT 1').get();
    const { data } = await api(`/api/products/${row.slug}`);
    assert.ok(data.product.name);
    assert.ok(data.product.description);
    assert.ok(data.product.specs && Object.keys(data.product.specs).length > 0, 'specs missing');
    assert.ok(data.related.length > 0, 'no related products');
    assert.ok(data.boughtTogether.length > 0, 'no frequently-bought-together products');
    assert.equal(data.product.ratingIsDemo, true, 'seeded ratings must be labelled demo');
    assert.ok(data.product.discountPercent >= 0);
  });

  test('a zone check reports a coming-soon city honestly', async () => {
    const patna = await api('/api/location/check?pincode=800001');
    assert.equal(patna.data.city.name, 'Patna');
    assert.equal(patna.data.city.status, 'coming-soon');
    assert.equal(patna.data.serviceable, false);
    assert.match(patna.data.reason, /coming soon|not operational/i);

    const vijayawada = await api('/api/location/check?pincode=520010');
    assert.equal(vijayawada.data.city.name, 'Vijayawada');
    assert.equal(vijayawada.data.serviceable, true);

    const unknown = await api('/api/location/check?pincode=999999');
    assert.equal(unknown.data.serviceable, false);
    assert.equal(unknown.data.city, null);
  });
});

/* ------------------------------- wishlist --------------------------------- */
describe('wishlist', () => {
  test('a wishlist is private to its owner', async () => {
    const token = await loginAs(DEMO);
    const row = getDb().prepare('SELECT id, slug FROM products WHERE is_active = 1 LIMIT 1').get();
    const added = await api('/api/account/wishlist', { method: 'POST', token, body: { productId: row.id } });
    assert.equal(added.status, 201, JSON.stringify(added.data));

    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Other', email: `other${Date.now()}@example.com`,
        mobile: `9001${Date.now().toString().slice(-6)}`, password: 'Secret@12345', acceptTerms: true,
      },
    });
    assert.equal(reg.status, 201);
    const mine = await api('/api/account/wishlist', { token: reg.data.token });
    assert.equal(mine.data.items.length, 0, 'the wishlist leaked across users');
  });
});

/* ---------------------------- notifications ------------------------------- */
describe('notifications', () => {
  test('an order event creates a notification for its owner', async () => {
    const token = await loginAs(DEMO);
    const addrId = (await api('/api/account/addresses', { token })).data.items[0].id;
    await clearCart(token);
    const row = getDb().prepare('SELECT id, slug FROM products WHERE stock > 60 LIMIT 1').get();
    await add(`p:${row.id}`, 1, [], token);
    const placed = await placeOrder({ addressId: addrId, paymentMethod: 'cod', idempotencyKey: `notif-${Date.now()}` }, token);
    const { data } = await api('/api/notifications?limit=20', { token });
    assert.ok(data.items.some((n) => n.title.includes(placed.data.order.orderNumber) || n.body?.includes(placed.data.order.orderNumber)));
  });
});
