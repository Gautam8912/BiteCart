/**
 * Database connection + seed runner.
 *
 * `npm run seed` (or the postinstall hook) creates ./server/data/foodexpress.db
 * and fills it from the seed modules. It is idempotent: existing rows are left
 * alone unless --force is passed, so developer data survives a restart.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

import { SCHEMA } from './schema.js';
import { SETTINGS_SEED, CITIES_SEED, CATEGORIES_SEED, BRANDS_SEED, COUPONS_SEED, LOCALITIES_SEED, rupees } from '../seed/reference.js';
import { PRODUCTS_SEED } from '../seed/products.js';
import { RESTAURANTS_SEED } from '../seed/restaurants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
export const DB_PATH = process.env.FE_DB_PATH || path.join(DATA_DIR, 'foodexpress.db');

let db;
export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

/* ------------------------------ helpers ---------------------------------- */
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const tagsOf = (t) => (t || '').split(/\s+/).filter(Boolean);

/** Deterministic demo rating derived from the slug so the catalogue is stable across seeds. */
export function demoRating(seed, count) {
  const h = crypto.createHash('sha1').update(String(seed)).digest();
  return 3.4 + (h[0] % 15) / 10; // 3.4 – 4.8
}
export function demoRatingCount(seed, min = 40, span = 900) {
  const h = crypto.createHash('sha1').update('rc:' + String(seed)).digest();
  return min + (h.readUInt16BE(0) % span);
}

