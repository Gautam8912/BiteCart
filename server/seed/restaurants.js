/**
 * Restaurant catalogue + menus.
 *
 * Menu rows are:
 *   [slug, name, price₹, mrp₹, veg(1|0), category, description,
 *    variations, addons, isBestseller]
 *
 *   variations: [[groupName, required(0|1), [[label, priceDelta₹], ...]], ...]
 *   addons:     [[name, price₹], ...]
 *
 * A menu item becomes a cart line with id `r:<restaurantSlug>:<itemSlug>` so that
 * the same cart engine serves both retail SKUs and restaurant dishes, while the
 * restaurant business rule ("one restaurant per order") can still be enforced.
 *
 * Ratings are seeded DEMO values; the UI labels them "demo data".
 */
const V = (name, required, opts) => [name, required, opts];

const RESTAURANTS = [];

/* -------------------------------- VIJAYAWADA ------------------------------ */
RESTAURANTS.push({
  slug: 'vijayawada-express', name: 'Vijayawada Express',
  cuisines: 'South Indian, Tiffins, Meals', area: 'Benz Circle, Vijayawada', city: 'Vijayawada',
  rating: 4.4, ratingCount: 2140, etaMin: 18, etaMax: 26, minOrder: 99, costForTwo: 300,
  veg: 1, promoted: 1, tags: 'bestseller family',
  about: 'A busy Benz Circle kitchen turning out Andhra tiffins and unlimited-style meals from 7 am. Filter coffee is brewed every two hours.',
  menu: [
    ['idli-4pc',        'Idli (4 pcs) with Sambar & Chutney', 70, 85, 1, 'Tiffins',      'Steamed rice-and-urad idlis served with hot sambar and two chutneys.', [V('Chutney', 1, [['Coconut', 0], ['Peanut', 0], ['Tomato', 10]])], [['Extra sambar', 15]], 1],
    ['ghee-karam-dosa', 'Ghee Karam Dosa',                   110, 130, 1, 'Tiffins',     'Crisp dosa roasted in ghee and brushed with molagapodi.', [V('Roast', 0, [['Extra crisp', 0], ['Soft', 0]])], [['Extra ghee', 20], ['Extra podi', 10]], 1],
    ['pesarattu-upma',  'Pesaraattu with Upma',              120, 145, 1, 'Tiffins',     'Green moong crepe stuffed with rava upma — the Andhra breakfast classic.', [V('Ginger chutney', 1, [['Yes', 0], ['No', 0]])], [], 1],
    ['punugulu-8pc',    'Punugulu (8 pcs)',                   80,  95, 1, 'Tiffins',     'Deep-fried lentil fritters with allam chutney.', [], [['Extra chutney', 10]], 0],
    ['vankaya-kura',    'Vankaya Kura',                      150, 180, 1, 'Curries',     'Stuffed brinjal curry in a sesame and coconut masala.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Andhra hot', 0]])], [], 0],
    ['andhra-meals',    'Andhra Unlimited Meals',            199, 240, 1, 'Meals',       'Rice, sambar, pappu, three curries, rasam, curd and sweet — served on a banana leaf.', [V('Portion', 1, [['Regular', 0], ['Large', 60]])], [['Extra sweet', 40]], 1],
    ['chicken-biryani', 'Andhra Chicken Dum Biryani',        245, 290, 0, 'Biryani',     'Seeraga samba rice layered with country chicken and a fiery Andhra masala.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Andhra hot', 0]]), V('Portion', 1, [['Half', -80], ['Full', 0]])], [['Boiled egg', 20], ['Raita', 25]], 1],
    ['veg-pulao',       'Vegetable Pulao',                   145, 170, 1, 'Biryani',     'Basmati pulao with seasonal vegetables and whole spices.', [V('Portion', 1, [['Half', -50], ['Full', 0]])], [['Raita', 25]], 0],
    ['ulavacharu-soup', 'Ulavacharu (Horse Gram Soup)',       90, 110, 1, 'Sides',       'Andhra horse gram rasam, slow-reduced with a cream finish.', [], [], 0],
    ['pootharekulu',    'Pootharekulu (2 pcs)',              120, 150, 1, 'Desserts',    'The Atreyapuram paper sweet — rice starch, ghee and jaggery.', [], [], 1],
  ],
});

