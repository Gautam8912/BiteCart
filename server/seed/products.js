/**
 * Retail product catalogue (145 distinct SKUs).
 *
 * Each row is:
 *   [slug, name, brand, price₹, mrp₹, unit, weight, description, "tags", stock]
 *
 * - `mrp` is the struck-through original price; a discount badge is derived from it.
 * - `unit` is the selling denomination shown on the card (500 g / 1 L / 1 pack).
 * - `tags` drive the curated homepage rails (bestseller, trending, under99,
 *   fresh, daily, seasonal, new) so every rail resolves to real catalogue rows.
 * - Images are generated server-side at /api/images/:slug (see server/routes/images.js),
 *   so nothing here depends on an external CDN.
 * - Ratings are seeded DEMO values and are labelled as such everywhere they appear.
 */

const P = [];

/* ------------------------------- GROCERIES ------------------------------- */
P.push(
  ['groceries','sella-rice-5kg',       'Sona Masoori Sella Rice',      'Harvest Fields',  425, 480, '5 kg',   '5 kg',     'Aged, low-starch sella rice from the Krishna delta. Fluffy, separate grains ideal for everyday meals and biryani.', 'staple bestseller daily',        120],
  ['groceries','brown-rice-1kg',       'Unpolished Brown Rice',        'Harvest Fields',  118, 145, '1 kg',   '1 kg',     'Single-polished brown rice with the bran layer intact. Higher fibre than white rice, mild nutty flavour.', 'staple healthy new',              80],
  ['groceries','wheat-flour-5kg',      'Whole Wheat Chakki Atta',      'Krishna Mills',   255, 295, '5 kg',   '5 kg',     'Stone-ground chakki atta from 100% whole wheat. Soft rotis with no maida added.', 'staple bestseller daily',        140],
  ['groceries','besan-500g',           'Gram Flour (Besan)',           'Krishna Mills',   105, 125, '500 g',  '500 g',    'Finely milled chickpea flour for pakoras, besan laddoo and kadhi. No added colour.', 'staple',                          60],
  ['groceries','sugar-1kg',            'Refined Sugar Crystals',       'Annapurna Farms',  58,  68, '1 kg',   '1 kg',     'Free-flowing refined sugar crystals, sulphur-free processing.', 'staple daily under99',           200],
  ['groceries','jaggery-powder-500g',  'Organic Jaggery Powder',       'Annapurna Farms',  89, 110, '500 g',  '500 g',    'Chemical-free jaggery powder from sugarcane. Deeper flavour than refined sugar.', 'staple healthy',                  90],
  ['groceries','table-salt-1kg',       'Iodised Table Salt',           'Annapurna Farms',  28,  34, '1 kg',   '1 kg',     'Vacuum-evaporated iodised salt, free-flowing granules.', 'staple daily under99',           250],
  ['groceries','rock-salt-500g',       'Pink Rock Salt',               'Annapurna Farms',  72,  90, '500 g',  '500 g',    'Coarse Himalayan pink rock salt, unrefined and additive-free.', 'staple new',                      70],
  ['groceries','sunflower-oil-1l',     'Refined Sunflower Oil',        'Tasty Roots',     132, 160, '1 L',    '1 litre',  'Light, neutral refined sunflower oil with high smoke point for daily Indian cooking.', 'staple bestseller daily',        180],
  ['groceries','groundnut-oil-1l',     'Cold-Pressed Groundnut Oil',   'Tasty Roots',     248, 290, '1 L',    '1 litre',  'Wood-pressed groundnut oil, unfiltered. Strong nutty aroma, best for tempering and deep frying.', 'staple healthy new',              65],
  ['groceries','mustard-oil-1l',       'Kachi Ghani Mustard Oil',      'Tasty Roots',     189, 225, '1 L',    '1 litre',  'Traditional cold-pressed mustard oil with a sharp pungency, ideal for pickles and fish.', 'staple',                          75],
  ['groceries','toor-dal-1kg',         'Toor Dal (Arhar)',             'Harvest Fields',  165, 195, '1 kg',   '1 kg',     'Unpolished toor dal that cooks soft for sambar and pappu. Sorted and de-stoned.', 'staple bestseller daily',        150],
  ['groceries','moong-dal-500g',       'Moong Dal (Split Yellow)',     'Harvest Fields',  112, 135, '500 g',  '500 g',    'Split yellow moong, quick-cooking and easy to digest. Base for pesaraattu and khichdi.', 'staple daily',                    130],
  ['groceries','chana-dal-1kg',        'Chana Dal',                    'Harvest Fields',  128, 150, '1 kg',   '1 kg',     'Bengal gram dal for chana dal, vada batter and sunundlu.', 'staple',                          110],
  ['groceries','urad-dal-500g',        'Urad Dal (Split White)',       'Harvest Fields',  118, 140, '500 g',  '500 g',    'Split white urad for idli and dosa batter; ferments reliably.', 'staple daily',                    120],
  ['groceries','rajma-500g',           'Rajma (Red Kidney Beans)',     'Harvest Fields',  145, 175, '500 g',  '500 g',    'Large red kidney beans, uniform size, cooks even without overnight soaking.', 'staple new',                      55],
  ['groceries','kabuli-chana-500g',    'Kabuli Chana (Chickpeas)',     'Harvest Fields',  138, 165, '500 g',  '500 g',    'Kabuli chickpeas for chole, salads and hummus.', 'staple',                          60],
  ['groceries','green-moong-500g',     'Whole Green Moong',            'Harvest Fields',   98, 120, '500 g',  '500 g',    'Whole green gram for sprouts and pesarattu.', 'staple healthy under99',          95],
  ['groceries','masoor-dal-500g',      'Masoor Dal (Red Lentils)',     'Harvest Fields',   88, 105, '500 g',  '500 g',    'Split red lentils that cook down in 15 minutes for dal and soups.', 'staple under99',                 100],
  ['groceries','black-eyed-beans-500g','Lobia (Black-Eyed Beans)',     'Harvest Fields',  104, 128, '500 g',  '500 g',    'Cowpeas for lobia curry and Andhra-style bobbatlu filling.', 'staple',                          70],
  ['groceries','sambar-powder-200g',   'Sambar Powder',                'Annapurna Farms',  95, 115, '200 g',  '200 g',    'Roast-ground sambar masala in small batches — coriander, red chilli, lentils and fenugreek.', 'spice bestseller',                85],
  ['groceries','turmeric-powder-200g', 'Turmeric Powder',              'Annapurna Farms',  62,  78, '200 g',  '200 g',    'Single-origin Erode turmeric, 3.5% curcumin, no added colour.', 'spice daily under99',            160],
  ['groceries','chilli-powder-200g',   'Guntur Chilli Powder',         'Annapurna Farms',  88, 110, '200 g',  '200 g',    'Guntur Sannam chilli, stone-ground. Deep red colour with real heat.', 'spice bestseller',               140],
  ['groceries','coriander-powder-200g','Coriander Powder',             'Annapurna Farms',  58,  72, '200 g',  '200 g',    'Whole coriander seeds roasted and milled fresh.', 'spice under99',                  150],
  ['groceries','cumin-seeds-100g',     'Cumin Seeds (Jeera)',          'Annapurna Farms',  65,  82, '100 g',  '100 g',    'Gujarat jeera, hand-cleaned, high essential-oil content.', 'spice under99',                  130],
  ['groceries','mustard-seeds-100g',   'Mustard Seeds (Rai)',          'Annapurna Farms',  38,  48, '100 g',  '100 g',    'Small black mustard seeds for tempering and pickles.', 'spice under99',                  180],
  ['groceries','garam-masala-100g',    'Garam Masala',                 'Annapurna Farms',  92, 115, '100 g',  '100 g',    'Whole-spice garam masala ground weekly — 11 spices, no fillers.', 'spice',                           90],
  ['groceries','chicken-masala-100g',  'Chicken Masala',               'Annapurna Farms',  78,  95, '100 g',  '100 g',    'Robust north-Indian chicken masala blend for curries and tandoori marinades.', 'spice',                           85],
  ['groceries','biryani-masala-100g',  'Hyderabadi Biryani Masala',    'Annapurna Farms', 105, 130, '100 g',  '100 g',    'Aromatic biryani blend with stone flower, mace and green cardamom.', 'spice bestseller new',            75],
  ['groceries','ghee-500g',            'Cow Ghee',                     'Krishna Dairy',   365, 425, '500 g',  '500 g',    'Bilona-churned cow ghee with a granular texture and nutty finish.', 'staple bestseller',               60],
  ['groceries','poha-thick-500g',      'Thick Poha (Avalakki)',        'Krishna Mills',   62,  78, '500 g',  '500 g',    'Thick flattened rice that stays firm — the kind used for Andhra-style atukulu.', 'staple under99 daily',           140],
  ['groceries','idli-rice-2kg',        'Idli Rice',                    'Harvest Fields',  165, 195, '2 kg',   '2 kg',     'Short-grain idli rice for soft, spongy idlis and dosa batter.', 'staple daily',                   110],
  ['groceries','ragi-flour-500g',      'Ragi Flour',                   'Krishna Mills',   78,  95, '500 g',  '500 g',    'Finger millet flour, high in calcium. For ragi malt, mudde and rotis.', 'staple healthy',                  90],
  ['groceries','rolled-oats-500g',     'Rolled Oats',                  'Harvest Fields',  165, 199, '500 g',  '500 g',    'Whole-grain rolled oats, no added sugar. Cooks creamy in 4 minutes.', 'healthy new bestseller',          85],
  ['groceries','semolina-500g',        'Bombay Rava (Semolina)',       'Krishna Mills',   48,  62, '500 g',  '500 g',    'Fine nylon rava for upma, kesari and rava dosa.', 'staple under99 daily',           160],
  ['groceries','vermicelli-500g',      'Wheat Vermicelli',             'Krishna Mills',   55,  70, '500 g',  '500 g',    'Roasted wheat semiya for kheer and upma; no maida.', 'staple under99',                 120],
  ['groceries','dosa-batter-1kg',      'Idli & Dosa Batter',           'Krishna Dairy',   92, 115, '1 kg',   '1 kg',     'Freshly ground, naturally fermented batter. No preservatives, use within 5 days.', 'daily bestseller',                70],
  ['groceries','pickle-mango-400g',    'Avakaya Mango Pickle',         'Annapurna Farms', 235, 275, '400 g',  '400 g',    'Traditional Andhra avakaya with mustard powder and groundnut oil. Aged 3 months.', 'regional bestseller',             55],
  ['groceries','tamarind-paste-300g',  'Tamarind Paste',               'Annapurna Farms',  85, 105, '300 g',  '300 g',    'Seedless tamarind concentrate, no added preservatives.', 'staple under99',                  95],
  ['groceries','honey-500g',           'Raw Forest Honey',             'Herbal Roots',    315, 375, '500 g',  '500 g',    'Unprocessed multi-flora honey from Nallamala forest, unpasteurised.', 'healthy new',                     45],
);

