/** Change password + privacy/security transparency. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Endpoints } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert } from '../../components/ui/index.jsx';

export default function Security() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const mismatch = form.confirm.length > 0 && form.confirm !== form.newPassword;
  const weak = form.newPassword.length > 0 && (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword));

  const submit = async (e) => {
    e.preventDefault();
    if (mismatch || weak) return;
    setBusy(true);
    setError(null);
    try {
      await Endpoints.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed. Please sign in again.');
      await logout();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card card-pad">
        <h2 className="mb-3">Change password</h2>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <form onSubmit={submit} className="col" style={{ gap: 12, maxWidth: 460 }}>
          <div className="field">
            <label className="field-label" htmlFor="cp-current">Current password</label>
            <input id="cp-current" className="input" type="password" required autoComplete="current-password"
              value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cp-new">New password</label>
            <input id="cp-new" className="input" type="password" required minLength={8} autoComplete="new-password"
              value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              aria-invalid={weak} />
            {weak && <span className="field-error">At least 8 characters, including a letter and a number.</span>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cp-confirm">Confirm new password</label>
            <input id="cp-confirm" className="input" type="password" required autoComplete="new-password"
              value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              aria-invalid={mismatch} />
            {mismatch && <span className="field-error">Passwords do not match.</span>}
          </div>
          <button type="submit" className="btn" disabled={busy || mismatch || weak || !form.currentPassword}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
          <p className="tiny muted">You will be signed out after changing your password.</p>
        </form>
      </div>

      <div className="card card-pad">
        <h2 className="mb-3">How this build protects your data</h2>
        <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Passwords are stored only as bcrypt hashes (cost 10) — never in plain text, never in the frontend.</li>
          <li>Sessions use an httpOnly, SameSite=Lax cookie, so page scripts cannot read the token.</li>
          <li>Roles are re-read from the database on every admin request; hiding a button in the UI grants nothing.</li>
          <li>Addresses, orders and wishlists are queried with your user id, so another account cannot read them.</li>
          <li>No API keys or payment secrets are committed. Configuration comes from environment variables.</li>
        </ul>
        <p className="small muted mt-3">
          Not yet implemented: email/mobile verification, rate-limited OTP flows, two-factor
          authentication and a real payment vault. Read the <Link to="/policy/privacy">privacy policy</Link>{' '}
          for the full picture.
        </p>
      </div>

      <div className="card card-pad">
        <h2 className="mb-2">Sessions</h2>
        <p className="small muted">
          Signed in as <b>{user.email || user.mobile}</b>. Sessions last 7 days. Signing out clears the
          session cookie on this device; it does not invalidate sessions on other devices (that needs a
          server-side session store).
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Sign out of this device</button>
      </div>
    </div>
  );
}
