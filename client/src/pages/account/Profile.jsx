/** Profile overview + edit, including an avatar upload (data URL, max ~1 MB). */
import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Icon } from '../../components/ui/index.jsx';
import { formatDate, initialsOf } from '../../utils/format.js';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(user.avatarUrl || null);
  const fileRef = useRef(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name, avatarUrl: preview });
      toast.success('Profile updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) { setError('Please choose a PNG, JPEG or WebP image.'); return; }
    if (file.size > 1_000_000) { setError('That image is larger than 1 MB. Please pick a smaller one.'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card card-pad">
        <h2 className="mb-3">Profile</h2>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <form onSubmit={save} className="col" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {preview
              ? <img src={preview} alt="Profile" className="avatar avatar-lg" />
              : <span className="avatar avatar-lg" aria-hidden="true">{initialsOf(name || user.name)}</span>}
            <div className="col" style={{ gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="fe-sr-only"
                onChange={(e) => pickAvatar(e.target.files?.[0])} />
              <div className="row wrap">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  Upload photo
                </button>
                {preview && (
                  <button type="button" className="link-btn" onClick={() => setPreview(null)}>Remove photo</button>
                )}
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>PNG, JPEG or WebP up to 1 MB. Stored as a data URL in this build.</p>
            </div>
          </div>

          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="p-name">Full name</label>
              <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="p-email">Email</label>
              <input id="p-email" className="input" value={user.email || ''} disabled />
              <span className="field-hint">
                {user.isEmailVerified ? 'Verified' : 'Not verified — email verification needs a mail provider.'}
              </span>
            </div>
            <div className="field grow">
              <label className="field-label" htmlFor="p-mobile">Mobile</label>
              <input id="p-mobile" className="input" value={user.mobile || '—'} disabled />
              <span className="field-hint">
                {user.isMobileVerified ? 'Verified' : 'OTP verification is not wired up in this build.'}
              </span>
            </div>
          </div>

          <button type="submit" className="btn" disabled={busy || name.trim().length < 2}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <h2 className="mb-3">Account summary</h2>
        <div className="stat-grid">
          <div className="stat"><b>{user.loyaltyPoints}</b><span>Loyalty points</span></div>
          <div className="stat"><b>{user.role === 'admin' ? 'Admin' : 'Customer'}</b><span>Account role</span></div>
          <div className="stat"><b>{formatDate(user.createdAt)}</b><span>Member since</span></div>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="mb-2">Delivery preferences</h2>
        <p className="small muted">
          Your chosen delivery city is stored on this device and used for availability checks and
          delivery estimates. Change it any time from the location selector in the header.
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Notification delivery is in-app only — no push or SMS provider is configured, so there is no
          per-channel preference to set yet.
        </p>
      </div>
    </div>
  );
}