/* -------------------------- FRUITS & VEGETABLES -------------------------- */
P.push(
  ['fruits-vegetables','banana-robusta-1dz',   'Robusta Banana',               'Farm Fresh',       45,  58, '1 dozen','~1.2 kg',  'Naturally ripened Robusta bananas, free of carbide. Best eaten within 3 days.', 'fresh bestseller daily under99', 150],
  ['fruits-vegetables','apple-shimla-1kg',     'Shimla Apple',                 'Orchard Co.',     165, 210, '1 kg',   '4–5 pcs',  'Crisp Shimla apples with balanced sweet-tart flavour. Graded AA.', 'fresh bestseller',                90],
  ['fruits-vegetables','orange-nagpur-1kg',    'Nagpur Orange',                'Orchard Co.',     125, 160, '1 kg',   '5–6 pcs',  'Juicy Nagpur oranges, thin peel. High vitamin C.', 'fresh seasonal',                  85],
  ['fruits-vegetables','mango-banganapalli',   'Banganapalli Mango',           'Orchard Co.',     285, 350, '1 kg',   '2–3 pcs',  'The Andhra classic — fibreless, honey-sweet, naturally ripened. Seasonal (Apr–Jun).', 'fresh seasonal bestseller',       60],
  ['fruits-vegetables','papaya-1pc',           'Red Lady Papaya',              'Farm Fresh',       52,  70, '1 pc',   '~900 g',   'Ripe Red Lady papaya, deep orange flesh, ready to eat.', 'fresh under99 daily',            100],
  ['fruits-vegetables','pomegranate-1kg',      'Bhagwa Pomegranate',           'Orchard Co.',     195, 245, '1 kg',   '3–4 pcs',  'Ruby-red arils, thin rind Bhagwa variety.', 'fresh',                           70],
  ['fruits-vegetables','guava-500g',           'Allahabad Guava',              'Farm Fresh',       48,  65, '500 g',  '2–3 pcs',  'Crunchy white guava with a floral sweetness.', 'fresh under99',                  110],
  ['fruits-vegetables','grapes-black-500g',    'Black Seedless Grapes',        'Orchard Co.',     105, 135, '500 g',  '500 g',    'Sweet seedless black table grapes, hand-sorted.', 'fresh under99',                  95],
  ['fruits-vegetables','watermelon-1pc',       'Watermelon',                   'Farm Fresh',       62,  85, '1 pc',   '~2.5 kg',  'Deep-red, high-sugar watermelon. Chilled on delivery.', 'fresh seasonal under99',         80],
  ['fruits-vegetables','coconut-1pc',          'Tender Coconut',               'Farm Fresh',       42,  55, '1 pc',   '1 pc',     'Fresh tender coconut with straw. Harvested within 48 hours.', 'fresh daily under99',            120],
  ['fruits-vegetables','lemon-250g',           'Lemon',                        'Farm Fresh',       32,  45, '250 g',  '4–5 pcs',  'Thin-skinned lemons, high juice yield.', 'fresh under99 daily',            160],
  ['fruits-vegetables','potato-1kg',           'Potato',                       'Farm Fresh',       36,  48, '1 kg',   '1 kg',     'Chipsona potatoes, washed and graded. Low moisture for crisp frying.', 'fresh bestseller daily under99', 200],
  ['fruits-vegetables','onion-1kg',            'Onion',                        'Farm Fresh',       42,  58, '1 kg',   '1 kg',     'Nashik red onions, firm with pungent flavour. Sun-cured for shelf life.', 'fresh bestseller daily under99', 200],
  ['fruits-vegetables','tomato-local-1kg',     'Tomato (Local)',               'Farm Fresh',       38,  55, '1 kg',   '1 kg',     'Ripe local tomatoes for gravies and sambar. Slightly soft by design.', 'fresh daily under99',            180],
  ['fruits-vegetables','tomato-hybrid-1kg',    'Tomato (Hybrid)',              'Farm Fresh',       52,  70, '1 kg',   '1 kg',     'Firm hybrid tomatoes that hold shape in curries and salads.', 'fresh daily',                    150],
  ['fruits-vegetables','spinach-250g',         'Palak (Spinach)',              'Green Valley',     28,  40, '250 g',  '250 g',    'Washed, de-rooted spinach leaves, hydro-cooled at packing.', 'fresh healthy under99 daily',    130],
  ['fruits-vegetables','carrot-500g',          'Carrot',                       'Green Valley',     45,  60, '500 g',  '500 g',    'Sweet Ooty carrots, brushed clean, high beta-carotene.', 'fresh healthy under99',          140],
  ['fruits-vegetables','cucumber-500g',        'Cucumber',                     'Green Valley',     35,  48, '500 g',  '2–3 pcs',  'Crunchy salad cucumbers with thin skin, no wax coating.', 'fresh under99 daily',            130],
  ['fruits-vegetables','green-chilli-100g',    'Green Chilli',                 'Green Valley',     18,  26, '100 g',  '100 g',    'Guntur green chillies with sharp, clean heat.', 'fresh under99 daily',            170],
  ['fruits-vegetables','coriander-leaves-100g','Coriander Leaves',             'Green Valley',     15,  22, '100 g',  '1 bunch',  'Fresh coriander with roots trimmed, packed in ventilated pouches.', 'fresh under99 daily',            160],
  ['fruits-vegetables','curry-leaves-50g',     'Curry Leaves',                 'Green Valley',     12,  18, '50 g',   '50 g',     'Fragrant curry leaves picked same morning — essential for tempering.', 'fresh under99 daily',            175],
  ['fruits-vegetables','mint-leaves-50g',      'Mint Leaves (Pudina)',         'Green Valley',     14,  20, '50 g',   '50 g',     'Bright mint leaves for chutney and garnish.', 'fresh under99',                  150],
  ['fruits-vegetables','brinjal-500g',         'Brinjal (Purple)',             'Green Valley',     32,  45, '500 g',  '500 g',    'Glossy purple brinjal, low-seed variety for vankaya curry.', 'fresh under99',                  120],
  ['fruits-vegetables','ladies-finger-500g',   'Ladies Finger (Bendi)',        'Green Valley',     42,  58, '500 g',  '500 g',    'Tender small bendi, non-stringy when cooked.', 'fresh under99 daily',            130],
  ['fruits-vegetables','cauliflower-1pc',      'Cauliflower',                  'Green Valley',     48,  65, '1 pc',   '~700 g',   'Tight white curd, leaves trimmed. Hydro-cooled.', 'fresh under99',                  110],
  ['fruits-vegetables','cabbage-1pc',          'Cabbage',                      'Green Valley',     32,  45, '1 pc',   '~800 g',   'Dense green cabbage for poriyal and salads.', 'fresh under99',                  120],
  ['fruits-vegetables','beans-250g',           'French Beans',                 'Green Valley',     38,  52, '250 g',  '250 g',    'Slender French beans, stringless, bright green.', 'fresh under99',                  125],
  ['fruits-vegetables','green-peas-250g',      'Green Peas (Shelled)',         'Green Valley',     62,  80, '250 g',  '250 g',    'Hand-shelled sweet peas, graded A. Use within 2 days or freeze.', 'fresh under99',                  100],
  ['fruits-vegetables','beetroot-500g',        'Beetroot',                     'Green Valley',     40,  55, '500 g',  '500 g',    'Deep-red beetroot, washed and topped. Good for juice and poriyal.', 'fresh healthy under99',          115],
  ['fruits-vegetables','bitter-gourd-250g',    'Bitter Gourd (Kakarakaya)',    'Green Valley',     35,  48, '250 g',  '250 g',    'Small dark-green bitter gourd, thin skin, less bitter than the long variety.', 'fresh under99',                  110],
  ['fruits-vegetables','drumstick-250g',       'Drumstick (Munakkaya)',        'Green Valley',     45,  60, '250 g',  '4–5 pcs',  'Tender drumsticks for sambar and pappu.', 'fresh under99',                  105],
  ['fruits-vegetables','ridge-gourd-500g',     'Ridge Gourd (Beerakaya)',      'Green Valley',     42,  58, '500 g',  '500 g',    'Smooth young beerakaya, sweet when cooked — an Andhra kitchen staple.', 'fresh under99',                  105],
);

