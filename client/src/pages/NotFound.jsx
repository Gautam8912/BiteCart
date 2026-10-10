/** 404 with useful ways forward instead of a dead end. */
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/index.jsx';

export default function NotFound() {
  return (
    <div className="container page">
      <div className="card">
        <EmptyState
          icon="🧭"
          title="We could not find that page"
          message="The link may be broken or the page may have moved. Try one of these instead."
          action={<Link to="/" className="btn">Back to home</Link>}
          secondaryAction={<Link to="/categories" className="btn btn-secondary">Browse categories</Link>}
        />
        <div className="chips" style={{ justifyContent: 'center', padding: '0 16px 32px' }}>
          <Link className="chip" to="/restaurants">Restaurants</Link>
          <Link className="chip" to="/cart">Your cart</Link>
          <Link className="chip" to="/orders">Order history</Link>
          <Link className="chip" to="/help">Help center</Link>
          <Link className="chip" to="/support">Contact support</Link>
        </div>
      </div>
    </div>
  );
}
