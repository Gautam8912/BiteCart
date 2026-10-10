/**
 * Sign in with email or mobile. Errors come from the server, so a wrong
 * password is a real rejection — never a fake success.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Endpoints } from '../api/client.js';
import { Alert, Icon } from '../components/ui/index.jsx';

export default function Login() {
  const { login } = useAuth();
  const { refresh } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/account';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [googleNote, setGoogleNote] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(identifier.trim(), password);
      // The server already merges the guest cart during login; this refreshes
      // local state so the badge and totals are correct immediately.
      if (res.cartMergedFromGuest > 0) {
        toast.success(`Signed in — ${res.cartMergedFromGuest} item(s) from your guest cart were kept.`);
      } else {
        toast.success(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      }
      await refresh({ silent: true });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tryGoogle = async () => {
    setGoogleNote(null);
    try {
      await Endpoints.google();
    } catch (err) {
      // The server returns 501 with the exact config required — surface it.
      setGoogleNote(`${err.message} ${err.details?.required?.length ? `Required: ${err.details.required.join(', ')}.` : ''}`);
    }
  };

  const fillDemo = (role) => {
    if (role === 'admin') { setIdentifier('admin@foodexpress.example'); setPassword('Admin@12345'); }
    else { setIdentifier('demo@foodexpress.example'); setPassword('Customer@12345'); }
  };

  return (
    <div className="container page">
      <div className="card card-pad-lg" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div className="center mb-4">
          <span className="logo-mark" style={{ width: 48, height: 48, margin: '0 auto 12px' }} aria-hidden="true">{Icon.leaf}</span>
          <h1 style={{ fontSize: 24 }}>Welcome back</h1>
          <p className="muted small">Sign in to track orders and keep your cart across devices.</p>
        </div>

        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="identifier">Email or mobile number</label>
            <input id="identifier" className="input" value={identifier} autoComplete="username"
              onChange={(e) => setIdentifier(e.target.value)} required aria-describedby="id-hint" />
            <span className="field-hint" id="id-hint">Use the email or 10-digit mobile you registered with.</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="input-group">
              <input id="password" className="input" type={showPassword ? 'text' : 'password'} value={password}
                autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} required
                aria-invalid={!!error} />
              <button type="button" className="toggle-eye" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div className="row-between wrap">
            <span className="tiny muted">Sessions stay signed in for 7 days on this device.</span>
            <Link to="/forgot-password" className="small">Forgot password?</Link>
          </div>

          <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="row mt-4" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={tryGoogle}>Continue with Google</button>
        </div>
        {googleNote && <p className="tiny muted mt-2 center">{googleNote}</p>}

        <hr className="divider" />

        <div className="card card-pad" style={{ background: 'var(--fe-surface-2)' }}>
          <h4 className="mb-2">Demo accounts</h4>
          <p className="tiny muted mb-2">Seeded by this build so you can test both roles. Change them from the admin dashboard.</p>
          <div className="row wrap">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillDemo('customer')}>Customer</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillDemo('admin')}>Admin</button>
          </div>
          <p className="tiny muted mt-2">
            Customer: demo@foodexpress.example / Customer@12345<br />
            Admin: admin@foodexpress.example / Admin@12345
          </p>
        </div>

        <p className="center small mt-4">
          New to Food Express? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </p>
        <p className="center tiny muted">
          Or <Link to="/">continue browsing as a guest</Link> — your cart stays on this device.
        </p>
      </div>
    </div>
  );
}
