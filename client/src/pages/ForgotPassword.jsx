/**
 * Forgot password.
 *
 * No email provider is configured, so the server returns the reset token in the
 * response and this page displays it, clearly labelled as a development aid.
 * The token is single-use, hashed at rest and expires in 30 minutes.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Alert } from '../components/ui/index.jsx';

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await Endpoints.forgotPassword(email.trim());
      setResult(res);
      toast.success('Reset link generated');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="card card-pad-lg" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24 }} className="mb-2">Reset your password</h1>
        <p className="muted small mb-4">
          Enter the email on your account and we will generate a reset link.
        </p>

        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="fp-email">Email address</label>
            <input id="fp-email" className="input" type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <button type="submit" className="btn btn-block" disabled={busy || !email.trim()}>
            {busy ? 'Generating…' : 'Generate reset link'}
          </button>
        </form>

        {result && (
          <div className="mt-4">
            <Alert tone="info">
              <span className="grow">
                {result.message}
                {result.demoResetToken && (
                  <>
                    <div className="mt-2">
                      <b>Development reset token</b> (shown because no email provider is configured):
                    </div>
                    <code style={{ display: 'block', wordBreak: 'break-all', background: 'rgba(0,0,0,.05)', padding: 8, borderRadius: 6, marginTop: 6 }}>
                      {result.demoResetToken}
                    </code>
                  </>
                )}
              </span>
            </Alert>
            {result.demoResetToken && (
              <Link className="btn btn-block mt-3"
                to={`/reset-password?token=${encodeURIComponent(result.demoResetToken)}`}>
                Continue to set a new password
              </Link>
            )}
          </div>
        )}

        <p className="center small mt-4">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
