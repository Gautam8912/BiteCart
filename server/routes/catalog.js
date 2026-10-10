/**
 * Catalogue API: categories, products, search, restaurants and their menus.
 * All reads are paginated so the catalogue can grow without re-fetching everything.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { paiseToRupees } from '../utils/helpers.js';

const router = express.Router();

const SORTS = {
  popularity: 'p.rating * LOG2(MAX(p.rating_count,2)) DESC, p.rating_count DESC',
  'price-asc': 'p.price_paise ASC',
  'price-desc': 'p.price_paise DESC',
  rating: 'p.rating DESC, p.rating_count DESC',
  newest: 'p.id DESC',
  discount: '(p.mrp_paise - p.price_paise) * 1.0 / MAX(p.mrp_paise, 1) DESC',
};
// SQLite has no LOG2; use a portable popularity ordering instead.
SORTS.popularity = 'p.rating DESC, p.rating_count DESC';

const productShape = (p) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  categorySlug: p.category_slug,
  categoryName: p.category_name,
  categoryColor: p.category_color,
  description: p.description,
  specs: safeJson(p.specs),
  price: p.price_paise,
  mrp: p.mrp_paise,
  priceInr: paiseToRupees(p.price_paise),
  mrpInr: paiseToRupees(p.mrp_paise),
  discountPercent: p.mrp_paise > 0 ? Math.round(((p.mrp_paise - p.price_paise) / p.mrp_paise) * 100) : 0,
  unit: p.unit,
  weight: p.weight,
  image: p.image_url,
  inStock: p.stock > 0,
  stock: p.stock,
  rating: Number(p.rating).toFixed(1),
  ratingCount: p.rating_count,
  ratingIsDemo: !!p.rating_is_demo,
  tags: (p.tags || '').split(/\s+/).filter(Boolean),
});

function safeJson(v) {
  try { return JSON.parse(v || 'null'); } catch { return null; }
}

/* ------------------------------ categories ------------------------------- */
router.get('/categories', (_req, res) => {
  const d = getDb();
  const cats = d.prepare(`
    SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_slug = c.slug AND p.is_active = 1
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order ASC`).all();
  res.json(cats.map((c) => ({
    slug: c.slug, name: c.name, color: c.color, icon: c.icon, tagline: c.tagline,
    isFood: !!c.is_food, productCount: c.product_count,
  })));
});

/* -------------------------------- products ------------------------------- */
router.get('/products', (req, res) => {
  const d = getDb();
  const where = ['p.is_active = 1'];
  const params = {};

  if (req.query.category) { where.push('p.category_slug = @category'); params.category = req.query.category; }
  if (Array.isArray(req.query.categories) && req.query.categories.length) {
    where.push(`p.category_slug IN (${req.query.categories.map((c, i) => `@c${i}`).join(',')})`);
    req.query.categories.forEach((c, i) => { params[`c${i}`] = c; });
  }
  if (req.query.brand) { where.push('p.brand = @brand'); params.brand = req.query.brand; }
  if (req.query.minPrice) { where.push('p.price_paise >= @minPrice'); params.minPrice = Math.round(Number(req.query.minPrice) * 100) || 0; }
  if (req.query.maxPrice) { where.push('p.price_paise <= @maxPrice'); params.maxPrice = Math.round(Number(req.query.maxPrice) * 100) || 0; }
  if (req.query.inStock === 'true') where.push('p.stock > 0');
  if (req.query.inStock === 'false') where.push('p.stock = 0');
  if (req.query.discount === 'true') where.push('p.mrp_paise > p.price_paise');
  if (req.query.tag) { where.push("(',' || REPLACE(p.tags, ' ', ',') || ',') LIKE ('%,' || @tag || ',%')"); params.tag = req.query.tag.trim(); }

  const whereSql = where.join(' AND ');
  const orderBy = SORTS[req.query.sort] || SORTS.popularity;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(60, Math.max(6, Number.parseInt(req.query.pageSize, 10) || 24));
  const offset = (page - 1) * pageSize;

  const base = `FROM products p LEFT JOIN categories c ON c.slug = p.category_slug WHERE ${whereSql}`;
  const total = d.prepare(`SELECT COUNT(*) AS n ${base}`).get(params).n;
  const rows = d.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color
                          ${base} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset });

  res.json({
    items: rows.map(productShape),
    page, pageSize, total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    sort: req.query.sort || 'popularity',
  });
});

