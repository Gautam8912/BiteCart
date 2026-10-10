/**
 * Contact support. Creates a real ticket row; the response states plainly that
 * no external ticketing or email system is connected.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Breadcrumbs, Alert, EmptyState } from '../components/ui/index.jsx';
import { formatDate } from '../utils/format.js';

export default function Support() {
  const { user } = useAuth();
  const { config } = useApp();
  const toast = useToast();

  const [form, setForm] = useState({ subject: '', message: '', orderNumber: '' });
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!user) return;
    Endpoints.orders().then((r) => setOrders(r.items)).catch(() => {});
    Endpoints.tickets().then((r) => setTickets(r.items)).catch(() => {});
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await Endpoints.createTicket(form);
      setNote(res.note);
      setForm({ subject: '', message: '', orderNumber: '' });
      const list = await Endpoints.tickets();
      setTickets(list.items);
      toast.success('Support request saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact support' }]} />
      <h1 className="mb-2">Contact support</h1>
      <p className="muted mb-4">Tell us what went wrong and we will record it against your account.</p>

      <div className="checkout-layout">
        <div className="card card-pad">
          {!user ? (
            <EmptyState
              icon="🔒"
              title="Sign in to raise a ticket"
              message="Tickets are stored against your account so support can see your order history."
              action={<Link to="/login?next=%2Fsupport" className="btn">Sign in</Link>}
              secondaryAction={<Link to="/help" className="btn btn-secondary">Read the FAQs</Link>}
            />
          ) : (
            <form onSubmit={submit} className="col" style={{ gap: 14 }}>
              {error && <Alert tone="danger">{error}</Alert>}
              {note && <Alert tone="success">{note}</Alert>}

              <div className="field">
                <label className="field-label" htmlFor="s-subject">Subject</label>
                <input id="s-subject" className="input" required minLength={4} value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Missing item in my order" />
              </div>

              {orders.length > 0 && (
                <div className="field">
                  <label className="field-label" htmlFor="s-order">Related order (optional)</label>
                  <select id="s-order" className="select" value={form.orderNumber}
                    onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}>
                    <option value="">No specific order</option>
                    {orders.map((o) => (
                      <option key={o.orderNumber} value={o.orderNumber}>
                        {o.orderNumber} · {formatDate(o.placedAt)} · {o.statusLabel}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label className="field-label" htmlFor="s-message">Describe the issue</label>
                <textarea id="s-message" className="textarea" required minLength={10} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="What happened, when, and what you expected." />
              </div>

              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Sending…' : 'Send request'}
              </button>

              <p className="tiny muted">
                Support email: {config?.supportEmail ?? 'support@foodexpress.example'} ·{' '}
                {config?.supportPhone ?? '1800-000-0000'} (demo line).
              </p>
            </form>
          )}
        </div>

        <aside className="col" style={{ gap: 12 }}>
          <div className="card card-pad">
            <h2 className="mb-2">Before you write</h2>
            <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li><Link to="/help">Read the FAQs</Link> — most delivery and payment questions are answered there.</li>
              <li>Check <Link to="/orders">your order history</Link> for the current status.</li>
              <li>Read the <Link to="/policy/cancellation">refund policy</Link> for eligible cases.</li>
            </ul>
          </div>

          <div className="card card-pad">
            <h2 className="mb-2">Your tickets</h2>
            {tickets.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>No tickets yet.</p>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {tickets.map((t) => (
                  <div key={t.id} style={{ borderBottom: '1px solid var(--fe-border)', paddingBottom: 8 }}>
                    <div className="row-between">
                      <b className="small">{t.subject}</b>
                      <span className="badge badge-neutral">{t.status}</span>
                    </div>
                    <div className="tiny muted">{formatDate(t.created_at, true)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
