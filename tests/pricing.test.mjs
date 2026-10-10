/**
 * Unit tests for the bill engine — the code that owns the ₹150 free-delivery
 * rule, coupon math and tax. Runs against the pure function in
 * server/utils/pricing.js (no DB, no HTTP).
 *
 *   npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeBill, deliveryProgress, couponProblems } from '../server/utils/pricing.js';

const SETTINGS = {
  free_delivery_threshold_paise: 15000, // ₹150
  delivery_fee_paise: 2900,             // ₹29
  handling_fee_paise: 0,
  gst_grocery_percent: 0,
  gst_restaurant_percent: 5,
  loyalty_points_per_rupee: 0.1,
};

const item = (price, quantity = 1, extra = {}) => ({ pricePaise: price, mrpPaise: price, quantity, ...extra });
const rupees = (n) => n * 100;

describe('free-delivery threshold (₹150 business rule)', () => {
  test('₹80 subtotal asks for exactly ₹70 more', () => {
    const bill = computeBill([item(rupees(80))], SETTINGS);
    assert.equal(bill.delivery.remaining, rupees(70));
    assert.equal(bill.delivery.unlocked, false);
    assert.equal(bill.delivery.feePaise, rupees(29));
    assert.match(bill.delivery.message, /₹70 more/);
  });

  test('₹120 subtotal asks for exactly ₹30 more', () => {
    const bill = computeBill([item(rupees(120))], SETTINGS);
    assert.equal(bill.delivery.remaining, rupees(30));
    assert.match(bill.delivery.message, /₹30 more/);
    assert.equal(bill.delivery.feePaise, rupees(29));
  });

  test('₹149 says "just ₹1 more" and still charges the fee', () => {
    const bill = computeBill([item(rupees(149))], SETTINGS);
    assert.equal(bill.delivery.remaining, 100);
    assert.match(bill.delivery.message, /Just ₹1 more/);
    assert.equal(bill.delivery.unlocked, false);
    assert.equal(bill.delivery.feePaise, rupees(29));
  });

  test('exactly ₹150 unlocks free delivery', () => {
    const bill = computeBill([item(rupees(150))], SETTINGS);
    assert.equal(bill.delivery.remaining, 0);
    assert.equal(bill.delivery.unlocked, true);
    assert.equal(bill.delivery.feePaise, 0);
    assert.match(bill.delivery.message, /unlocked free delivery/);
  });

  test('₹200 stays free and the progress bar caps at 100%', () => {
    const bill = computeBill([item(rupees(200))], SETTINGS);
    assert.equal(bill.delivery.unlocked, true);
    assert.equal(bill.delivery.feePaise, 0);
    assert.equal(bill.delivery.percent, 100);
  });

  test('an empty cart never unlocks free delivery', () => {
    const bill = computeBill([], SETTINGS);
    assert.equal(bill.delivery.unlocked, false);
    assert.equal(bill.delivery.feePaise, 0); // nothing to deliver
    assert.equal(bill.totalPaise, 0);
  });

  test('multiple lines are summed before the threshold test', () => {
    const bill = computeBill([item(rupees(60), 2), item(rupees(35))], SETTINGS);
    assert.equal(bill.merchandisePaise, rupees(155));
    assert.equal(bill.delivery.unlocked, true);
    assert.equal(bill.delivery.feePaise, 0);
  });

  test('tax and handling fees do not count toward the threshold', () => {
    const withTax = { ...SETTINGS, gst_restaurant_percent: 5, handling_fee_paise: 500 };
    // ₹140 of food + 5% GST (₹7) + ₹5 handling = ₹152 total, but merchandise is ₹140.
    const bill = computeBill([item(rupees(140), 1, { kind: 'menu_item' })], withTax);
    assert.equal(bill.merchandisePaise, rupees(140));
    assert.equal(bill.delivery.unlocked, false, 'fees must not push the order over the threshold');
    assert.equal(bill.delivery.feePaise, rupees(29));
    assert.equal(bill.handlingFeePaise, 500);
    assert.equal(bill.taxPaise, 725); // 5% of (14000 merchandise + 500 handling)
    assert.equal(bill.totalPaise, rupees(140) + rupees(29) + 500 + 725);
  });

  test('the threshold is read from settings, not hard-coded', () => {
    const custom = { ...SETTINGS, free_delivery_threshold_paise: rupees(299), delivery_fee_paise: rupees(49) };
    const below = computeBill([item(rupees(200))], custom);
    assert.equal(below.delivery.unlocked, false);
    assert.equal(below.delivery.remaining, rupees(99));
    assert.equal(below.delivery.feePaise, rupees(49));
    const above = computeBill([item(rupees(300))], custom);
    assert.equal(above.delivery.unlocked, true);
    assert.equal(above.delivery.feePaise, 0);
  });

  test('a city zone fee is charged even when the ₹150 rule is met', () => {
    const bill = computeBill([item(rupees(500))], SETTINGS, null, { zoneDeliveryFeePaise: 1000 });
    assert.equal(bill.delivery.unlocked, true);
    assert.equal(bill.delivery.platformFeePaise, 0, 'platform fee waived by the ₹150 rule');
    assert.equal(bill.delivery.zoneFeePaise, 1000, 'zone surcharge still applies');
    assert.equal(bill.delivery.feePaise, 1000);
  });
});

describe('coupon engine', () => {
  const percent = { code: 'SAVE10', type: 'percent', value: 10, min_subtotal_paise: rupees(299), max_discount_paise: rupees(120), is_active: 1 };
  const flat = { code: 'FIRSTORDER', type: 'flat', value: rupees(100), min_subtotal_paise: rupees(499), is_active: 1 };
  const freeDel = { code: 'FREEDEL', type: 'free_delivery', value: 0, min_subtotal_paise: rupees(99), is_active: 1 };
  const category = { code: 'GREEN20', type: 'percent', value: 20, min_subtotal_paise: rupees(199), max_discount_paise: rupees(80), category_slug: 'fruits-vegetables', is_active: 1 };

  test('percent discount is applied and capped', () => {
    const bill = computeBill([item(rupees(2000))], SETTINGS, percent);
    assert.equal(bill.discountPaise, rupees(120), '10% of ₹2000 is ₹200 but the cap is ₹120');
    assert.equal(bill.subtotalPaise, rupees(1880));
    assert.equal(bill.couponApplied.code, 'SAVE10');
  });

  test('percent discount below the cap', () => {
    const bill = computeBill([item(rupees(500))], SETTINGS, percent);
    assert.equal(bill.discountPaise, rupees(50));
  });

  test('flat discount never exceeds the merchandise total', () => {
    const bill = computeBill([item(rupees(600))], SETTINGS, flat);
    assert.equal(bill.discountPaise, rupees(100));
    const tiny = computeBill([item(rupees(500))], SETTINGS, { ...flat, value: rupees(900) });
    assert.equal(tiny.discountPaise, rupees(500), 'discount clamped to the cart value');
    assert.ok(tiny.totalPaise >= 0);
  });

  test('a free-delivery coupon waives the fee below the threshold', () => {
    const bill = computeBill([item(rupees(120))], SETTINGS, freeDel);
    assert.equal(bill.delivery.feePaise, 0);
    assert.equal(bill.delivery.waivedByCoupon, true);
    assert.match(bill.delivery.message, /coupon/i);
  });

  test('a free-delivery coupon also waives a city zone fee', () => {
    const bill = computeBill([item(rupees(120))], SETTINGS, freeDel, { zoneDeliveryFeePaise: 1000 });
    assert.equal(bill.delivery.zoneFeePaise, 0);
    assert.equal(bill.delivery.feePaise, 0);
  });

  test('a category coupon only sees the matching category subtotal', () => {
    const cart = [item(rupees(250), 1, { categorySlug: 'fruits-vegetables' }), item(rupees(400), 1, { categorySlug: 'groceries' })];
    const bill = computeBill(cart, SETTINGS, category);
    // 20% of the ₹250 produce only = ₹50 (under the ₹80 cap).
    assert.equal(bill.discountPaise, rupees(50));
  });

  test('a category coupon is rejected when the category is absent', () => {
    const bill = computeBill([item(rupees(900), 1, { categorySlug: 'groceries' })], SETTINGS, category);
    assert.equal(bill.discountPaise, 0);
    assert.equal(bill.couponApplied, null);
    assert.match(bill.couponError, /fruits-vegetables/);
  });

  test('minimum spend is enforced', () => {
    const bill = computeBill([item(rupees(200))], SETTINGS, flat);
    assert.equal(bill.couponApplied, null);
    assert.match(bill.couponError, /Add ₹299 more/);
  });

  test('expired and inactive coupons are refused', () => {
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ');
    assert.match(couponProblems({ ...percent, expires_at: past }, rupees(900), rupees(900)), /expired/);
    assert.match(couponProblems({ ...percent, is_active: 0 }, rupees(900), rupees(900)), /not active/);
    assert.equal(couponProblems(percent, rupees(900), rupees(900)), null);
  });

  test('totals always reconcile: subtotal + fees + tax = total', () => {
    for (const subtotal of [80, 149, 150, 299, 999]) {
      const bill = computeBill([item(rupees(subtotal), 1, { kind: 'menu_item' })], { ...SETTINGS, gst_restaurant_percent: 5 });
      assert.equal(
        bill.subtotalPaise + bill.delivery.feePaise + bill.handlingFeePaise + bill.taxPaise,
        bill.totalPaise,
        `bill did not reconcile at ₹${subtotal}`,
      );
    }
  });
});

describe('deliveryProgress()', () => {
  test('percent scales correctly and never exceeds 100', () => {
    assert.equal(deliveryProgress(0, SETTINGS).percent, 0);
    assert.equal(deliveryProgress(7500, SETTINGS).percent, 50);
    assert.equal(deliveryProgress(15000, SETTINGS).percent, 100);
    assert.equal(deliveryProgress(99999, SETTINGS).percent, 100);
  });
});