/* ----------------------------- DAIRY & BAKERY ---------------------------- */
P.push(
  ['dairy-bakery','milk-toned-500ml',     'Toned Milk',                   'Krishna Dairy',    29,  34, '500 ml', '500 ml',   'Pasteurised and homogenised toned milk, 3% fat. Delivered chilled.', 'dairy daily under99 bestseller', 220],
  ['dairy-bakery','milk-full-cream-1l',   'Full Cream Milk',              'Krishna Dairy',    68,  78, '1 L',    '1 litre',  'Rich full-cream milk, 6% fat. Ideal for tea and sweets.', 'dairy daily under99',            180],
  ['dairy-bakery','milk-double-toned',    'Double Toned Milk',            'Krishna Dairy',    52,  62, '1 L',    '1 litre',  '1.5% fat milk for low-fat diets without losing protein.', 'dairy healthy',                  150],
  ['dairy-bakery','curd-400g',            'Fresh Curd Cup',               'Krishna Dairy',    45,  55, '400 g',  '400 g',    'Set curd with a thick, creamy body and mild tang. No stabilisers.', 'dairy daily under99 bestseller', 190],
  ['dairy-bakery','greek-yogurt-400g',    'Greek Yogurt (Plain)',         'Krishna Dairy',   115, 140, '400 g',  '400 g',    'Strained Greek yogurt, 2x protein of regular curd, no added sugar.', 'dairy healthy new',               85],
  ['dairy-bakery','buttermilk-200ml',     'Spiced Buttermilk',            'Krishna Dairy',    22,  28, '200 ml', '200 ml',   'Chilled spiced majjiga with curry leaf and ginger tempering.', 'dairy under99 daily',            160],
  ['dairy-bakery','paneer-fresh-200g',    'Fresh Paneer Block',           'Krishna Dairy',    92, 110, '200 g',  '200 g',    'Soft malai paneer made from full-cream milk, citric-acid set. Vacuum packed.', 'dairy bestseller',              100],
  ['dairy-bakery','butter-100g',          'Table Butter',                 'Krishna Dairy',    62,  72, '100 g',  '100 g',    'Pasteurised unsalted table butter, smooth spreadable texture.', 'dairy daily under99',            130],
  ['dairy-bakery','butter-white-500g',    'White Butter (Makhan)',        'Krishna Dairy',   245, 285, '500 g',  '500 g',    'Hand-churned unsalted white butter, no added salt or colour.', 'dairy',                           55],
  ['dairy-bakery','cheese-slices-200g',   'Processed Cheese Slices',      'Krishna Dairy',   135, 160, '200 g',  '10 slices','Individually wrapped cheese slices that melt evenly in sandwiches and burgers.', 'dairy bestseller',               95],
  ['dairy-bakery','cheese-cubes-100g',    'Cheese Cubes',                 'Krishna Dairy',    95, 115, '100 g',  '100 g',    'Bite-size cheese cubes for salads, pizza and tiffin boxes.', 'dairy under99',                   90],
  ['dairy-bakery','bread-brown-400g',     'Brown Bread',                  'Sunrise Bakery',   48,  58, '400 g',  '400 g',    'Whole-meal brown bread with no maida and no added sugar. Baked same morning.', 'bakery daily under99 bestseller',150],
  ['dairy-bakery','bread-white-400g',     'Milk Bread',                   'Sunrise Bakery',   42,  52, '400 g',  '400 g',    'Soft milk bread, sliced and packed within 2 hours of baking.', 'bakery daily under99',            160],
  ['dairy-bakery','pav-6pc',              'Pav Buns (6 pcs)',             'Sunrise Bakery',   38,  48, '6 pcs',  '6 pcs',    'Soft dinner pav for pav bhaji and burgers.', 'bakery under99 daily',            140],
  ['dairy-bakery','eggs-6pc',             'Farm Eggs (6 pcs)',            'Farm Fresh',       58,  72, '6 pcs',  '6 pcs',    'Cleaned, graded white eggs from cage-free flocks.', 'daily bestseller under99',        170],
  ['dairy-bakery','eggs-12pc',            'Farm Eggs (12 pcs)',           'Farm Fresh',      108, 135, '12 pcs', '12 pcs',   'Tray of 12 cleaned eggs — the household pack.', 'daily bestseller',                120],
  ['dairy-bakery','cake-chocolate-400g',  'Chocolate Truffle Cake',       'Sunrise Bakery',  445, 520, '400 g',  '400 g',    'Three layers of chocolate sponge with dark ganache. Eggless on request.', 'bakery bestseller',               40],
  ['dairy-bakery','cake-plum-500g',       'Plum Cake',                    'Sunrise Bakery',  315, 375, '500 g',  '500 g',    'Fruit cake studded with candied peel, nuts and rum-soaked raisins.', 'bakery seasonal',                 45],
  ['dairy-bakery','cookies-atta-300g',    'Atta Nankhatai Cookies',       'Sunrise Bakery',  125, 150, '300 g',  '300 g',    'Buttery whole-wheat nankhatai, egg-free, baked in ghee.', 'bakery new',                      70],
  ['dairy-bakery','rusk-200g',            'Milk Rusk',                    'Sunrise Bakery',   68,  85, '200 g',  '200 g',    'Twice-baked milk rusk that holds its shape in chai.', 'bakery under99 daily',            110],
);