router.get('/products/facets', (req, res) => {
  const d = getDb();
  const categoryFilter = req.query.category ? 'AND p.category_slug = @category' : '';
  const rows = d.prepare(`SELECT p.brand, MIN(p.price_paise) AS min_price, MAX(p.price_paise) AS max_price, COUNT(*) AS n
                          FROM products p WHERE p.is_active = 1 ${categoryFilter}
                          GROUP BY p.brand ORDER BY n DESC`).all(req.query.category ? { category: req.query.category } : {});
  const price = d.prepare(`SELECT MIN(price_paise) AS min, MAX(price_paise) AS max FROM products WHERE is_active = 1`).get();
  res.json({
    brands: rows.map((r) => ({ brand: r.brand, count: r.n })),
    priceRange: { min: price.min ?? 0, max: price.max ?? 0 },
  });
});

/* Curated homepage rails — each resolves to real catalogue rows. */
router.get('/products/sections', (_req, res) => {
  const d = getDb();
  const q = (sql, params = {}, limit = 10) => d.prepare(`
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p LEFT JOIN categories c ON c.slug = p.category_slug
    WHERE p.is_active = 1 ${sql} LIMIT ${limit}`).all(params);

  // Tags are stored space-separated ("staple bestseller daily"), so turn the
  // separators into commas and fence the list before matching one token.
  const TAG_MATCH = "AND (',' || REPLACE(p.tags, ' ', ',') || ',') LIKE ('%,' || @tag || ',%')";
  const tagged = (tag, limit = 10) => q(
    `${TAG_MATCH} ORDER BY p.rating DESC, p.rating_count DESC`, { tag }, limit);

  const sections = [
    { key: 'best-sellers', title: 'Best Sellers', subtitle: 'Most ordered this week', items: tagged('bestseller') },
    { key: 'popular-near-you', title: 'Popular Near You', subtitle: 'Moving fastest in your delivery zone',
      items: q('AND p.stock > 0 ORDER BY p.rating_count DESC') },
    { key: 'trending', title: 'Trending Products', subtitle: 'What shoppers are adding right now', items: tagged('trending, new', 0) },
    { key: 'todays-deals', title: "Today's Deals", subtitle: 'Biggest discounts in the catalogue',
      items: q('AND p.mrp_paise > p.price_paise ORDER BY (p.mrp_paise - p.price_paise) * 1.0 / p.mrp_paise DESC') },
    { key: 'under-99', title: 'Under ₹99', subtitle: 'Everyday picks under a hundred',
      items: q('AND p.price_paise <= 9900 ORDER BY p.price_paise ASC') },
    { key: 'fresh-arrivals', title: 'Fresh Arrivals', subtitle: 'Newly listed this season', items: tagged('new') },
    { key: 'fruits-vegetables', title: 'Fresh Fruits & Vegetables', subtitle: 'Sorted and delivered chilled',
      items: q("AND p.category_slug = 'fruits-vegetables' ORDER BY p.rating DESC") },
    { key: 'daily-essentials', title: 'Daily Essentials', subtitle: 'Restock the basics', items: tagged('daily') },
    { key: 'healthy', title: 'Healthy Picks', subtitle: 'Low-sugar and high-fibre', items: tagged('healthy') },
    { key: 'featured-brands', title: 'Featured Brands', subtitle: 'Brands shoppers trust',
      items: q('AND p.brand IN (SELECT brand FROM products WHERE is_active=1 GROUP BY brand ORDER BY COUNT(*) DESC LIMIT 4) ORDER BY p.rating DESC') },
    { key: 'seasonal', title: 'Seasonal Offers', subtitle: 'In season, in stock', items: tagged('seasonal') },
    { key: 'electronics', title: 'Electronics & Accessories', subtitle: 'Cables, audio and more',
      items: q("AND p.category_slug = 'electronics' ORDER BY p.rating DESC") },
  ];

  // "Trending" tag does not exist in the seed; fall back to recent + high rated.
  sections.find((s) => s.key === 'trending').items = q('ORDER BY p.id DESC, p.rating DESC');

  res.json(sections.map((s) => ({ key: s.key, title: s.title, subtitle: s.subtitle, items: s.items.map(productShape) })));
});

