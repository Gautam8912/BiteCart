/**
 * Cart state.
 *
 * The server is authoritative: every mutation returns the recomputed cart
 * (lines + bill + free-delivery progress) and we store exactly that. The badge
 * count is also updated optimistically so it moves on the same click, and is
 * corrected by the server response a moment later.
 *
 * Guests and signed-in users share this code path — the server decides whose
 * cart the request belongs to, so no cart logic is duplicated here.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Endpoints } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { normalizeOptions } from '../utils/format.js';

const CartContext = createContext(null);

const EMPTY = {
  items: [], saved: [], unavailable: [],
  bill: {
    merchandisePaise: 0, discountPaise: 0, subtotalPaise: 0, taxPaise: 0, totalPaise: 0,
    handlingFeePaise: 0, itemCount: 0, savingsPaise: 0, productSavingsPaise: 0,
    delivery: { threshold: 15000, remaining: 15000, unlocked: false, percent: 0, feePaise: 0, message: '' },
  },
  restaurant: null, settings: { freeDeliveryThreshold: 15000, deliveryFee: 2900, handlingFee: 0 },
  isEmpty: true, couponCode: null,
};

export function CartProvider({ children }) {
  const { user, status } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState(null); // itemId currently mutating
  const inFlight = useRef(0);

  const applyCart = useCallback((next) => {
    if (next && Array.isArray(next.items)) setCart(next);
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      applyCart(await Endpoints.cart());
    } catch (err) {
      if (!silent) toast.error(err.message || 'Could not load your cart.');
    } finally {
      setLoading(false);
    }
  }, [applyCart, toast]);

  // Load once, and again when the session changes (login/logout/merge).
  useEffect(() => {
    if (status === 'loading') return undefined;
    refresh({ silent: true });
    return undefined;
  }, [status, user?.id, refresh]);

  const wrap = useCallback(async (fn, { successMessage } = {}) => {
    const token = ++inFlight.current;
    try {
      const res = await fn();
      applyCart(res.cart);
      if (token === inFlight.current) setPending(null);
      if (successMessage) toast.success(successMessage);
      return res;
    } catch (err) {
      if (token === inFlight.current) setPending(null);
      toast.error(err.message || 'Something went wrong.');
      throw err;
    }
  }, [applyCart, toast]);

  /** Add one unit — or increment if the line already exists. */
  const addItem = useCallback((itemId, { options = [], name } = {}) => {
    setPending(itemId);
    // Optimistic badge bump for immediate feedback.
    setCart((c) => ({
      ...c,
      bill: { ...c.bill, itemCount: c.bill.itemCount + 1 },
    }));
    return wrap(() => Endpoints.cartAdd(itemId, 1, options), { successMessage: `${name ?? 'Item'} added to cart` });
  }, [wrap]);

  const setQuantity = useCallback((itemId, quantity, options = []) => (
    wrap(() => Endpoints.cartSetQty(itemId, quantity, options))
  ), [wrap]);

  const increment = useCallback((itemId, options = []) => wrap(() => Endpoints.cartAdd(itemId, 1, options)), [wrap]);
  const decrement = useCallback((item) => {
    const next = item.quantity - 1;
    return wrap(() => (next <= 0
      ? Endpoints.cartRemove(item.itemId, item.options)
      : Endpoints.cartSetQty(item.itemId, next, item.options)));
  }, [wrap]);

  const removeItem = useCallback((item) => wrap(
    () => Endpoints.cartRemove(item.itemId, item.options),
    { successMessage: `${item.name} removed` },
  ), [wrap]);

  const saveForLater = useCallback((item) => wrap(
    () => Endpoints.cartSave(item.itemId, item.options),
    { successMessage: 'Saved for later' },
  ), [wrap]);

  const moveToCart = useCallback((item) => wrap(
    () => Endpoints.cartUnsave(item.itemId, item.options),
    { successMessage: 'Moved back to cart' },
  ), [wrap]);

  const clear = useCallback(() => wrap(() => Endpoints.cartClear(), { successMessage: 'Cart cleared' }), [wrap]);

  const applyCoupon = useCallback(async (code) => {
    const trimmed = String(code || '').trim().toUpperCase();
    try {
      const res = await Endpoints.cart(trimmed);
      applyCart(res);
      if (res.bill.couponError) { toast.error(res.bill.couponError); return false; }
      toast.success(`${trimmed} applied — you saved ₹${(res.bill.discountPaise / 100).toFixed(0)}`);
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not apply that coupon.');
      return false;
    }
  }, [applyCart, toast]);

  const removeCoupon = useCallback(async () => {
    try { applyCart(await Endpoints.cart()); } catch { /* keep the previous cart */ }
  }, [applyCart]);

  /** Quantity of an item already in the cart (0 when absent). */
  const quantityOf = useCallback((itemId, options = []) => {
    const key = normalizeOptions(options);
    const line = cart.items.find((i) => i.itemId === itemId && normalizeOptions(i.options) === key);
    return line ? line.quantity : 0;
  }, [cart.items]);

  const lineOf = useCallback((itemId, options = []) => {
    const key = normalizeOptions(options);
    return cart.items.find((i) => i.itemId === itemId && normalizeOptions(i.options) === key) || null;
  }, [cart.items]);

  const mergeGuestCart = useCallback(async () => {
    const match = document.cookie.match(/(?:^|;\s*)fe_guest=([a-f0-9]{32})/);
    if (!match) return { merged: 0 };
    try {
      const res = await Endpoints.cartMerge(match[1]);
      applyCart(res.cart);
      document.cookie = 'fe_guest=; Max-Age=0; path=/';
      return res;
    } catch {
      return { merged: 0 };
    }
  }, [applyCart]);

  const value = useMemo(() => ({
    cart,
    items: cart.items,
    saved: cart.saved,
    unavailable: cart.unavailable || [],
    bill: cart.bill,
    settings: cart.settings,
    restaurant: cart.restaurant,
    count: cart.bill.itemCount,
    isEmpty: cart.isEmpty ?? cart.items.length === 0,
    loading, pending,
    drawerOpen, setDrawerOpen,
    refresh, addItem, setQuantity, increment, decrement, removeItem,
    saveForLater, moveToCart, clear, applyCoupon, removeCoupon,
    quantityOf, lineOf, mergeGuestCart,
  }), [cart, loading, pending, drawerOpen, refresh, addItem, setQuantity, increment,
    decrement, removeItem, saveForLater, moveToCart, clear, applyCoupon, removeCoupon,
    quantityOf, lineOf, mergeGuestCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