RESTAURANTS.push({
  slug: 'krishna-tiffins', name: 'Krishna Tiffins',
  cuisines: 'South Indian, Breakfast', area: 'Governorpet, Vijayawada', city: 'Vijayawada',
  rating: 4.2, ratingCount: 980, etaMin: 14, etaMax: 22, minOrder: 79, costForTwo: 200,
  veg: 1, promoted: 0, tags: 'breakfast fast',
  about: 'A neighbourhood tiffin centre known for soft idlis and filter coffee. Most orders leave the kitchen in under 10 minutes.',
  menu: [
    ['idli-2pc',      'Idli (2 pcs)',                   40, 50, 1, 'Tiffins',  'Two soft idlis with sambar and chutney.', [V('Chutney', 1, [['Coconut', 0], ['Tomato', 10]])], [], 1],
    ['plain-dosa',    'Plain Dosa',                     60, 75, 1, 'Tiffins',  'Thin crisp dosa with chutney and sambar.', [], [['Extra ghee', 20]], 1],
    ['rava-dosa',     'Onion Rava Dosa',                95, 115, 1, 'Tiffins', 'Lacy rava dosa loaded with onion and green chilli.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [], 1],
    ['medu-vada-2pc', 'Medu Vada (2 pcs)',              50, 60, 1, 'Tiffins',  'Crisp urad vada with coconut chutney.', [], [], 0],
    ['upma',          'Rava Upma',                      55, 70, 1, 'Tiffins',  'Fluffy upma with cashew, curry leaf and ginger.', [], [], 0],
    ['poori-curry',   'Poori with Potato Kurma (2 pcs)', 90, 110, 1, 'Meals',   'Puffed poori with a coconut-potato kurma.', [V('Portion', 1, [['2 pcs', 0], ['4 pcs', 70]])], [], 1],
    ['sambar-rice',   'Sambar Rice',                    95, 115, 1, 'Meals',  'Steamed rice cooked into sambar with ghee and curry leaf.', [], [['Extra sambar', 15]], 0],
    ['curd-rice',     'Curd Rice with Pickle',          85, 100, 1, 'Meals',  'Cool curd rice tempered with mustard and curry leaf, served with avakaya.', [], [], 0],
    ['filter-coffee', 'Filter Coffee',                  35, 45, 1, 'Beverages', 'Degree coffee brewed with 80:20 decoction and hot milk.', [V('Sugar', 1, [['Regular', 0], ['Less', 0], ['No sugar', 0]])], [], 1],
    ['badam-milk',    'Badam Milk',                     60, 75, 1, 'Beverages', 'Hot milk with saffron and almond paste.', [], [], 0],
  ],
});

RESTAURANTS.push({
  slug: 'spice-junction', name: 'Spice Junction',
  cuisines: 'North Indian, Biryani, Chinese', area: 'Patamata, Vijayawada', city: 'Vijayawada',
  rating: 4.0, ratingCount: 1520, etaMin: 24, etaMax: 36, minOrder: 149, costForTwo: 450,
  veg: 0, promoted: 1, tags: 'biryani late-night',
  about: 'A late-night kitchen covering biryani, North Indian gravies and Indo-Chinese. Open until 1 am; biryani is cooked in batches every 90 minutes.',
  menu: [
    ['chicken-dum-biryani', 'Chicken Dum Biryani',        265, 320, 0, 'Biryani',  'Basmati and chicken sealed under dough, finished with saffron milk.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]]), V('Portion', 1, [['Half', -90], ['Full', 0]])], [['Boiled egg', 20], ['Raita', 25]], 1],
    ['mutton-biryani',      'Mutton Dum Biryani',         365, 430, 0, 'Biryani',  'Slow-cooked mutton biryani with a deep, layered masala.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [['Raita', 25]], 1],
    ['veg-biryani',         'Vegetable Biryani',          185, 225, 1, 'Biryani',  'Vegetable biryani with fried onion and mint.', [V('Portion', 1, [['Half', -60], ['Full', 0]])], [], 0],
    ['butter-chicken',      'Butter Chicken',             295, 350, 0, 'North Indian', 'Tandoori chicken in a tomato-cream gravy finished with butter.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [], 1],
    ['paneer-butter-masala','Paneer Butter Masala',       245, 290, 1, 'North Indian', 'Cottage cheese in a mildly sweet tomato gravy.', [V('Gravy', 0, [['Regular', 0], ['Extra gravy', 30]])], [], 1],
    ['dal-tadka',           'Dal Tadka',                  165, 195, 1, 'North Indian', 'Yellow dal tempered with garlic, cumin and dry red chilli.', [], [], 0],
    ['butter-naan',         'Butter Naan',                 55,  70, 1, 'Breads',   'Tandoor naan brushed with butter.', [V('Count', 1, [['1 pc', 0], ['2 pcs', 50], ['4 pcs', 145]])], [], 1],
    ['tandoori-roti',       'Tandoori Roti',               30,  40, 1, 'Breads',   'Whole-wheat tandoor roti.', [V('Count', 1, [['1 pc', 0], ['2 pcs', 28], ['4 pcs', 75]])], [], 0],
    ['chilli-chicken',      'Chilli Chicken (Dry)',       255, 300, 0, 'Chinese',  'Crisp chicken tossed with peppers in a soy-chilli glaze.', [V('Gravy', 1, [['Dry', 0], ['Semi-gravy', 0], ['Gravy', 20]])], [], 1],
    ['veg-fried-rice',      'Vegetable Fried Rice',       165, 195, 1, 'Chinese',  'Wok-tossed rice with vegetables and spring onion.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Schezwan', 10]])], [], 0],
  ],
});