/* --------------------------- SNACKS & BEVERAGES -------------------------- */
P.push(
  ['snacks-beverages','chips-classic-52g',    'Classic Salted Potato Chips',  'Crunch Co.',       20,  25, '52 g',   '52 g',     'Kettle-cooked potato chips with sea salt only. No MSG.', 'snack under99 daily bestseller',  220],
  ['snacks-beverages','chips-masala-52g',     'Masala Potato Chips',          'Crunch Co.',       20,  25, '52 g',   '52 g',     'Chips dusted with a chatpata Indian masala blend.', 'snack under99 daily',             210],
  ['snacks-beverages','chips-cream-onion-52g','Cream & Onion Chips',          'Crunch Co.',       25,  30, '52 g',   '52 g',     'Cream and onion flavoured chips in a resealable pack.', 'snack under99',                   180],
  ['snacks-beverages','biscuit-glucose-250g', 'Glucose Biscuits',             'Crunch Co.',       40,  50, '250 g',  '250 g',    'Light glucose biscuits, a schoolbox and chai classic.', 'snack under99 daily',             190],
  ['snacks-beverages','biscuit-bourbon-300g', 'Chocolate Bourbon Biscuits',   'Crunch Co.',       60,  75, '300 g',  '300 g',    'Chocolate sandwich biscuits with a rich cocoa cream.', 'snack under99 bestseller',        165],
  ['snacks-beverages','biscuit-marie-250g',   'Marie Gold Biscuits',          'Crunch Co.',       45,  55, '250 g',  '250 g',    'Light, low-sugar Marie biscuits that dissolve in tea.', 'snack under99',                   175],
  ['snacks-beverages','biscuit-nankhatai-200g','Butter Nankhatai',            'Sunrise Bakery',   75,  95, '200 g',  '200 g',    'Crumbly butter nankhatai with cardamom.', 'snack under99',                   120],
  ['snacks-beverages','chocolate-dairy-40g',  'Milk Chocolate Bar',           'Crunch Co.',       40,  45, '40 g',   '40 g',     'Smooth milk chocolate with 30% cocoa solids.', 'snack under99 bestseller',        200],
  ['snacks-beverages','chocolate-dark-80g',   '70% Dark Chocolate',           'Crunch Co.',      165, 195, '80 g',   '80 g',     'Single-origin 70% dark chocolate, low sugar, no palm oil.', 'snack healthy new',                90],
  ['snacks-beverages','chocolate-fruit-nut',  'Fruit & Nut Chocolate',        'Crunch Co.',      110, 130, '100 g',  '100 g',    'Milk chocolate loaded with raisins, cashew and almond.', 'snack',                           95],
  ['snacks-beverages','instant-noodles-70g',  'Instant Masala Noodles',       'Crunch Co.',       14,  18, '70 g',   '70 g',     'Wheat noodles with a classic masala tastemaker. Cooks in 3 minutes.', 'snack under99 daily bestseller',  240],
  ['snacks-beverages','instant-noodles-cup',  'Instant Noodle Cup',           'Crunch Co.',       35,  42, '70 g',   '70 g',     'Travel noodle cup with fork — just add hot water.', 'snack under99 new',               150],
  ['snacks-beverages','popcorn-caramel-75g',  'Caramel Popcorn',              'Crunch Co.',       85, 105, '75 g',   '75 g',     'Air-popped corn coated in buttery caramel, no artificial colour.', 'snack under99 new',               110],
  ['snacks-beverages','soft-drink-cola-750ml','Cola Soft Drink',              'Brew House',       45,  50, '750 ml', '750 ml',   'Chilled cola in a resealable PET bottle.', 'beverage under99 daily',          190],
  ['snacks-beverages','soft-drink-lemon-750ml','Lemon-Lime Soft Drink',       'Brew House',       45,  50, '750 ml', '750 ml',   'Lemon-lime carbonated drink, caffeine free.', 'beverage under99',                170],
  ['snacks-beverages','mango-drink-200ml',    'Mango Fruit Drink',            'Brew House',       20,  25, '200 ml', '200 ml',   'Mango fruit drink with 20% pulp, tetra pack.', 'beverage under99',                200],
  ['snacks-beverages','orange-juice-1l',      'Orange Juice (No Added Sugar)','Brew House',      125, 150, '1 L',    '1 litre',  'Reconstituted orange juice, no added sugar or preservatives. Refrigerate after opening.', 'beverage healthy',                 85],
  ['snacks-beverages','coconut-water-200ml',  'Tender Coconut Water',         'Brew House',       45,  55, '200 ml', '200 ml',   '100% tender coconut water, no added sugar, UHT packed.', 'beverage healthy under99',        140],
  ['snacks-beverages','soda-bottle-750ml',    'Club Soda',                    'Brew House',       25,  30, '750 ml', '750 ml',   'Plain soda water for mocktails and nimbu soda.', 'beverage under99',                160],
  ['snacks-beverages','tea-dust-500g',        'CTC Tea Dust',                 'Brew House',      215, 250, '500 g',  '500 g',    'Strong Assam CTC dust for kadak chai. Bold colour, brisk taste.', 'beverage bestseller daily',       120],
  ['snacks-beverages','tea-leaf-250g',        'Premium Leaf Tea',             'Brew House',      165, 195, '250 g',  '250 g',    'Orthodox leaf tea with a lighter body and floral notes.', 'beverage new',                     80],
  ['snacks-beverages','coffee-powder-200g',   'Filter Coffee Powder',         'Brew House',      185, 220, '200 g',  '200 g',    '80:20 chicory-blended filter coffee, medium roast, ground for degree coffee.', 'beverage bestseller',              95],
  ['snacks-beverages','instant-coffee-50g',   'Instant Coffee',               'Brew House',      155, 180, '50 g',   '50 g',     'Freeze-dried instant coffee granules, dissolves clean in hot milk.', 'beverage',                         90],
  ['snacks-beverages','murukku-200g',         'Butter Murukku',               'Annapurna Farms',  95, 115, '200 g',  '200 g',    'Crisp spiral murukku fried in butter, no palm oil.', 'snack regional under99',          110],
  ['snacks-beverages','mixture-200g',         'Spicy Bombay Mixture',         'Annapurna Farms',  72,  90, '200 g',  '200 g',    'Classic sev-and-namkeen mixture with a chilli kick.', 'snack under99',                   130],
  ['snacks-beverages','badam-mix-200g',       'Roasted Dry Fruit Mix',        'Tasty Roots',     285, 340, '200 g',  '200 g',    'Roasted almonds, cashew, pistachio and raisins. No salt or oil added.', 'healthy bestseller new',           70],
  ['snacks-beverages','peanuts-200g',         'Salted Roasted Peanuts',       'Tasty Roots',      65,  80, '200 g',  '200 g',    'Dry-roasted groundnuts with light salt. High protein snacking.', 'snack under99 healthy',           140],
);

