/**
 * Registration with real client-side validation and server-side duplicate
 * handling. Nothing is accepted unless the server creates the account.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Icon } from '../components/ui/index.jsx';

export default function Register() {
  const { register } = useAuth();
  const { refresh } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/account';

  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirm: '', acceptTerms: false });
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const errors = useMemo(() => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Mobile must be 10 digits starting with 6–9.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password)) e.password = 'Password must contain a letter.';
    else if (!/\d/.test(form.password)) e.password = 'Password must contain a number.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    if (!form.acceptTerms) e.acceptTerms = 'Please accept the terms to continue.';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, mobile: true, password: true, confirm: true, acceptTerms: true });
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await register({
        name: form.name.trim(), email: form.email.trim().toLowerCase(),
        mobile: form.mobile || null, password: form.password, acceptTerms: true,
      });
      if (res.cartMergedFromGuest > 0) toast.success(`Account created — ${res.cartMergedFromGuest} cart item(s) carried over.`);
      else toast.success('Account created. Welcome to Food Express!');
      await refresh({ silent: true });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const strength = useMemo(() => {
    let score = 0;
    if (form.password.length >= 8) score += 1;
    if (form.password.length >= 12) score += 1;
    if (/[A-Z]/.test(form.password) && /[a-z]/.test(form.password)) score += 1;
    if (/\d/.test(form.password)) score += 1;
    if (/[^\w\s]/.test(form.password)) score += 1;
    return score;
  }, [form.password]);

  return (
    <div className="container page">
      <div className="card card-pad-lg" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="center mb-4">
          <span className="logo-mark" style={{ width: 48, height: 48, margin: '0 auto 12px' }} aria-hidden="true">{Icon.leaf}</span>
          <h1 style={{ fontSize: 24 }}>Create your account</h1>
          <p className="muted small">Track orders, save addresses and keep your cart in sync.</p>
        </div>

        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <form onSubmit={submit} noValidate className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="name">Full name</label>
            <input id="name" className="input" value={form.name} onChange={set('name')} onBlur={blur('name')}
              aria-invalid={touched.name && !!errors.name} autoComplete="name" required />
            {touched.name && errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={form.email} onChange={set('email')}
                onBlur={blur('email')} aria-invalid={touched.email && !!errors.email} autoComplete="email" required />
              {touched.email && errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="mobile">Mobile (optional)</label>
              <input id="mobile" className="input" inputMode="numeric" maxLength={10} value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))}
                onBlur={blur('mobile')} aria-invalid={touched.mobile && !!errors.mobile} autoComplete="tel" />
              {touched.mobile && errors.mobile && <span className="field-error">{errors.mobile}</span>}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="input-group">
              <input id="password" className="input" type={showPassword ? 'text' : 'password'} value={form.password}
                onChange={set('password')} onBlur={blur('password')} aria-invalid={touched.password && !!errors.password}
                autoComplete="new-password" required aria-describedby="pw-strength" />
              <button type="button" className="toggle-eye" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <div className="row" style={{ gap: 4, marginTop: 6 }} id="pw-strength">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} style={{
                  height: 4, flex: 1, borderRadius: 999,
                  background: form.password && strength > i
                    ? (strength <= 2 ? 'var(--fe-danger)' : strength <= 3 ? 'var(--fe-warning)' : 'var(--fe-success)')
                    : 'var(--fe-border)',
                }} />
              ))}
              <span className="tiny muted" style={{ marginLeft: 8 }}>
                {['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][strength]}
              </span>
            </div>
            {touched.password && errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" className="input" type={showPassword ? 'text' : 'password'} value={form.confirm}
              onChange={set('confirm')} onBlur={blur('confirm')} aria-invalid={touched.confirm && !!errors.confirm}
              autoComplete="new-password" required />
            {touched.confirm && errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </div>

          <label className="check">
            <input type="checkbox" checked={form.acceptTerms} onChange={set('acceptTerms')} onBlur={blur('acceptTerms')} />
            <span>
              I agree to the <Link to="/policy/terms">Terms &amp; Conditions</Link> and{' '}
              <Link to="/policy/privacy">Privacy Policy</Link>.
            </span>
          </label>
          {touched.acceptTerms && errors.acceptTerms && <span className="field-error">{errors.acceptTerms}</span>}

          <button type="submit" className="btn btn-lg btn-block" disabled={busy || !valid}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="center small mt-4">
          Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
