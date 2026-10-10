/** Set a new password using a single-use reset token. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Alert } from '../components/ui/index.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = async (e) => {
    e.preventDefault();
    if (mismatch || tooShort || !token) return;
    setBusy(true);
    setError(null);
    try {
      await Endpoints.resetPassword(token, password);
      toast.success('Password updated. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="card card-pad-lg" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24 }} className="mb-2">Choose a new password</h1>
        <p className="muted small mb-4">Reset links expire after 30 minutes and can be used once.</p>

        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="rp-token">Reset token</label>
            <input id="rp-token" className="input" value={token} required onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the token from your reset link" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rp-pw">New password</label>
            <input id="rp-pw" className="input" type="password" value={password} required minLength={8}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
              aria-invalid={tooShort} />
            {tooShort && <span className="field-error">At least 8 characters, with a letter and a number.</span>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rp-confirm">Confirm new password</label>
            <input id="rp-confirm" className="input" type="password" value={confirm} required
              onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
            {mismatch && <span className="field-error">Passwords do not match.</span>}
          </div>
          <button type="submit" className="btn btn-block" disabled={busy || mismatch || tooShort || !token}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="center small mt-4">
          Link expired? <Link to="/forgot-password">Request a new one</Link>
        </p>
      </div>
    </div>
  );
}