/* ----------------------------- PERSONAL CARE ----------------------------- */
P.push(
  ['personal-care','shampoo-anti-dandruff','Anti-Dandruff Shampoo',        'PureCare',        185, 225, '340 ml', '340 ml',   'Piroctone olamine shampoo that clears flakes in 3 washes. Sulphate free.', 'personal bestseller',              85],
  ['personal-care','shampoo-damage-repair','Damage Repair Shampoo',        'Herbal Roots',    215, 260, '340 ml', '340 ml',   'Argan and hibiscus shampoo for chemically treated hair. Paraben free.', 'personal',                          80],
  ['personal-care','conditioner-340ml',    'Smooth & Shine Conditioner',   'PureCare',        205, 245, '340 ml', '340 ml',   'Detangling conditioner with shea butter; rinse-out, silicone light.', 'personal',                          75],
  ['personal-care','hair-oil-coconut-200ml','Coconut Hair Oil',            'Herbal Roots',    128, 155, '200 ml', '200 ml',   'Cold-pressed coconut oil with curry leaf and amla infusion.', 'personal bestseller',                95],
  ['personal-care','soap-sandal-125g',     'Sandalwood Soap',              'Herbal Roots',     42,  52, '125 g',  '125 g',    'Vegetable-base soap with sandalwood oil and glycerin.', 'personal under99 daily',            160],
  ['personal-care','soap-neem-100g',       'Neem & Turmeric Soap',         'Herbal Roots',     38,  48, '100 g',  '100 g',    'Antibacterial neem soap with turmeric for acne-prone skin.', 'personal under99',                  150],
  ['personal-care','body-wash-250ml',      'Citrus Body Wash',             'PureCare',        235, 280, '250 ml', '250 ml',   'Gel body wash with bergamot and lemon peel. pH balanced.', 'personal new',                       70],
  ['personal-care','toothpaste-150g',      'Herbal Toothpaste',            'PureCare',         95, 115, '150 g',  '150 g',    'Neem, clove and babul toothpaste with fluoride. No SLS.', 'personal daily bestseller',         130],
  ['personal-care','toothbrush-medium',    'Charcoal Toothbrush (2 pcs)',  'PureCare',         85, 105, '2 pcs',  '2 pcs',    'Medium-bristle brushes with charcoal-infused heads.', 'personal under99',                   120],
  ['personal-care','mouthwash-250ml',      'Cool Mint Mouthwash',          'PureCare',        195, 235, '250 ml', '250 ml',   'Alcohol-free mouthwash with zinc and mint for 12-hour freshness.', 'personal',                           80],
  ['personal-care','handwash-200ml',       'Aloe Handwash Refill',         'PureCare',         99, 125, '200 ml', '200 ml',   'Moisturising handwash refill pouch with aloe vera.', 'personal under99 daily',            140],
  ['personal-care','shaving-cream-100g',   'Sensitive Shaving Cream',      'PureCare',        145, 175, '100 g',  '100 g',    'Lubricating shaving cream with chamomile for sensitive skin.', 'personal',                           75],
  ['personal-care','razor-3blade-4pc',     'Triple-Blade Razors (4 pcs)',  'PureCare',        175, 210, '4 pcs',  '4 pcs',    'Triple-blade cartridges with a lubricating strip.', 'personal',                           70],
  ['personal-care','deodorant-150ml',      'Cool Water Deodorant',         'Glow Lab',        185, 220, '150 ml', '150 ml',   'Aluminium-free body spray with a fresh aquatic note.', 'personal bestseller',                85],
  ['personal-care','body-lotion-250ml',    'Cocoa Body Lotion',            'Glow Lab',        225, 270, '250 ml', '250 ml',   'Cocoa butter and vitamin E lotion, absorbs without stickiness.', 'personal bestseller',                80],
  ['personal-care','face-wash-100ml',      'Oil Control Face Wash',        'Glow Lab',        165, 199, '100 ml', '100 ml',   'Salicylic acid gel cleanser for oily and combination skin.', 'personal',                           90],
  ['personal-care','sunscreen-spf50-50g',  'Sunscreen Gel SPF 50 PA+++',   'Glow Lab',        399, 475, '50 g',   '50 g',     'Lightweight matte sunscreen gel, no white cast, water resistant 40 min.', 'personal bestseller new',          65],
  ['personal-care','hair-comb',            'Anti-Static Wide-Tooth Comb',  'PureCare',         55,  70, '1 pc',   '1 pc',     'Seamless wide-tooth comb that detangles wet hair without breakage.', 'personal under99',                  110],
);

