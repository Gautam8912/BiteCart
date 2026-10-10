/** Recently viewed products (local, capped at 12) — powers two homepage rails. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RecentlyViewedContext = createContext(null);
const KEY = 'fe.recently-viewed.v1';
const MAX = 12;

export function RecentlyViewedProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const record = useCallback((product) => {
    if (!product?.slug) return;
    setItems((list) => {
      const slim = {
        id: product.id, slug: product.slug, name: product.name, brand: product.brand,
        price: product.price, mrp: product.mrp, unit: product.unit, image: product.image,
        categorySlug: product.categorySlug, inStock: product.inStock,
        rating: product.rating, ratingCount: product.ratingCount, discountPercent: product.discountPercent,
      };
      return [slim, ...list.filter((p) => p.slug !== slim.slug)].slice(0, MAX);
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, record, clear }), [items, record, clear]);
  return <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>;
}

export function useRecentlyViewed() {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) throw new Error('useRecentlyViewed must be used inside RecentlyViewedProvider');
  return ctx;
}