RESTAURANTS.push({
  slug: 'green-bowl-cafe', name: 'Green Bowl Cafe',
  cuisines: 'Healthy, Salads, Continental', area: 'Vidyadharapuram, Vijayawada', city: 'Vijayawada',
  rating: 4.5, ratingCount: 640, etaMin: 20, etaMax: 30, minOrder: 199, costForTwo: 500,
  veg: 1, promoted: 0, tags: 'healthy new',
  about: 'A small health-first cafe: grain bowls, cold-pressed juice and no refined sugar on the menu. Calories are printed on every bowl.',
  menu: [
    ['quinoa-bowl',      'Quinoa Power Bowl',            285, 340, 1, 'Bowls',  'Quinoa, roasted vegetables, chickpeas, feta and lemon-tahini dressing. 520 kcal.', [V('Dressing', 1, [['Lemon tahini', 0], ['Yogurt herb', 0]])], [['Extra avocado', 60]], 1],
    ['greek-salad',      'Greek Salad',                  225, 270, 1, 'Salads', 'Cucumber, tomato, olives, red onion and feta with oregano oil. 310 kcal.', [], [], 0],
    ['buddha-bowl',      'Buddha Bowl',                  265, 320, 1, 'Bowls',  'Brown rice, roasted sweet potato, greens, hummus and seeds. 560 kcal.', [V('Base', 1, [['Brown rice', 0], ['Quinoa', 40]])], [], 1],
    ['paneer-tikka-bowl','Paneer Tikka Bowl',            295, 350, 1, 'Bowls',  'Charred paneer tikka over herbed rice with mint yogurt. 610 kcal.', [], [], 1],
    ['oats-upma',        'Savoury Oats Upma',            145, 175, 1, 'Breakfast', 'Rolled oats cooked with vegetables and curry leaf. 290 kcal.', [], [], 0],
    ['banana-smoothie',  'Banana Peanut Smoothie',       165, 195, 1, 'Beverages', 'Banana, peanut butter, oats and milk blended thick. 380 kcal.', [V('Milk', 1, [['Dairy', 0], ['Almond milk', 30]])], [], 1],
    ['cold-pressed-juice','Cold-Pressed Orange Juice',   135, 165, 1, 'Beverages', '300 ml, no added sugar or water.', [], [], 0],
    ['multigrain-toast', 'Avocado Multigrain Toast',     195, 235, 1, 'Breakfast', 'Sourdough, smashed avocado, chilli flakes and lemon. 340 kcal.', [V('Egg', 0, [['No egg', 0], ['Add poached egg', 40]])], [], 0],
    ['protein-balls',    'Date & Oat Protein Balls (3)', 115, 140, 1, 'Desserts', 'No-refined-sugar energy balls with dates, oats and cocoa. 180 kcal.', [], [], 0],
  ],
});

