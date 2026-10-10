/**
 * Route guard.
 *
 * NOTE: this is a UX gate, not a security boundary. It stops unauthenticated
 * users from seeing an empty shell and preserves where they were heading. The
 * actual authorization lives on the server (requireAuth / requireAdmin), which
 * re-reads the role from the database on every request.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { EmptyState } from './ui/index.jsx';

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, status } = useAuth();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  if (status === 'loading') {
    return (
      <div className="container page">
        <EmptyState icon="⏳" title="Checking your session" message="One moment while we confirm who you are." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(from)}`} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return (
      <div className="container page">
        <EmptyState
          icon="🔒"
          title="Admin access required"
          message="This area is restricted to administrator accounts. Access is verified on the server, not just hidden in the menu."
        />
      </div>
    );
  }

  return children ?? <Outlet />;
}

export default ProtectedRoute;