/* -------------------------------- seed ----------------------------------- */
export function seed({ force = false } = {}) {
  const d = getDb();
  d.exec(SCHEMA);

  const hasProducts = d.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0;
  if (hasProducts && !force) {
    return { skipped: true, reason: 'catalogue already seeded (use --force to reseed)' };
  }

  const tx = d.transaction(() => {
    if (force) {
      // Drop in dependency order so foreign keys never complain.
      const tables = ['audit_log','loyalty_ledger','saved_payment_methods','support_tickets',
        'notification_reads','notifications','order_events','order_items','orders',
        'coupon_redemptions','coupons','wishlist_items','cart_items','cities','menu_items',
        'restaurants','products','brands','categories','addresses','password_resets','users','settings'];
      tables.forEach((t) => d.exec(`DELETE FROM ${t}`));
      d.exec(`DELETE FROM sqlite_sequence`);
    }

    /* settings */
    const setSetting = d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(SETTINGS_SEED)) setSetting.run(k, String(v));

    /* users — seeded demo accounts. Passwords are bcrypt-hashed, never plaintext. */
    const insUser = d.prepare(`INSERT INTO users (name,email,mobile,password_hash,role,is_email_verified,is_mobile_verified,loyalty_points)
                               VALUES (@name,@email,@mobile,@hash,@role,@ev,@mv,@lp)`);
    const adminHash = bcrypt.hashSync(process.env.FE_DEMO_ADMIN_PASSWORD || 'Admin@12345', 10);
    const customerHash = bcrypt.hashSync(process.env.FE_DEMO_CUSTOMER_PASSWORD || 'Customer@12345', 10);
    insUser.run({ name: 'Food Express Admin', email: 'admin@foodexpress.example', mobile: null, hash: adminHash, role: 'admin', ev: 1, mv: 1, lp: 0 });
    insUser.run({ name: 'Demo Customer', email: 'demo@foodexpress.example', mobile: '9000000001', hash: customerHash, role: 'customer', ev: 1, mv: 0, lp: 120 });

    const demoUserId = d.prepare(`SELECT id FROM users WHERE email = 'demo@foodexpress.example'`).get().id;

    /* categories */
    const insCat = d.prepare(`INSERT INTO categories (slug,name,color,icon,tagline,is_food,is_active,sort_order)
                              VALUES (@slug,@name,@color,@icon,@tagline,@is_food,1,@sort_order)`);
    CATEGORIES_SEED.forEach(([slug, name, color, icon, tagline, sortOrder, isFood]) =>
      insCat.run({ slug, name, color, icon, tagline, is_food: isFood, sort_order: sortOrder }));

    /* brands */
    const insBrand = d.prepare('INSERT OR IGNORE INTO brands (name, slug, category_slug) VALUES (?, ?, ?)');
    for (const [cat, names] of Object.entries(BRANDS_SEED)) names.forEach((n) => insBrand.run(n, slugify(n), cat));

    /* products */
    const insProd = d.prepare(`INSERT INTO products
      (slug,name,brand,category_slug,description,specs,price_paise,mrp_paise,unit,weight,image_url,
       is_veg,is_active,stock,rating,rating_count,rating_is_demo,tags)
      VALUES (@slug,@name,@brand,@category_slug,@description,@specs,@price_paise,@mrp_paise,@unit,@weight,
              @image_url,@is_veg,1,@stock,@rating,@rating_count,1,@tags)`);

    const FOOD_CATS = new Set(['restaurants']);
    const VEG_CATS = new Set(['fruits-vegetables', 'groceries', 'dairy-bakery', 'stationery', 'household']);
    PRODUCTS_SEED.forEach(([category_slug, slug, name, brand, price, mrp, unit, weight, description, tags, stock]) => {
      insProd.run({
        slug, name, brand, category_slug, description,
        specs: JSON.stringify(defaultSpecs(category_slug, unit, weight, brand)),
        price_paise: rupees(price),
        mrp_paise: rupees(Math.max(mrp, price)),
        unit, weight,
        image_url: `/api/images/${slug}.svg`,
        is_veg: VEG_CATS.has(category_slug) || !/egg|chicken|fish|meat|mutton|prawn/.test(name.toLowerCase()) ? 1 : 0,
        stock,
        rating: demoRating(slug),
        rating_count: demoRatingCount(slug),
        tags,
      });
    });

    /* restaurants + menus */
    const insRes = d.prepare(`INSERT INTO restaurants
      (slug,name,cuisines,area,city,about,rating,rating_count,rating_is_demo,eta_min,eta_max,
       min_order_paise,cost_for_two_paise,delivery_fee_paise,is_veg,is_open,is_promoted,image_url,tags)
      VALUES (@slug,@name,@cuisines,@area,@city,@about,@rating,@rating_count,1,@eta_min,@eta_max,
              @min_order_paise,@cost_for_two_paise,0,@is_veg,1,@is_promoted,@image_url,@tags)`);
    const insMenu = d.prepare(`INSERT INTO menu_items
      (restaurant_id,slug,name,description,price_paise,mrp_paise,is_veg,category,variations,addons,
       is_best_seller,is_available,image_url)
      VALUES (@restaurant_id,@slug,@name,@description,@price_paise,@mrp_paise,@is_veg,@category,
              @variations,@addons,@is_best_seller,1,@image_url)`);

    RESTAURANTS_SEED.forEach((r) => {
      insRes.run({
        slug: r.slug, name: r.name, cuisines: r.cuisines, area: r.area, city: r.city, about: r.about,
        rating: r.rating, rating_count: r.ratingCount, eta_min: r.etaMin, eta_max: r.etaMax,
        min_order_paise: rupees(r.minOrder), cost_for_two_paise: rupees(r.costForTwo),
        is_veg: r.veg, is_promoted: r.promoted,
        image_url: `/api/images/restaurant-${r.slug}.svg`, tags: r.tags,
      });
      const restaurantId = d.prepare('SELECT id FROM restaurants WHERE slug = ?').get(r.slug).id;
      r.menu.forEach(([slug, name, price, mrp, isVeg, category, description, variations, addons, isBest]) => {
        insMenu.run({
          restaurant_id: restaurantId, slug, name, description,
          price_paise: rupees(price), mrp_paise: rupees(Math.max(mrp, price)),
          is_veg: isVeg, category,
          variations: JSON.stringify(variations || []),
          addons: JSON.stringify(addons || []),
          is_best_seller: isBest,
          image_url: `/api/images/dish-${slug}.svg`,
        });
      });
    });

    /* delivery zones */
    const insCity = d.prepare(`INSERT INTO cities
      (name,state,eta_min,eta_max,delivery_fee_paise,pincodes,localities,status,is_default_city)
      VALUES (@name,@state,@eta_min,@eta_max,@delivery_fee_paise,@pincodes,@localities,@status,@is_default_city)`);
    CITIES_SEED.forEach(([name, state, etaMin, etaMax, fee, pincodes, status, defaultLocality], i) => {
      insCity.run({
        name, state, eta_min: etaMin, eta_max: etaMax, delivery_fee_paise: fee,
        pincodes: JSON.stringify(pincodes),
        localities: JSON.stringify([defaultLocality, ...(LOCALITIES_SEED[name] || []).slice(0, 6)]),
        status, is_default_city: i === 0 ? 1 : 0,
      });
    });

    /* coupons — every seeded coupon is flagged as a demo promotion */
    const insCoupon = d.prepare(`INSERT INTO coupons
      (code,title,description,type,value,min_subtotal_paise,max_discount_paise,category_slug,stackable,
       usage_limit,per_user_limit,starts_at,expires_at,is_active,is_demo)
      VALUES (@code,@title,@description,@type,@value,@min_subtotal_paise,@max_discount_paise,@category_slug,
              @stackable,@usage_limit,@per_user_limit,datetime('now'),datetime('now',@expires_offset),@is_active,1)`);
    COUPONS_SEED.forEach(([code, title, type, value, minSub, maxDisc, stack, perUser, days, category, active]) => {
      insCoupon.run({
        code, title, description: describeCoupon(type, value, minSub, maxDisc, category),
        type, value, min_subtotal_paise: minSub, max_discount_paise: maxDisc, category_slug: category,
        stackable: stack, usage_limit: 500, per_user_limit: perUser,
        // Passed as a SQLite modifier, not a literal: binding the string
        // "datetime('now','+180 days')" would store that text and every expiry
        // check would silently pass.
        expires_offset: `${days >= 0 ? '+' : ''}${days} days`,
        is_active: active,
      });
    });

    /* a demo address so the checkout has something to select on first login */
    d.prepare(`INSERT INTO addresses (user_id,label,full_name,phone,line1,line2,city,state,pincode,landmark,is_default)
               VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
      .run(demoUserId, 'Home', 'Demo Customer', '9000000001', 'Flat 402, Sai Residency', 'Benz Circle Road', 'Vijayawada', 'Andhra Pradesh', '520010', 'Opposite Metro Mart');

    /* welcome notification for the demo customer */
    d.prepare(`INSERT INTO notifications (user_id,type,title,body,link) VALUES (?,?,?,?,?)`)
      .run(demoUserId, 'account', 'Welcome to Food Express',
        'Your demo account is ready. Explore 219 products and 12 restaurants — orders you place run in demo mode.', '/account');
  });

  tx();
  return { skipped: false };
}

function defaultSpecs(category, unit, weight, brand) {
  const base = { brand: brand || 'Food Express', unit, weight };
  switch (category) {
    case 'groceries':            return { ...base, shelfLife: '6 months from packing', storage: 'Store in a cool, dry place', origin: 'India' };
    case 'fruits-vegetables':    return { ...base, storage: 'Refrigerate after delivery', grade: 'A grade, hand sorted', origin: 'India' };
    case 'dairy-bakery':         return { ...base, shelfLife: 'See pack (chilled item)', storage: 'Keep refrigerated at 2–6 °C' };
    case 'snacks-beverages':     return { ...base, shelfLife: '9 months', storage: 'Store away from sunlight' };
    case 'personal-care':        return { ...base, shelfLife: '24 months', skinType: 'All skin types' };
    case 'beauty':               return { ...base, shelfLife: '24 months', crueltyFree: 'Not tested on animals' };
    case 'household':            return { ...base, shelfLife: '24 months', storage: 'Keep out of reach of children' };
    case 'electronics':          return { ...base, warranty: '6 months brand warranty', inBox: '1 unit + instruction card' };
    case 'stationery':           return { ...base, material: 'Paper / plastic as applicable' };
    case 'pet-supplies':         return { ...base, shelfLife: '12 months', storage: 'Store in a cool, dry place' };
    default:                     return base;
  }
}

function describeCoupon(type, value, minSub, maxDisc, category) {
  const min = minSub ? ` on orders above ₹${(minSub / 100).toFixed(0)}` : '';
  const cat = category ? ` on ${category}` : '';
  if (type === 'percent') return `${value}% off${cat}${min}${maxDisc ? `, up to ₹${(maxDisc / 100).toFixed(0)}` : ''}. Demo promotion.`;
  if (type === 'flat') return `Flat ₹${(value / 100).toFixed(0)} off${cat}${min}. Demo promotion.`;
  return `Delivery fee waived${min}. Demo promotion.`;
}

/* ------------------------- CLI entry point -------------------------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const force = process.argv.includes('--force');
  const result = seed({ force });
  const d = getDb();
  const counts = {
    products: d.prepare('SELECT COUNT(*) n FROM products').get().n,
    restaurants: d.prepare('SELECT COUNT(*) n FROM restaurants').get().n,
    menu_items: d.prepare('SELECT COUNT(*) n FROM menu_items').get().n,
    categories: d.prepare('SELECT COUNT(*) n FROM categories').get().n,
    cities: d.prepare('SELECT COUNT(*) n FROM cities').get().n,
    coupons: d.prepare('SELECT COUNT(*) n FROM coupons').get().n,
    users: d.prepare('SELECT COUNT(*) n FROM users').get().n,
  };
  console.log(force ? 'Reseeded' : (result.skipped ? 'Seed skipped' : 'Seeded'), counts);
  closeDb();
}