/* --------------------------------- BEAUTY -------------------------------- */
P.push(
  ['beauty','face-cream-50g',       'Vitamin C Face Cream',         'Glow Lab',        325, 395, '50 g',   '50 g',     '10% vitamin C cream with niacinamide for dull skin. Fragrance free.', 'beauty bestseller',                  70],
  ['beauty','night-cream-50g',      'Retinol Night Cream',          'Glow Lab',        445, 525, '50 g',   '50 g',     '0.3% encapsulated retinol with ceramides. Start with alternate nights.', 'beauty new',                         55],
  ['beauty','face-serum-30ml',      'Hyaluronic Acid Serum',        'Glow Lab',        399, 480, '30 ml',  '30 ml',    '2% hyaluronic acid serum, layered under moisturiser for hydration.', 'beauty bestseller',                  65],
  ['beauty','face-pack-100g',       'Multani Mitti Face Pack',      'Herbal Roots',    125, 155, '100 g',  '100 g',    'Fuller’s earth with sandalwood and neem for oily skin.', 'beauty under99',                     90],
  ['beauty','lip-balm-4g',          'Shea Lip Balm',                'Glow Lab',         95, 120, '4 g',    '4 g',      'Shea and castor oil balm with a natural tint. No parabens.', 'beauty under99',                    110],
  ['beauty','kajal-0.35g',          'Waterproof Kajal Pencil',      'Glow Lab',        145, 175, '0.35 g', '0.35 g',   'Smudge-proof kajal, ophthalmologically tested, 12-hour wear.', 'beauty bestseller',                  85],
  ['beauty','lipstick-matte-4g',    'Matte Lipstick — Brick Rose',  'Glow Lab',        285, 340, '4 g',    '4 g',      'Comfort matte lipstick in a warm brick rose shade.', 'beauty',                             60],
  ['beauty','nail-polish-8ml',      'Nail Polish — Nude',           'Glow Lab',         95, 120, '8 ml',   '8 ml',     'Chip-resistant nude nail lacquer, 5-free formula.', 'beauty under99',                     80],
  ['beauty','compact-powder-9g',    'Compact Powder — Natural',     'Glow Lab',        265, 320, '9 g',    '9 g',      'Finely milled compact with SPF 15, natural finish.', 'beauty',                             55],
  ['beauty','eyeliner-pen-1ml',     'Felt-Tip Eyeliner Pen',        'Glow Lab',        225, 275, '1 ml',   '1 ml',     'Precision felt tip for fine lines and wings, quick-drying.', 'beauty new',                         65],
  ['beauty','face-mist-100ml',      'Rose Facial Mist',             'Herbal Roots',    175, 210, '100 ml', '100 ml',   'Steam-distilled rose water mist with aloe, no alcohol.', 'beauty',                             75],
  ['beauty','hair-mask-200g',       'Deep Repair Hair Mask',        'Herbal Roots',    295, 350, '200 g',  '200 g',    'Weekly mask with keratin and onion oil for frizzy hair.', 'beauty',                             60],
  ['beauty','almond-oil-100ml',     'Sweet Almond Oil',             'Herbal Roots',    215, 260, '100 ml', '100 ml',   'Cold-pressed sweet almond oil for face, body and baby massage.', 'beauty healthy',                     70],
  ['beauty','perfume-50ml',         'Eau de Parfum — Vetiver',      'Glow Lab',        699, 850, '50 ml',  '50 ml',    'Woody vetiver fragrance with citrus top notes, 6–8 hour longevity.', 'beauty new bestseller',              35],
  ['beauty','cotton-pads-50pc',     'Cotton Pads (50 pcs)',         'PureCare',         65,  85, '50 pcs', '50 pcs',   'Lint-free quilted cotton pads for toner and cleansing.', 'beauty under99',                    100],
  ['beauty','makeup-remover-100ml', 'Micellar Makeup Remover',      'Glow Lab',        195, 235, '100 ml', '100 ml',   'Micellar water that lifts waterproof makeup without rubbing.', 'beauty',                             80],
);

/* ------------------------------- HOUSEHOLD ------------------------------- */
P.push(
  ['household','detergent-powder-1kg', 'Detergent Powder',             'Sparkle Home',    165, 199, '1 kg',   '1 kg',     'Enzyme detergent powder for hand and machine wash. Removes oil stains at 30°C.', 'household bestseller daily',       140],
  ['household','detergent-liquid-1l',  'Detergent Liquid',             'Sparkle Home',    245, 295, '1 L',    '1 litre',  'Concentrated liquid detergent, low foam for front-load machines.', 'household bestseller',             100],
  ['household','fabric-softener-800ml','Fabric Softener',              'Sparkle Home',    195, 235, '800 ml', '800 ml',   'Morning-fresh fabric conditioner that reduces static and ironing time.', 'household',                         90],
  ['household','dishwash-500ml',       'Dishwashing Gel',              'Sparkle Home',    115, 140, '500 ml', '500 ml',   'Lemon dishwash gel, 3x grease cut, gentle on hands.', 'household daily bestseller',       130],
  ['household','floor-cleaner-1l',     'Floor Cleaner',                'Sparkle Home',    175, 210, '1 L',    '1 litre',  'Disinfectant floor cleaner with a jasmine fragrance. Kills 99.9% germs.', 'household daily',                  110],
  ['household','toilet-cleaner-500ml', 'Toilet Bowl Cleaner',          'Sparkle Home',    105, 130, '500 ml', '500 ml',   'Thick acidic gel that clings to the bowl and removes hard-water stains.', 'household',                        100],
  ['household','glass-cleaner-500ml',  'Glass & Mirror Cleaner',       'Sparkle Home',    125, 155, '500 ml', '500 ml',   'Streak-free glass cleaner with a built-in spray trigger.', 'household',                         95],
  ['household','handwash-refill-750ml','Handwash Refill Pouch',        'PureCare',        145, 180, '750 ml', '750 ml',   'Bulk handwash refill with aloe, saves 40% plastic.', 'household under99',                110],
  ['household','tissue-100sheets',     'Facial Tissues (100 sheets)',  'Sparkle Home',     85, 105, '100 pc', '100 pc',   '2-ply virgin-pulp tissues, lint free.', 'household under99',                150],
  ['household','toilet-roll-4pc',      'Toilet Tissue Rolls (4 pcs)',  'Sparkle Home',    165, 200, '4 pcs',  '4 pcs',    '3-ply toilet tissue, septic-safe, 200 pulls per roll.', 'household',                         85],
  ['household','kitchen-towel-2pc',    'Kitchen Paper Towels (2 rolls)','Sparkle Home',   145, 175, '2 rolls','2 rolls',  'Absorbent kitchen rolls for spills and wiping surfaces.', 'household',                         90],
  ['household','garbage-bags-30pc',    'Garbage Bags Medium (30 pcs)', 'Sparkle Home',     99, 125, '30 pcs', '30 pcs',   'Leak-proof medium bags, 19x21 inch, star-sealed.', 'household under99 daily',          130],
  ['household','scrub-pad-3pc',        'Scouring Pads (3 pcs)',        'Sparkle Home',     55,  75, '3 pcs',  '3 pcs',    'Non-scratch dual-side scrub pads for cookware.', 'household under99',                140],
  ['household','phenyl-500ml',         'White Phenyl',                 'Sparkle Home',    105, 130, '500 ml', '500 ml',   'Pine-based phenyl concentrate for drains and floors.', 'household',                         95],
  ['household','dish-bar-300g',        'Dishwash Bar',                 'Sparkle Home',     45,  60, '300 g',  '300 g',    'Hard dishwash bar with lemon that lasts twice as long as gel per wash.', 'household under99',                150],
  ['household','mosquito-repellent-45n','Mosquito Refill (45 nights)', 'Sparkle Home',    115, 140, '1 pc',   '45 nights','Liquid vapouriser refill, 45 nights per bottle.', 'household daily',                  120],
  ['household','air-freshener-250ml',  'Room Freshener — Lavender',    'Sparkle Home',    165, 200, '250 ml', '250 ml',   'Aerosol room freshener with lavender and white musk.', 'household',                         85],
);

