/**
 * Wishlist. Signed-in users get the server-side list with working
 * move-to-cart; guests get a device-local list and a prompt to sign in, which
 * is honest rather than pretending the account list is populated.
 */
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import { Breadcrumbs, EmptyState, Alert } from '../components/ui/index.jsx';
import { productId } from '../utils/format.js';

export default function Wishlist() {
  const wishlist = useWishlist();
  const { user } = useAuth();
  const { addItem } = useCart();
  const toast = useToast();

  const items = wishlist.items;

  const moveAll = async () => {
    let added = 0;
    for (const item of items) {
      if (item.inStock === false) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await addItem(productId(item.id), { name: item.name });
        added += 1;
      } catch { /* toast already shown */ }
    }
    if (added > 0) toast.success(`${added} item(s) moved to your cart`);
  };

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Wishlist' }]} />

      <div className="row-between mb-4 wrap">
        <div>
          <h1>Wishlist</h1>
          <p className="muted small">{wishlist.count} saved item{wishlist.count === 1 ? '' : 's'}</p>
        </div>
        {items.length > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={moveAll}>Move all in-stock items to cart</button>
        )}
      </div>

      {wishlist.guestMode && (
        <Alert tone="info" className="mb-4">
          <span className="grow">
            You are browsing as a guest, so this wishlist is saved on this device only.{' '}
            <Link to="/login?next=%2Fwishlist">Sign in</Link> to keep it on your account across devices.
          </span>
        </Alert>
      )}

      {wishlist.loading ? (
        <ProductGrid loading skeletonCount={4} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="♡"
            title="No saved items yet"
            message="Tap the heart on any product to save it here for later."
            action={<Link to="/categories" className="btn">Browse products</Link>}
            secondaryAction={<Link to="/restaurants" className="btn btn-secondary">Order food</Link>}
          />
        </div>
      ) : (
        <ProductGrid items={items} />
      )}
    </div>
  );
}
