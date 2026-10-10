/**
 * Bill engine — the single place where cart totals and the free-delivery rule
 * are computed. Both the API (authoritative) and the vitest suite call
 * `computeBill()`, so the number the user sees and the number that is charged
 * can never drift apart.
 *
 * Everything is integer paise.
 *
 * BUSINESS RULE
 *   Free delivery unlocks when the ELIGIBLE MERCHANDISE SUBTOTAL reaches the
 *   configured threshold (default ₹150 = 15000 paise). Delivery fees, handling
 *   fees and taxes never count toward the threshold.
 *   remainingAmount = max(0, threshold - eligibleSubtotal)
 */

/** Pure: computes the free-delivery state for a subtotal. */
export function deliveryProgress(subtotalPaise, settings) {
  const threshold = settings.free_delivery_threshold_paise;
  const remaining = Math.max(0, threshold - subtotalPaise);
  const unlocked = subtotalPaise >= threshold && subtotalPaise > 0;
  const percent = threshold > 0 ? Math.min(100, Math.round((subtotalPaise / threshold) * 100)) : 100;

  let message;
  if (subtotalPaise <= 0) {
    message = `Add products worth ${inr(threshold)} to unlock free delivery.`;
  } else if (remaining === 0) {
    message = 'Congratulations! You unlocked free delivery.';
  } else if (remaining <= 1000) {
    message = `Just ${inr(remaining)} more to unlock free delivery!`;
  } else {
    message = `Add products worth ${inr(remaining)} more to unlock free delivery.`;
  }
  return { threshold, remaining, unlocked, percent, message };
}

/**
 * Pure bill calculation.
 *
 * @param {Array<{quantity:number, pricePaise:number, categorySlug?:string}>} items
 * @param {object} settings      rows from the settings table (numbers)
 * @param {object|null} coupon   validated coupon row (or null)
 * @param {object} [opts]
 * @param {number} [opts.zoneDeliveryFeePaise] minimum delivery charge configured for the
 *        selected city/zone. It is a floor, not a replacement: the ₹150 rule still
 *        removes the platform fee, but a zone surcharge (e.g. Visakhapatnam ₹10) is
 *        still charged. Free-delivery coupons waive it as well.
 * @returns {object} complete, reconciled bill
 */
export function computeBill(items, settings, coupon = null, opts = {}) {
  const list = (items || []).filter((i) => i && Number(i.quantity) > 0 && Number(i.pricePaise) >= 0);

  const merchandise = list.reduce((sum, i) => sum + i.pricePaise * i.quantity, 0);
  const mrp = list.reduce((sum, i) => sum + (i.mrpPaise ?? i.pricePaise) * i.quantity, 0);
  const productSavings = Math.max(0, mrp - merchandise);

  /* ---- coupon eligibility ------------------------------------------------ */
  let couponDiscount = 0;
  let couponApplied = null;
  let couponError = null;

  if (coupon) {
    const eligible = couponCategorySubtotal(list, coupon.category_slug);
    const problems = couponProblems(coupon, eligible, merchandise);
    if (problems) {
      couponError = problems;
    } else {
      if (coupon.type === 'percent') {
        couponDiscount = Math.floor((eligible * coupon.value) / 100);
        if (coupon.max_discount_paise != null) couponDiscount = Math.min(couponDiscount, coupon.max_discount_paise);
      } else if (coupon.type === 'flat') {
        couponDiscount = Math.min(coupon.value, eligible);
      }
      // never discount past the merchandise total
      couponDiscount = Math.max(0, Math.min(couponDiscount, merchandise));
      couponApplied = {
        code: coupon.code,
        title: coupon.title,
        type: coupon.type,
        value: coupon.value,
        discountPaise: couponDiscount,
        freeDelivery: coupon.type === 'free_delivery',
        is_demo: !!coupon.is_demo,
      };
    }
  }

  const subtotal = Math.max(0, merchandise - couponDiscount);

  /* ---- free delivery threshold ------------------------------------------ */
  // Eligible merchandise subtotal = post-coupon subtotal (coupons do count toward
  // the threshold; only fees/taxes are excluded).
  const progress = deliveryProgress(subtotal, settings);

  const couponWaivesDelivery = !!couponApplied && couponApplied.freeDelivery;
  const platformFee = (subtotal <= 0 || progress.unlocked || couponWaivesDelivery)
    ? 0
    : (settings.delivery_fee_paise || 0);
  const zoneFee = couponWaivesDelivery || subtotal <= 0 ? 0 : Math.max(0, Number(opts.zoneDeliveryFeePaise) || 0);
  const deliveryFee = platformFee + zoneFee;

  const handlingFee = subtotal <= 0 ? 0 : (settings.handling_fee_paise || 0);

  /* ---- tax ---------------------------------------------------------------- */
  const isFood = list.some((i) => i.kind === 'menu_item');
  const taxRate = isFood ? (settings.gst_restaurant_percent || 0) : (settings.gst_grocery_percent || 0);
  const tax = Math.round(((subtotal + handlingFee) * taxRate) / 100);

  const total = Math.max(0, subtotal + deliveryFee + handlingFee + tax);

  return {
    merchandisePaise: merchandise,
    mrpPaise: mrp,
    productSavingsPaise: productSavings,
    discountPaise: couponDiscount,
    couponApplied,
    couponError,
    subtotalPaise: subtotal,
    delivery: {
      ...progress,
      feePaise: deliveryFee,
      platformFeePaise: platformFee,
      zoneFeePaise: zoneFee,
      waivedByCoupon: couponWaivesDelivery,
      message: couponWaivesDelivery
        ? 'Free delivery applied by your coupon.'
        : progress.message,
    },
    handlingFeePaise: handlingFee,
    taxPaise: tax,
    taxRate,
    totalPaise: total,
    itemCount: list.reduce((n, i) => n + i.quantity, 0),
    savingsPaise: productSavings + couponDiscount,
  };
}

/**
 * Validation rules for a coupon. Returns an error string when it cannot be
 * applied, or null when it can. Used by both /api/cart and /api/checkout so the
 * "Apply coupon" preview and the final charge always agree.
 */
export function couponProblems(coupon, eligibleSubtotalPaise, cartSubtotalPaise) {
  if (!coupon) return 'Coupon not found.';
  if (!coupon.is_active) return `${coupon.code} is not active.`;
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at.replace(' ', 'T') + 'Z') > now) return `${coupon.code} has not started yet.`;
  if (coupon.expires_at && new Date(coupon.expires_at.replace(' ', 'T') + 'Z') < now) return `${coupon.code} has expired.`;
  if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) return `${coupon.code} has reached its usage limit.`;

  const base = coupon.category_slug ? eligibleSubtotalPaise : cartSubtotalPaise;
  if (coupon.category_slug && eligibleSubtotalPaise <= 0) {
    return `${coupon.code} applies only to ${coupon.category_slug} items — none in your cart.`;
  }
  if (base < coupon.min_subtotal_paise) {
    return `Add ${inr(coupon.min_subtotal_paise - base)} more to use ${coupon.code}.`;
  }
  return null;
}

/** Subtotal restricted to one category (for category-scoped coupons). */
export function couponCategorySubtotal(items, categorySlug) {
  if (!categorySlug) return items.reduce((s, i) => s + i.pricePaise * i.quantity, 0);
  return items
    .filter((i) => i.categorySlug === categorySlug)
    .reduce((s, i) => s + i.pricePaise * i.quantity, 0);
}

const inr = (paise) => `₹${(Number(paise) || 0) / 100}`;