/* -------------------------- ELECTRONICS & ACCESSORIES --------------------- */
P.push(
  ['electronics','cable-typec-1m',       'USB-C Fast Charge Cable 1 m',  'VoltEdge',        349, 499, '1 m',    '1 m',      '60 W USB-C to USB-C braided cable with an e-marker chip. 25,000-bend tested.', 'electronics bestseller',           120],
  ['electronics','cable-micro-1m',       'Micro-USB Cable 1 m',          'VoltEdge',        199, 299, '1 m',    '1 m',      'Reinforced micro-USB cable with a nylon braid, 2.4 A.', 'electronics',                      130],
  ['electronics','lightning-cable-1m',   'USB-A to Lightning Cable 1 m', 'VoltEdge',        399, 549, '1 m',    '1 m',      'MFi-grade Lightning cable with a tangle-free jacket.', 'electronics',                       95],
  ['electronics','adapter-20w',          '20 W USB-C Fast Charger',      'VoltEdge',        799, 1099,'1 pc',   '1 pc',     'PD 3.0 charger, 20 W, BIS certified with surge protection.', 'electronics bestseller',           100],
  ['electronics','adapter-33w',          '33 W Dual-Port Charger',       'VoltEdge',        1199,1599,'1 pc',   '1 pc',     'USB-C + USB-A charger, 33 W total, foldable pins for travel.', 'electronics new',                   70],
  ['electronics','powerbank-10000',      '10,000 mAh Power Bank',        'VoltEdge',       1499,1999,'1 pc',   '1 pc',     'Dual-output power bank with 22.5 W fast charge and LED level indicator.', 'electronics bestseller',            80],
  ['electronics','powerbank-20000',      '20,000 mAh Power Bank',        'VoltEdge',       2299,2999,'1 pc',   '1 pc',     'High-capacity bank with 30 W PD in/out — charges a laptop once.', 'electronics',                       45],
  ['electronics','earphones-wired',      'Wired Earphones with Mic',     'SoundWave',       449, 649, '1 pc',   '1 pc',     '10 mm dynamic drivers, in-line mic and 3-button remote.', 'electronics bestseller',           140],
  ['electronics','earbuds-tws',          'TWS Earbuds (30 h playtime)',  'SoundWave',      1799,2499,'1 pc',   '1 pc',     'Bluetooth 5.3 earbuds with ENC mics, touch controls and 30-hour case.', 'electronics bestseller new',        75],
  ['electronics','headphones-over-ear',  'Over-Ear Wired Headphones',    'SoundWave',      1299,1799,'1 pc',   '1 pc',     '40 mm drivers, padded headband, foldable — good isolation for calls.', 'electronics',                       55],
  ['electronics','speaker-bluetooth',    'Bluetooth Speaker 10 W',       'SoundWave',      1499,2099,'1 pc',   '1 pc',     'IPX7 speaker with a passive radiator, 12-hour playtime.', 'electronics',                       60],
  ['electronics','mouse-wireless',       'Wireless Mouse 2.4 GHz',       'PixelPro',        599, 849, '1 pc',   '1 pc',     'Silent-click wireless mouse with adjustable DPI up to 1600.', 'electronics bestseller',            90],
  ['electronics','keyboard-usb',         'USB Wired Keyboard',           'PixelPro',        799, 1099,'1 pc',  '1 pc',     'Full-size membrane keyboard with spill-resistant keys.', 'electronics',                       70],
  ['electronics','pen-drive-64gb',       'USB 3.0 Pen Drive 64 GB',      'PixelPro',        599, 899, '64 GB',  '64 GB',    'Metal-body pendrive, up to 120 MB/s read.', 'electronics',                       85],
  ['electronics','mousepad-xl',          'Desk Mat XL (800x300 mm)',     'PixelPro',        499, 699, '1 pc',   '1 pc',     'Stitched-edge desk mat with a non-slip rubber base.', 'electronics under99',               65],
  ['electronics','screen-guard',         'Tempered Glass Screen Guard',  'PixelPro',        249, 399, '1 pc',   '1 pc',     '9H tempered glass, 0.33 mm, with an alignment frame and wet wipes.', 'electronics bestseller',           130],
  ['electronics','mobile-holder',        'Adjustable Mobile Stand',      'PixelPro',        299, 449, '1 pc',   '1 pc',     'Aluminium desk stand with adjustable height and cable pass-through.', 'electronics',                      100],
  ['electronics','hdmi-cable-2m',        'HDMI 2.0 Cable 2 m',           'PixelPro',        449, 649, '2 m',    '2 m',      '4K@60Hz HDMI cable with gold-plated connectors.', 'electronics',                       75],
);

