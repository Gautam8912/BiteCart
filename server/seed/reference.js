/**
 * Application settings + master reference data (cities, categories, brands, coupons).
 *
 * These are SEED values: they are written into the `settings` / `cities` /
 * `categories` / `coupons` tables on first run and are editable from the admin
 * dashboard. Nothing in the app hard-codes the free-delivery threshold — every
 * consumer reads `settings.free_delivery_threshold_paise`.
 */

/** All money in this file is stored in PAISE (₹150 => 15000) to avoid float errors. */
export const rupees = (n) => Math.round(n * 100);

export const SETTINGS_SEED = {
  app_name: 'Food Express',
  support_email: 'support@foodexpress.example',
  support_phone: '1800-000-0000',
  currency: 'INR',
  /** Merchandise subtotal (in paise) at which delivery becomes free. Business rule: ₹150. */
  free_delivery_threshold_paise: rupees(150),
  /** Delivery charge applied when the eligible merchandise subtotal is below the threshold. */
  delivery_fee_paise: rupees(29),
  /** Small-order handling fee (₹0 in this configuration). */
  handling_fee_paise: rupees(0),
  /** GST slabs used by the bill engine — retail goods are exempt, restaurant food is 5%. */
  gst_grocery_percent: 0,
  gst_restaurant_percent: 5,
  /** Loyalty: points earned per ₹10 of paid merchandise. */
  loyalty_points_per_rupee: 0.1,
  /** Demo mode flags surfaced in the UI so simulated features are never mistaken for live ones. */
  demo_mode: 1,
  demo_payments_enabled: 1,
  simulated_order_tracking: 1,
  /** Coupons seeded by this project are demo promotions until configured for real use. */
  coupons_are_demo: 1,
};

/**
 * Delivery coverage. `status` is deliberately NOT "live" everywhere: this is a
 * demo build, so Vijayawada (project HQ) is the fully simulated coverage area and
 * the rest are "limited". The UI must always show the real status string.
 */
export const CITIES_SEED = [
  // name,            state,             etaMin, etaMax, fee,  pincodes,              status,    defaultLocality
  ['Vijayawada',     'Andhra Pradesh',   12, 28, 0,   ['520001','520002','520007','520008','520010','521105'], 'live-simulated', 'Benz Circle'],
  ['Guntur',         'Andhra Pradesh',   18, 34, 0,   ['522001','522003','522004','522007'], 'live-simulated', 'Brindavan Gardens'],
  ['Visakhapatnam',  'Andhra Pradesh',   22, 40, 1000,['530001','530002','530016','530045'], 'limited', 'Siripuram'],
  ['Hyderabad',      'Telangana',        18, 36, 0,   ['500001','500032','500034','500081','500084'], 'limited', 'Banjara Hills'],
  ['Bengaluru',      'Karnataka',        20, 40, 1000,['560001','560034','560038','560066','560103'], 'limited', 'Indiranagar'],
  ['Chennai',        'Tamil Nadu',       20, 42, 1000,['600001','600018','600040','600042'], 'limited', 'T. Nagar'],
  ['Pune',           'Maharashtra',      24, 45, 1500,['411001','411004','411014','411045'], 'limited', 'Kothrud'],
  ['Mumbai',         'Maharashtra',      26, 48, 1500,['400001','400050','400053','400076'], 'limited', 'Bandra West'],
  ['Delhi',          'Delhi',            26, 50, 1500,['110001','110016','110024','110092'], 'limited', 'Saket'],
  ['Kolkata',        'West Bengal',      28, 52, 1500,['700001','700019','700029','700091'], 'limited', 'Salt Lake'],
  ['Patna',          'Bihar',            32, 60, 2000,['800001','800014','800020'], 'coming-soon', 'Boring Road'],
];

/** Locality search corpus — keeps the location selector honest without a geocoder. */
export const LOCALITIES_SEED = {
  Vijayawada: ['Benz Circle','Governorpet','One Town','Patamata','Vidyadharapuram','Autonagar','Gollapudi','Kanuru','Ramavarappadu','Poranki','Mangalagiri Road'],
  Guntur: ['Brindavan Gardens','Arundelpet','Namburu','Chandramoulipuram','Lalapuram','Ring Road'],
  Visakhapatnam: ['Siripuram','Madhurawada','MVP Colony','Gajuwaka','Seethammadhara'],
  Hyderabad: ['Banjara Hills','Jubilee Hills','Gachibowli','Hitec City','Kukatpally','Secunderabad','Uppal','Kondapur'],
  Bengaluru: ['Indiranagar','Koramangala','HSR Layout','Whitefield','Jayanagar','Malleshwaram'],
  Chennai: ['T. Nagar','Adyar','Anna Nagar','Velachery','OMR Perungudi'],
  Pune: ['Kothrud','Baner','Hinjewadi','Viman Nagar','Kalyani Nagar'],
  Mumbai: ['Bandra West','Andheri East','Powai','Worli','Malad West'],
  Delhi: ['Saket','Dwarka','Rohini','Lajpat Nagar','Mayur Vihar'],
  Kolkata: ['Salt Lake','Park Street','Behala','Gariahat','New Town'],
  Patna: ['Boring Road','Kankarbagh','Rajendra Nagar','Patliputra'],
};

