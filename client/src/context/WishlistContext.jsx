/**
 * Wishlist.
 *
 * Signed-in users: stored server-side in `wishlist_items`, scoped to their
 * account, so it survives across devices.
 * Guests: stored in localStorage only. The two stores are kept separate on
 * purpose — nothing is silently copied between a guest browser and an account,
 * which avoids surprising a user with items they did not save there.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Endpoints } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const WishlistContext = createContext(null);
const GUEST_KEY = 'fe.wishlist.guest.v1';

export function WishlistProvider({ children }) {
  const { user, status } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState(() => {
    if (user) return [];
    try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]'); } catch { return []; }
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const persistGuest = useCallback((next) => {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { items: list } = await Endpoints.wishlist();
      setItems(list);
      setIds(list.map((p) => p.id));
    } catch (err) {
      toast.error(err.message || 'Could not load your wishlist.');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (status === 'loading') return;
    if (user) refresh();
    else { setItems([]); setIds(JSON.parse(localStorage.getItem(GUEST_KEY) || '[]')); }
  }, [user?.id, status, refresh]);

  const has = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback(async (product) => {
    const id = product.id;
    if (has(id)) {
      if (user) {
        try { await Endpoints.wishlistRemove(id); } catch (err) { toast.error(err.message); return false; }
      } else {
        const next = ids.filter((x) => x !== id);
        setIds(next); persistGuest(next);
      }
      setItems((list) => list.filter((p) => p.id !== id));
      toast.info(`${product.name} removed from wishlist`);
      return false;
    }
    if (user) {
      try { await Endpoints.wishlistAdd(id); } catch (err) { toast.error(err.message); return false; }
      setItems((list) => [product, ...list]);
    } else {
      const next = [id, ...ids];
      setIds(next); persistGuest(next);
      setItems((list) => [product, ...list]);
    }
    toast.success(`${product.name} saved to wishlist`);
    return true;
  }, [has, ids, items, user, persistGuest, toast]);

  const remove = useCallback(async (product) => {
    if (has(product.id)) await toggle(product);
  }, [has, toggle]);

  const value = useMemo(() => ({
    ids, items, loading, has, toggle, remove, refresh,
    count: user ? items.length : ids.length,
    /** Guests only see ids; the UI falls back to a sign-in prompt for the full list. */
    guestMode: !user,
  }), [ids, items, loading, has, toggle, remove, refresh, user]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