RESTAURANTS.push({
  slug: 'coastal-fish-house', name: 'Coastal Fish House',
  cuisines: 'Seafood, Andhra', area: 'Kanuru, Vijayawada', city: 'Vijayawada',
  rating: 4.1, ratingCount: 410, etaMin: 28, etaMax: 40, minOrder: 299, costForTwo: 700,
  veg: 0, promoted: 0, tags: 'seafood premium',
  about: 'Coastal Andhra seafood sourced from Machilipatnam landing each morning. Fish is cleaned to order; expect a longer prep time.',
  menu: [
    ['apollo-fish',      'Apollo Fish',                  325, 380, 0, 'Starters', 'Boneless basa tossed with peppers, curry leaf and yoghurt-chilli marinade.', [V('Spice level', 1, [['Medium', 0], ['Hot', 0]])], [], 1],
    ['fish-fry',         'Coastal Fish Fry (4 pcs)',     285, 340, 0, 'Starters', 'Seer fish marinated in a red-chilli masala and shallow fried.', [V('Fish', 1, [['Seer', 0], ['Rohu', -40]])], [], 1],
    ['prawn-fry',        'Prawn Vepudu',                 365, 420, 0, 'Starters', 'Tiger prawns dry-roasted with coconut and curry leaf.', [], [], 1],
    ['chicken-65',       'Chicken 65',                   265, 310, 0, 'Starters', 'Deep-fried chicken with curry leaf, ginger and yoghurt.', [V('Spice level', 1, [['Medium', 0], ['Hot', 0]])], [], 0],
    ['fish-pulusu',      'Fish Pulusu',                  345, 400, 0, 'Curries',  'Tamarind fish curry cooked in a clay pot with mustard and fenugreek.', [V('Fish', 1, [['Rohu', 0], ['Seer', 60]])], [], 1],
    ['prawn-curry',      'Prawn Iguru',                  355, 410, 0, 'Curries',  'Prawn curry in a roasted-spice onion gravy.', [], [], 0],
    ['crab-masala',      'Crab Masala (2 pcs)',          495, 570, 0, 'Curries',  'Crab cooked in a thick coastal masala. Sold by the piece.', [], [], 0],
    ['fish-biryani',     'Fish Biryani',                 325, 380, 0, 'Biryani',  'Seeraga samba biryani layered with marinated fish.', [V('Portion', 1, [['Half', -110], ['Full', 0]])], [['Raita', 25]], 0],
    ['steamed-rice',     'Steamed Sona Masoori Rice',     85, 100, 1, 'Sides',    'Plain steamed rice.', [], [], 0],
    ['elaneer-payasam',  'Tender Coconut Payasam',       135, 165, 1, 'Desserts', 'Coconut payasam made with tender coconut water and jaggery.', [], [], 0],
  ],
});