/**
 * Categories. `color` drives the generated product artwork so every item looks
 * distinct without shipping 150 binary images.
 */
export const CATEGORIES_SEED = [
  // slug,               name,                    color,    icon, tagline,                                            sortOrder, isFood
  ['restaurants',        'Food & Restaurants',   '#E8590C','🍛','Biryani, meals, Chinese & more from nearby kitchens', 1, 1],
  ['groceries',          'Groceries',            '#D9822B','🌾','Rice, atta, oils, pulses & daily staples',            2, 0],
  ['fruits-vegetables',  'Fruits & Vegetables',  '#4E9A51','🥬','Farm-fresh, graded & cleaned',                        3, 0],
  ['dairy-bakery',       'Dairy & Bakery',       '#C08A2E','🥛','Milk, paneer, bread & fresh bakes',                   4, 0],
  ['snacks-beverages',   'Snacks & Beverages',   '#C94F7C','🍿','Chips, chocolate, tea, coffee & drinks',              5, 0],
  ['personal-care',      'Personal Care',        '#3E8FB0','🧼','Hair, skin, oral care & grooming',                    6, 0],
  ['beauty',             'Beauty',               '#A26AA6','💄','Skincare, makeup & fragrances',                       7, 0],
  ['household',          'Household Essentials', '#5C7A99','🧺','Detergents, cleaning & home care',                    8, 0],
  ['electronics',        'Electronics & Accessories', '#4A5A6A', '🎧','Cables, audio, storage & mobile gear',          9, 0],
  ['stationery',         'Stationery',           '#B0563E','✏️','Notebooks, pens & art supplies',                      10, 0],
  ['pet-supplies',       'Pet Supplies',         '#8A6A3C','🐾','Food, treats & care for pets',                        11, 0],
];

/** Brands are per-category so "Featured Brands" and the brand filter are meaningful. */
export const BRANDS_SEED = {
  groceries: ['Harvest Fields', 'Krishna Mills', 'Annapurna Farms', 'Tasty Roots', 'Green Valley'],
  'fruits-vegetables': ['Farm Fresh', 'Orchard Co.', 'Green Valley', 'Tasty Roots'],
  'dairy-bakery': ['Krishna Dairy', 'Sunrise Bakery', 'Harvest Fields'],
  'snacks-beverages': ['Crunch Co.', 'Brew House', 'Annapurna Farms', 'Sunrise Bakery'],
  'personal-care': ['PureCare', 'Herbal Roots', 'Glow Lab'],
  beauty: ['Glow Lab', 'Herbal Roots', 'PureCare'],
  household: ['Sparkle Home', 'PureCare'],
  electronics: ['VoltEdge', 'SoundWave', 'PixelPro'],
  stationery: ['InkCraft', 'BrightLeaf'],
  'pet-supplies': ['Happy Paws'],
};

/**
 * Coupon catalogue. Every seeded coupon carries `is_demo = 1` and the UI labels
 * it "Demo promotion". Rules:
 *   - type: 'percent' | 'flat' | 'free_delivery'
 *   - `stackable` is respected by the bill engine (max 1 non-stackable per order)
 *   - `min_subtotal_paise` / `max_discount_paise` / `usage_limit` / `per_user_limit`
 *     are all enforced server-side in server/utils/pricing.js
 */
export const COUPONS_SEED = [
  // code,        title,                                    type,            value, minSubtotal, maxDiscount, stack, perUser, expires(days from seed), category, active
  ['FIRSTORDER', '₹100 off on your first order',            'flat',    rupees(100), rupees(499), null,         0, 1, 180, null,                  1],
  ['SAVE10',     '10% off up to ₹120',                      'percent',  10,         rupees(299), rupees(120),  0, 3, 180, null,                  1],
  ['GREEN20',    '20% off on fruits & vegetables (max ₹80)','percent',  20,         rupees(199), rupees(80),   0, 2, 120, 'fruits-vegetables', 1],
  ['SNACK50',    'Flat ₹50 off on snacks & beverages',      'flat',    rupees(50),  rupees(299), null,         1, 2, 90,  'snacks-beverages',  1],
  ['ELE150',     '₹150 off electronics above ₹999',         'flat',    rupees(150), rupees(999), null,         0, 1, 120, 'electronics',       1],
  ['FREEDEL',    'Free delivery on any order',              'free_delivery', 0,     rupees(99),  null,         1, 5, 60,  null,                  1],
  ['GROCERY25',  '₹25 off groceries above ₹199',            'flat',    rupees(25),  rupees(199), null,         1, 4, 150, 'groceries',         1],
  ['DIWALI25',   '25% off up to ₹200 (expiring soon)',      'percent',  25,         rupees(599), rupees(200),  0, 1, -3,  null,                  1], // expired by design
  ['EXPIRED100', 'Expired test coupon (inactive)',          'flat',    rupees(100), rupees(100), null,         0, 1, 45,  null,                  0],
];