router.get('/products/:slug', (req, res) => {
  const d = getDb();
  const p = d.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color
                       FROM products p LEFT JOIN categories c ON c.slug = p.category_slug
                       WHERE p.slug = @slug AND p.is_active = 1`).get({ slug: req.params.slug });
  if (!p) throw ApiError.notFound('We could not find that product.');

  const related = d.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color
                             FROM products p LEFT JOIN categories c ON c.slug = p.category_slug
                             WHERE p.category_slug = @cat AND p.id != @id AND p.is_active = 1
                             ORDER BY (p.brand = @brand) DESC, p.rating_count DESC LIMIT 8`)
    .all({ cat: p.category_slug, id: p.id, brand: p.brand });

  const boughtTogether = d.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color
                                    FROM products p LEFT JOIN categories c ON c.slug = p.category_slug
                                    WHERE p.category_slug = @cat AND p.id != @id AND p.is_active = 1 AND p.stock > 0
                                    ORDER BY p.rating DESC LIMIT 4`)
    .all({ cat: p.category_slug, id: p.id });

  res.json({
    product: productShape(p),
    related: related.map(productShape),
    boughtTogether: boughtTogether.map(productShape),
  });
});

/* --------------------------------- search -------------------------------- */
router.get('/search/suggest', (req, res) => {
  const term = String(req.query.q || '').trim();
  if (term.length < 2) return res.json({ products: [], restaurants: [], dishes: [] });
  const like = `%${term}%`;
  const d = getDb();
  const products = d.prepare(`SELECT slug, name, brand, price_paise, image_url, category_slug
                              FROM products WHERE is_active = 1 AND (name LIKE @like OR brand LIKE @like)
                              ORDER BY rating_count DESC LIMIT 6`).all({ like });
  const restaurants = d.prepare(`SELECT slug, name, cuisines, area, rating FROM restaurants
                                 WHERE is_open = 1 AND (name LIKE @like OR cuisines LIKE @like) LIMIT 4`).all({ like });
  const dishes = d.prepare(`SELECT m.slug, m.name, m.price_paise, r.slug AS restaurant_slug, r.name AS restaurant_name
                            FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id
                            WHERE m.is_available = 1 AND r.is_open = 1 AND m.name LIKE @like LIMIT 4`).all({ like });
  res.json({ products, restaurants, dishes });
});

router.get('/search', (req, res) => {
  const term = String(req.query.q || '').trim();
  const d = getDb();
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(60, Number.parseInt(req.query.pageSize, 10) || 24);

  if (term.length < 2) return res.json({ items: [], restaurants: [], dishes: [], page, pageSize, total: 0, totalPages: 0, term });

  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
  // Each token must match name OR brand (word-prefix), which keeps multi-word
  // queries like "cold pressed oil" working.
  const conds = tokens.map((t, i) => `(LOWER(p.name) LIKE @t${i} OR LOWER(p.brand) LIKE @t${i})`).join(' AND ');
  const params = {};
  tokens.forEach((t, i) => { params[`t${i}`] = `%${t}%`; });

  // Price range + availability + discount filters apply to search too, so the
  // filter panel behaves identically on category and search pages.
  const extra = [];
  if (req.query.minPrice) { extra.push('AND p.price_paise >= @minPrice'); params.minPrice = Math.round(Number(req.query.minPrice) * 100) || 0; }
  if (req.query.maxPrice) { extra.push('AND p.price_paise <= @maxPrice'); params.maxPrice = Math.round(Number(req.query.maxPrice) * 100) || 0; }
  if (req.query.inStock === 'true') extra.push('AND p.stock > 0');
  if (req.query.inStock === 'false') extra.push('AND p.stock = 0');
  if (req.query.discount === 'true') extra.push('AND p.mrp_paise > p.price_paise');
  const orderBy = SORTS[req.query.sort] || SORTS.popularity;

  let rows = d.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color
                        FROM products p LEFT JOIN categories c ON c.slug = p.category_slug
                        WHERE p.is_active = 1 AND ${conds} ${extra.join(' ')}
                        ORDER BY ${orderBy} LIMIT 200`).all(params);

  // Typo tolerance: if the exact match set is thin, retry with edit-distance <= 1
  // on single-token queries ("tamato" -> "tomato").
  let fuzzyUsed = false;
  if (rows.length < 3 && tokens.length === 1 && tokens[0].length >= 4) {
    const all = d.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color
                           FROM products p LEFT JOIN categories c ON c.slug = p.category_slug
                           WHERE p.is_active = 1 LIMIT 1000`).all();
    rows = all.filter((p) => closeEnough(p.name.toLowerCase(), tokens[0])).slice(0, 24);
    fuzzyUsed = rows.length > 0;
  }

  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  const like = `%${term}%`;
  res.json({
    items: paged.map(productShape),
    restaurants: d.prepare(`SELECT slug, name, cuisines, area, rating, eta_min, eta_max, min_order_paise, image_url
                            FROM restaurants WHERE is_open = 1 AND (name LIKE @like OR cuisines LIKE @like) LIMIT 6`).all({ like }),
    dishes: d.prepare(`SELECT m.slug, m.name, m.price_paise, m.image_url, r.slug AS restaurant_slug, r.name AS restaurant_name
                       FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id
                       WHERE m.is_available = 1 AND m.name LIKE @like LIMIT 8`).all({ like }),
    page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    term, fuzzyUsed,
  });
});

/* ------------------------------ restaurants ------------------------------ */
const restaurantShape = (r) => ({
  id: r.id, slug: r.slug, name: r.name, cuisines: r.cuisines, area: r.area, city: r.city,
  about: r.about, rating: Number(r.rating).toFixed(1), ratingCount: r.rating_count,
  ratingIsDemo: !!r.rating_is_demo, etaMin: r.eta_min, etaMax: r.eta_max,
  minOrder: r.min_order_paise, costForTwo: r.cost_for_two_paise, deliveryFee: r.delivery_fee_paise,
  isVeg: !!r.is_veg, isOpen: !!r.is_open, isPromoted: !!r.is_promoted, image: r.image_url,
  tags: (r.tags || '').split(/\s+/).filter(Boolean),
});

router.get('/restaurants', (req, res) => {
  const d = getDb();
  const where = ['1 = 1'];
  const params = {};
  if (req.query.city) { where.push('r.city = @city'); params.city = req.query.city; }
  if (req.query.cuisine) { where.push('r.cuisines LIKE @cuisine'); params.cuisine = `%${req.query.cuisine}%`; }
  if (req.query.veg === 'true') where.push('r.is_veg = 1');
  if (req.query.open === 'true') where.push('r.is_open = 1');
  const orderBy = {
    rating: 'r.rating DESC', eta: 'r.eta_min ASC', 'cost-asc': 'r.cost_for_two_paise ASC',
    'cost-desc': 'r.cost_for_two_paise DESC',
  }[req.query.sort] || 'r.is_promoted DESC, r.rating DESC';

  const rows = d.prepare(`SELECT * FROM restaurants r WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`).all(params);
  const cuisines = [...new Set(d.prepare('SELECT cuisines FROM restaurants').all().flatMap((r) => (r.cuisines || '').split(',').map((c) => c.trim())))].filter(Boolean);
  res.json({ items: rows.map(restaurantShape), cuisines });
});

router.get('/restaurants/:slug', (req, res) => {
  const d = getDb();
  const r = d.prepare('SELECT * FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!r) throw ApiError.notFound('We could not find that restaurant.');
  const menu = d.prepare('SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY is_best_seller DESC, id ASC')
    .all(r.id);

  const categories = [...new Set(menu.map((m) => m.category))].map((cat) => ({
    name: cat,
    items: menu.filter((m) => m.category === cat).map((m) => ({
      id: m.id, slug: m.slug, name: m.name, description: m.description,
      price: m.price_paise, mrp: m.mrp_paise, isVeg: !!m.is_veg,
      category: m.category, image: m.image_url,
      variations: safeJsonArr(m.variations), addons: safeJsonArr(m.addons),
      isBestSeller: !!m.is_best_seller,
    })),
  }));

  const nearby = d.prepare('SELECT * FROM restaurants WHERE city = ? AND id != ? ORDER BY rating DESC LIMIT 4').all(r.city, r.id);
  res.json({ restaurant: restaurantShape(r), menu: categories, itemCount: menu.length, nearby: nearby.map(restaurantShape) });
});

/* --------------------------- helper: fuzzy match ------------------------- */
function closeEnough(haystack, needle) {
  const words = haystack.split(/\s+/);
  return words.some((w) => w === needle || (w.length > 3 && levenshtein(w.slice(0, Math.max(w.length, needle.length)), needle) <= 1));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function safeJsonArr(v) {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

export default router;