RESTAURANTS.push({
  slug: 'urban-chai-house', name: 'Urban Chai House',
  cuisines: 'Beverages, Snacks, Bakery', area: 'Autonagar, Vijayawada', city: 'Vijayawada',
  rating: 4.3, ratingCount: 1180, etaMin: 12, etaMax: 20, minOrder: 49, costForTwo: 150,
  veg: 1, promoted: 0, tags: 'snacks fast low-min',
  about: 'Chai brewed to seven recipes, plus bun maska and evening snacks. The fastest kitchen on the platform — most orders out in 8 minutes.',
  menu: [
    ['irani-chai',    'Irani Chai',                    30, 40, 1, 'Chai',    'Strong milky chai with a cardamom finish.', [V('Sugar', 1, [['Regular', 0], ['Less', 0], ['No sugar', 0]])], [], 1],
    ['masala-chai',   'Masala Chai',                   40, 50, 1, 'Chai',    'Chai boiled with ginger, clove, cinnamon and cardamom.', [V('Sugar', 1, [['Regular', 0], ['Less', 0], ['No sugar', 0]])], [], 1],
    ['lemon-tea',     'Lemon Honey Tea',               55, 70, 1, 'Chai',    'Black tea with lemon and honey — no milk.', [], [], 0],
    ['bun-maska',     'Bun Maska (2 pcs)',             45, 60, 1, 'Snacks',  'Soft bun split and slathered with white butter.', [], [['Extra butter', 10]], 1],
    ['veg-puff',      'Vegetable Puff (2 pcs)',        40, 50, 1, 'Snacks',  'Flaky puff pastry with a spiced potato-peas filling.', [], [], 1],
    ['bread-omelette','Bread Omelette',                70, 85, 0, 'Snacks',  'Two-egg omelette sandwiched between toasted bread with onion and chilli.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [], 1],
    ['maggie',        'Masala Maggi',                  60, 75, 1, 'Snacks',  'Noodles cooked with onion, tomato and a house masala.', [V('Add-on', 0, [['Plain', 0], ['Cheese', 30], ['Egg', 25]])], [], 0],
    ['cold-coffee',   'Cold Coffee',                   95, 115, 1, 'Beverages', 'Blended iced coffee with a milk-foam top.', [V('Size', 1, [['Regular', 0], ['Large', 40]])], [], 1],
    ['nimbu-soda',    'Nimbu Soda',                    45, 60, 1, 'Beverages', 'Salted-sweet lemon soda, made to order.', [], [], 0],
    ['choco-pastry',  'Chocolate Pastry',              85, 100, 1, 'Desserts', 'Eggless chocolate pastry with ganache.', [], [], 0],
  ],
});

/* -------------------------------- HYDERABAD ------------------------------- */
RESTAURANTS.push({
  slug: 'nawabi-biryani-house', name: 'Nawabi Biryani House',
  cuisines: 'Hyderabadi, Biryani, Mughlai', area: 'Banjara Hills, Hyderabad', city: 'Hyderabad',
  rating: 4.6, ratingCount: 5230, etaMin: 25, etaMax: 38, minOrder: 199, costForTwo: 600,
  veg: 0, promoted: 1, tags: 'biryani bestseller',
  about: 'Dum biryani cooked the Kacchi method — raw marinated meat layered with rice and sealed. Batches every 60 minutes, so timing matters.',
  menu: [
    ['kacchi-chicken-biryani', 'Kacchi Chicken Biryani',  295, 350, 0, 'Biryani', 'Raw-marinated chicken sealed with basmati under a dough lid. Served with mirchi ka salan.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]]), V('Portion', 1, [['Half', -100], ['Full', 0]])], [['Boiled egg', 20], ['Raita', 25]], 1],
    ['mutton-biryani',         'Nawabi Mutton Biryani',   425, 495, 0, 'Biryani', 'Mutton biryani cooked in the kacchi style with saffron and mint.', [V('Portion', 1, [['Half', -140], ['Full', 0]])], [['Raita', 25]], 1],
    ['veg-dum-biryani',        'Vegetable Dum Biryani',   215, 255, 1, 'Biryani', 'Vegetable biryani with fried onion, mint and whole spices.', [V('Portion', 1, [['Half', -70], ['Full', 0]])], [], 0],
    ['chicken-haleem',         'Chicken Haleem',          245, 290, 0, 'Specials', 'Slow-cooked wheat, lentil and chicken porridge with lemon and fried onion. Seasonal.', [], [['Extra lemon', 0]], 1],
    ['chicken-65',             'Chicken 65',              255, 300, 0, 'Starters', 'Crisp chicken 65 with curry leaf and yoghurt marinade.', [V('Spice level', 1, [['Medium', 0], ['Hot', 0]])], [], 1],
    ['seekh-kebab',            'Mutton Seekh Kebab (4)',  325, 380, 0, 'Starters', 'Charcoal-grilled minced mutton skewers with mint chutney.', [], [], 0],
    ['mirchi-ka-salan',        'Mirchi ka Salan',          95, 115, 1, 'Sides',    'Hyderabadi peanut-sesame chilli curry, the biryani partner.', [], [], 0],
    ['bagara-rice',            'Bagara Rice',             145, 175, 1, 'Sides',    'Mild spiced rice with whole garam masala.', [], [], 0],
    ['rumali-roti',            'Rumali Roti',              35,  45, 1, 'Breads',   'Handkerchief-thin tawa roti.', [V('Count', 1, [['1 pc', 0], ['2 pcs', 32], ['4 pcs', 90]])], [], 0],
    ['double-ka-meetha',       'Double ka Meetha',        125, 150, 1, 'Desserts', 'Fried bread soaked in saffron milk, topped with nuts.', [], [], 1],
  ],
});

RESTAURANTS.push({
  slug: 'tandoor-tales', name: 'Tandoor Tales',
  cuisines: 'North Indian, Tandoor', area: 'Jubilee Hills, Hyderabad', city: 'Hyderabad',
  rating: 4.2, ratingCount: 1870, etaMin: 26, etaMax: 38, minOrder: 249, costForTwo: 800,
  veg: 0, promoted: 0, tags: 'tandoor family',
  about: 'A clay-oven kitchen: kebabs come off the skewer straight into the box. Gravies are made fresh each service, not held overnight.',
  menu: [
    ['tandoori-chicken',    'Tandoori Chicken (Half)',   345, 400, 0, 'Tandoor', 'Yoghurt-and-spice marinated chicken roasted in a clay oven.', [V('Portion', 1, [['Half', 0], ['Full', 320]])], [], 1],
    ['malai-tikka',         'Chicken Malai Tikka',       365, 420, 0, 'Tandoor', 'Cream-and-cheese marinated chicken tikka, mild and juicy.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0]])], [], 1],
    ['paneer-tikka',        'Paneer Tikka',              285, 340, 1, 'Tandoor', 'Charred paneer with peppers and ajwain.', [], [], 1],
    ['mutton-korma',        'Mutton Korma',              425, 490, 0, 'Curries', 'Mutton braised in a cashew and yoghurt korma.', [], [], 0],
    ['kadai-paneer',        'Kadai Paneer',              275, 320, 1, 'Curries', 'Paneer with peppers in a coarsely ground kadai masala.', [], [], 0],
    ['dal-makhani',         'Dal Makhani',               225, 265, 1, 'Curries', 'Black urad simmered overnight with butter and cream.', [], [], 1],
    ['chicken-tikka-masala','Chicken Tikka Masala',      335, 390, 0, 'Curries', 'Grilled chicken in a spiced tomato-cream gravy.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [], 0],
    ['garlic-naan',         'Garlic Naan',                65,  80, 1, 'Breads',  'Naan topped with garlic, coriander and butter.', [V('Count', 1, [['1 pc', 0], ['2 pcs', 60], ['4 pcs', 170]])], [], 1],
    ['laccha-paratha',      'Laccha Paratha',             60,  75, 1, 'Breads',  'Layered flaky paratha.', [V('Count', 1, [['1 pc', 0], ['2 pcs', 55]])], [], 0],
    ['gulab-jamun',         'Gulab Jamun (2 pcs)',        95, 115, 1, 'Desserts', 'Warm khoya dumplings in cardamom syrup.', [], [], 1],
  ],
});

RESTAURANTS.push({
  slug: 'wonton-street', name: 'Wonton Street',
  cuisines: 'Chinese, Thai, Pan-Asian', area: 'Gachibowli, Hyderabad', city: 'Hyderabad',
  rating: 4.0, ratingCount: 1340, etaMin: 22, etaMax: 34, minOrder: 199, costForTwo: 550,
  veg: 0, promoted: 0, tags: 'chinese late-night',
  about: 'Pan-Asian wok kitchen. Dishes are cooked to order in small batches — nothing is pre-fried and held.',
  menu: [
    ['chicken-momos-8',   'Steamed Chicken Momos (8)',  165, 195, 0, 'Dim Sum',  'Hand-pleated momos with a Sichuan chilli dip.', [V('Style', 1, [['Steamed', 0], ['Fried', 20], ['Tandoori', 40]])], [], 1],
    ['veg-momos-8',       'Veg Momos (8)',              135, 165, 1, 'Dim Sum',  'Cabbage, carrot and soy momos with red chutney.', [V('Style', 1, [['Steamed', 0], ['Fried', 20]])], [], 0],
    ['chicken-schezwan-noodles','Chicken Schezwan Noodles', 245, 290, 0, 'Noodles & Rice', 'Hakka noodles wok-tossed in schezwan sauce with chicken.', [V('Spice level', 1, [['Medium', 0], ['Hot', 0], ['Extra hot', 0]])], [], 1],
    ['veg-hakka-noodles', 'Veg Hakka Noodles',          195, 235, 1, 'Noodles & Rice', 'Wok-tossed noodles with julienned vegetables.', [], [], 0],
    ['chicken-fried-rice','Chicken Fried Rice',         225, 265, 0, 'Noodles & Rice', 'Egg fried rice with chicken and spring onion.', [], [], 0],
    ['thai-red-curry',    'Thai Red Curry (Veg)',       285, 340, 1, 'Curries',  'Coconut red curry with tofu and Thai basil. Medium-hot.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [], 0],
    ['chilli-paneer',     'Chilli Paneer',              245, 290, 1, 'Starters', 'Crisp paneer with peppers in a garlic-chilli glaze.', [V('Gravy', 1, [['Dry', 0], ['Semi-gravy', 0], ['Gravy', 20]])], [], 1],
    ['honey-chilli-potato','Honey Chilli Potato',       185, 225, 1, 'Starters', 'Crisp potato tossed in a sweet-hot honey chilli sauce.', [], [], 1],
    ['steamed-rice',      'Steamed Jasmine Rice',       125, 150, 1, 'Noodles & Rice', 'Plain steamed jasmine rice.', [], [], 0],
    ['date-pancake',      'Date Pancake',               135, 165, 1, 'Desserts', 'Semiya-style date pancake with caramel.', [], [], 0],
  ],
});

RESTAURANTS.push({
  slug: 'andhra-bhojanam', name: 'Andhra Bhojanam',
  cuisines: 'Andhra, Meals, Vegetarian', area: 'Kukatpally, Hyderabad', city: 'Hyderabad',
  rating: 4.3, ratingCount: 2260, etaMin: 20, etaMax: 32, minOrder: 129, costForTwo: 350,
  veg: 1, promoted: 0, tags: 'meals family',
  about: 'Pure-vegetarian Andhra meals served on a leaf. The unlimited thali is refilled in-store; delivery thalis are portioned and sealed.',
  menu: [
    ['andhra-thali',      'Andhra Veg Thali',            219, 260, 1, 'Meals',   'Rice, sambar, pappu, two curries, rasam, curd, pickle and sweet.', [V('Portion', 1, [['Regular', 0], ['Large', 70]])], [['Extra sweet', 40]], 1],
    ['bisi-bele-bath',    'Bisi Bele Bath',              155, 185, 1, 'Meals',   'Rice and lentil dish cooked with a sambar masala, finished with ghee.', [], [], 1],
    ['gutti-vankaya',     'Gutti Vankaya Kura',          175, 210, 1, 'Curries', 'Stuffed brinjal in a peanut-sesame Andhra masala.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Andhra hot', 0]])], [], 1],
    ['aratikaya-bajji',   'Aratikaya Bajji (4 pcs)',      85, 105, 1, 'Starters', 'Raw banana fritters with a spiced besan batter.', [], [], 0],
    ['punarnavi-vadiyalu','Vadiyalu Pulihora',           145, 175, 1, 'Meals',   'Tamarind rice with lentil sun-dried dumplings.', [], [], 0],
    ['perugu-annam',      'Perugu Annam',                115, 140, 1, 'Meals',   'Curd rice tempered with mustard, ginger and curry leaf.', [], [], 0],
    ['rasam',             'Pepper Rasam',                 75,  90, 1, 'Sides',   'Thin rasam with black pepper and cumin.', [], [], 0],
    ['avakaya',           'Avakaya Pickle (side)',        45,  60, 1, 'Sides',   'Mango pickle with mustard and groundnut oil.', [], [], 1],
    ['poornam-boorelu',   'Poornam Boorelu (3 pcs)',     135, 165, 1, 'Desserts', 'Sweet lentil-stuffed rice dumplings, a Telugu festival classic.', [], [], 1],
    ['jilebi',            'Jilebi (100 g)',               85, 105, 1, 'Desserts', 'Hot jilebi fried to order.', [], [], 0],
  ],
});

RESTAURANTS.push({
  slug: 'bengaluru-darshini', name: 'Bengaluru Darshini',
  cuisines: 'South Indian, Fast Food', area: 'Indiranagar, Bengaluru', city: 'Bengaluru',
  rating: 4.1, ratingCount: 3040, etaMin: 16, etaMax: 26, minOrder: 99, costForTwo: 250,
  veg: 0, promoted: 0, tags: 'breakfast fast bestseller',
  about: 'A Bengaluru darshini in delivery form — benne dosas, filter coffee and quick meals. Everything is packed within 6 minutes of cooking.',
  menu: [
    ['benne-dosa',       'Benne Dosa',                  95, 115, 1, 'Tiffins',  'Butter dosa with a crisp, blistered surface.', [V('Chutney', 1, [['Coconut', 0], ['Tomato', 10]])], [['Extra butter', 20]], 1],
    ['masala-dosa',      'Masala Dosa',                115, 135, 1, 'Tiffins',  'Dosa with a spiced potato filling and sambar.', [], [], 1],
    ['set-dosa',         'Set Dosa (2 pcs)',           105, 125, 1, 'Tiffins',  'Soft spongy set dosas with coconut chutney.', [], [], 0],
    ['chow-chow-bath',   'Chow Chow Bath',              95, 115, 1, 'Tiffins',  'Half khara bath, half kesari bath — the Bengaluru breakfast pair.', [], [], 1],
    ['bisi-bele-bath',   'Bisi Bele Bath',             145, 175, 1, 'Meals',    'Rice, lentils and vegetables in a Bengaluru-style sambar masala.', [], [], 0],
    ['north-indian-thali','Veg North Indian Thali',     185, 220, 1, 'Meals',    'Two rotis, dal, sabzi, rice, curd and sweet.', [], [], 0],
    ['chicken-dosa',     'Chicken Dosa',               165, 195, 0, 'Tiffins',  'Dosa layered with a spiced chicken keema filling.', [], [], 0],
    ['filter-coffee',    'Filter Coffee (Large)',       55,  70, 1, 'Beverages','Strong degree coffee with a thick decoction.', [V('Sugar', 1, [['Regular', 0], ['Less', 0], ['No sugar', 0]])], [], 1],
    ['badam-milk',       'Badam Milk',                  70,  85, 1, 'Beverages','Saffron-almond milk served hot.', [], [], 0],
    ['mysore-pak',       'Mysore Pak (2 pcs)',          95, 115, 1, 'Desserts', 'Soft ghee-rich gram flour fudge.', [], [], 1],
  ],
});

RESTAURANTS.push({
  slug: 'punjabi-dhaba-express', name: 'Punjabi Dhaba Express',
  cuisines: 'Punjabi, North Indian', area: 'T. Nagar, Chennai', city: 'Chennai',
  rating: 3.9, ratingCount: 860, etaMin: 28, etaMax: 42, minOrder: 199, costForTwo: 500,
  veg: 0, promoted: 0, tags: 'north-indian late-night',
  about: 'Tandoori breads and Punjabi gravies, cooked late into the night. Portions are dhaba-sized — one sabzi serves two.',
  menu: [
    ['chole-bhature',    'Chole Bhature (2 pcs)',       175, 210, 1, 'Main Course', 'Puffed bhature with a spiced chhole and onion salad.', [V('Portion', 1, [['2 pcs', 0], ['4 pcs', 130]])], [], 1],
    ['sarson-saag',      'Sarson da Saag',              215, 255, 1, 'Main Course', 'Mustard greens slow-cooked with maize and spices, topped with white butter.', [], [], 1],
    ['makki-roti',       'Makki di Roti',                45,  60, 1, 'Breads',      'Maize flour roti cooked on a tawa.', [V('Count', 1, [['1 pc', 0], ['2 pcs', 40], ['3 pcs', 78]])], [], 0],
    ['dal-makhani',      'Dal Makhani',                 215, 255, 1, 'Main Course', 'Black lentils simmered for 8 hours with butter and cream.', [], [], 1],
    ['amritsari-kulcha', 'Amritsari Kulcha',            105, 130, 1, 'Breads',      'Stuffed potato-and-paneer kulcha with butter.', [], [], 0],
    ['butter-chicken',   'Butter Chicken',              305, 360, 0, 'Main Course', 'Tandoori chicken in a tomato-butter gravy.', [V('Spice level', 1, [['Mild', 0], ['Medium', 0], ['Hot', 0]])], [], 1],
    ['lassi-sweet',      'Sweet Lassi',                  85, 105, 1, 'Beverages',   'Thick churned lassi with a malai top.', [V('Flavour', 1, [['Plain', 0], ['Mango', 20], ['Rose', 15]])], [], 1],
    ['phirni',           'Phirni',                       95, 115, 1, 'Desserts',    'Chilled rice-milk pudding with pistachio.', [], [], 0],
    ['paneer-tikka',     'Paneer Tikka',                265, 315, 1, 'Starters',    'Clay-oven paneer tikka with mint chutney.', [], [], 0],
    ['onion-salad',      'Onion & Lemon Salad',          45,  60, 1, 'Sides',       'Sliced onion with lemon and green chilli.', [], [], 0],
  ],
});

export const RESTAURANTS_SEED = RESTAURANTS;
export const RESTAURANT_COUNT = RESTAURANTS.length;
export const MENU_ITEM_COUNT = RESTAURANTS.reduce((n, r) => n + r.menu.length, 0);