/* ------------------------------- STATIONERY ------------------------------ */
P.push(
  ['stationery','notebook-200p',        'Hardbound Notebook 200 Pages', 'InkCraft',        145, 180, '1 pc',   '200 pages','Single-line hardbound notebook, 70 GSM paper, lay-flat binding.', 'stationery bestseller',            120],
  ['stationery','notebook-set-5',       'Notebook Set (5 pcs, 100 p)',  'BrightLeaf',      245, 320, '5 pcs',  '500 pages','Five 100-page ruled notebooks — the exam-season pack.', 'stationery bestseller',            100],
  ['stationery','spiral-notebook',      'Spiral Notebook 120 Pages',    'InkCraft',         95, 125, '1 pc',   '120 pages','Twin-wire spiral notebook with micro-perforated pages.', 'stationery under99',               130],
  ['stationery','gel-pen-blue-10',      'Gel Pens Blue (10 pcs)',       'InkCraft',        125, 160, '10 pcs', '0.7 mm',   'Smooth-flow gel pens, 0.7 mm tip, quick-dry ink.', 'stationery bestseller',            140],
  ['stationery','ball-pen-mixed-10',    'Ball Pens Assorted (10 pcs)',  'BrightLeaf',       85, 115, '10 pcs', '0.7 mm',   'Mixed blue, black and red ball pens for office use.', 'stationery under99',               150],
  ['stationery','marker-set-10',        'Sketch Markers (10 colours)',  'BrightLeaf',      245, 320, '10 pcs', '10 pcs',   'Dual-tip alcohol-free markers for journaling and sketching.', 'stationery',                        90],
  ['stationery','highlighter-set-5',    'Highlighters (5 colours)',     'InkCraft',        165, 210, '5 pcs',  '5 pcs',    'Chisel-tip pastel highlighters that do not bleed through 70 GSM paper.', 'stationery',                        95],
  ['stationery','pencil-hb-10',         'HB Pencils (10 pcs)',          'InkCraft',         65,  90, '10 pcs', '10 pcs',   'Pre-sharpened cedar pencils with a break-resistant core.', 'stationery under99',               160],
  ['stationery','eraser-3pc',           'Non-Smudge Erasers (3 pcs)',   'InkCraft',         45,  60, '3 pcs',  '3 pcs',    'Dust-free erasers that lift graphite without tearing paper.', 'stationery under99',               150],
  ['stationery','sharpener-2pc',        'Metal Sharpeners (2 pcs)',     'InkCraft',         35,  50, '2 pcs',  '2 pcs',    'Nickel-plated blade sharpeners with a compact body.', 'stationery under99',               170],
  ['stationery','geometry-box',         'Geometry Box',                 'BrightLeaf',      195, 250, '1 pc',   '9 pcs',    'Compass, dividers, set squares, protractor and scale in a metal case.', 'stationery',                        80],
  ['stationery','folder-a4-5',          'Cardboard Folders A4 (5 pcs)', 'BrightLeaf',      185, 240, '5 pcs',  '5 pcs',    'Laminated A4 folders with an index tab and elastic closure.', 'stationery',                        85],
  ['stationery','stapler-small',        'Stapler with 1000 Pins',       'BrightLeaf',      175, 225, '1 pc',   '1 pc',     'Compact metal stapler, 20-sheet capacity, pins included.', 'stationery',                        90],
  ['stationery','sticky-notes-5',       'Sticky Notes (5 pads)',        'InkCraft',        125, 165, '5 pads', '100 sheets','Five 3x3 inch pads in assorted neon colours.', 'stationery under99',               120],
  ['stationery','glue-stick-3',         'Glue Sticks (3 pcs)',          'BrightLeaf',       95, 125, '3 pcs',  '3 x 8 g',  'Washable, acid-free glue sticks for craft and schoolwork.', 'stationery under99',               130],
  ['stationery','sketchbook-a4',        'Sketchbook A4 (60 sheets)',    'BrightLeaf',      225, 285, '1 pc',   '60 sheets','130 GSM cartridge paper, hardback, spiral bound.', 'stationery new',                    70],
  ['stationery','whiteboard-marker-4',  'Whiteboard Markers (4 pcs)',   'InkCraft',        155, 199, '4 pcs',  '4 pcs',    'Low-odour refillable whiteboard markers with a chisel tip.', 'stationery',                        85],
  ['stationery','calculator-12d',       '12-Digit Desk Calculator',     'BrightLeaf',      399, 520, '1 pc',   '1 pc',     'Solar-assisted desk calculator with a tilted display and memory keys.', 'stationery',                        60],
);

/* ------------------------------ PET SUPPLIES ----------------------------- */
P.push(
  ['pet-supplies','dog-food-adult-3kg',   'Adult Dog Food — Chicken',     'Happy Paws',      899, 1099,'3 kg',  '3 kg',     'Chicken and rice kibble for adult dogs, with omega-3 for coat health.', 'pet bestseller',                    70],
  ['pet-supplies','dog-food-puppy-1kg',   'Puppy Food — Chicken & Milk',  'Happy Paws',      499, 620, '1 kg',   '1 kg',     'Small-kibble puppy food with DHA for growth, from 8 weeks.', 'pet',                               80],
  ['pet-supplies','cat-food-adult-1kg',   'Adult Cat Food — Ocean Fish',  'Happy Paws',      549, 680, '1 kg',   '1 kg',     'Fish-based dry cat food with taurine and reduced magnesium.', 'pet bestseller',                    75],
  ['pet-supplies','dog-treats-200g',      'Chicken Jerky Dog Treats',     'Happy Paws',      295, 360, '200 g',  '200 g',    'Grain-free chicken strips, no artificial preservatives.', 'pet',                               90],
  ['pet-supplies','cat-treats-100g',      'Creamy Cat Treats',            'Happy Paws',      195, 245, '100 g',  '100 g',    'Squeeze-up treats for hand-feeding and tablet masking.', 'pet',                              100],
  ['pet-supplies','pet-shampoo-250ml',    'Anti-Tick Pet Shampoo',        'Happy Paws',      275, 340, '250 ml', '250 ml',   'Neem-based pet shampoo for tick and flea control, pH 7.0.', 'pet',                               65],
  ['pet-supplies','pet-collar-m',         'Adjustable Pet Collar (M)',    'Happy Paws',      225, 295, '1 pc',   '30–45 cm', 'Nylon collar with a breakaway buckle and D-ring for tags.', 'pet under99',                       85],
  ['pet-supplies','pet-leash-1-2m',       'Retractable Pet Leash 1.2 m',  'Happy Paws',      449, 570, '1 pc',   '1.2 m',    'Locking retractable leash rated to 20 kg.', 'pet',                               55],
  ['pet-supplies','pet-bed-small',        'Pet Bed (Small, Washable)',    'Happy Paws',      749, 950, '1 pc',   '50 cm',    'Removable fleece-lined cover, machine washable, non-slip base.', 'pet',                               40],
  ['pet-supplies','litter-tray',          'Cat Litter Tray with Scoop',   'Happy Paws',      499, 640, '1 pc',   '1 pc',     'High-sided litter tray with an anti-splash rim and scoop.', 'pet',                               50],
);

/* ------------------------------ OUT OF STOCK ----------------------------- */
/* A few SKUs are intentionally out of stock so availability filters,
 * out-of-stock states and admin stock alerts have something real to show. */
P.push(
  ['groceries','ghee-1kg',             'Cow Ghee (Family Pack)',      'Krishna Dairy',   695, 795, '1 kg',   '1 kg',     'Bilona-churned cow ghee in a family-size jar. Restocking soon.', 'staple',                             0],
  ['beauty','perfume-100ml',        'Eau de Parfum — Vetiver 100 ml','Glow Lab',      1299,1599,'100 ml', '100 ml',   'The 100 ml bottle of our vetiver fragrance. Currently unavailable.', 'beauty',                             0],
  ['snacks-beverages','badam-mix-500g',       'Roasted Dry Fruit Mix 500 g',  'Tasty Roots',     645, 760, '500 g',  '500 g',    'Family pack of the roasted dry fruit mix. Back in stock next week.', 'healthy',                            0],
);

export const PRODUCTS_SEED = P;
export const PRODUCT_COUNT = P.length;
