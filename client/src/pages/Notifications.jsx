/** Notification center. In-app only — the page says so rather than implying push. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Endpoints } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Breadcrumbs, EmptyState, ErrorState, BlockSkeleton, Alert, Tabs } from '../components/ui/index.jsx';
import { relativeTime } from '../utils/format.js';

const TYPE_ICON = { order: '🧾', account: '👤', support: '🎧', promo: '🎁', info: 'ℹ' };

export default function Notifications() {
  const toast = useToast();
  const [data, setData] = useState({ items: [], unreadCount: 0, delivery: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  const load = () => {
    setLoading(true);
    setError(null);
    Endpoints.notifications()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markRead = async (id) => {
    try {
      await Endpoints.markRead(id);
      setData((d) => ({
        ...d,
        items: d.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, d.unreadCount - 1),
      }));
    } catch (err) { toast.error(err.message); }
  };

  const markAll = async () => {
    try { await Endpoints.markAllRead(); setData((d) => ({ ...d, items: d.items.map((n) => ({ ...n, isRead: true })), unreadCount: 0 })); }
    catch (err) { toast.error(err.message); }
  };

  const clearAll = async () => {
    try { await Endpoints.clearNotifications(); load(); toast.info('Notifications cleared'); }
    catch (err) { toast.error(err.message); }
  };

  const visible = tab === 'all' ? data.items
    : tab === 'unread' ? data.items.filter((n) => !n.isRead)
      : data.items.filter((n) => n.type === tab);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]} />

      <div className="row-between mb-4 wrap">
        <div>
          <h1>Notifications</h1>
          <p className="muted small">{data.unreadCount} unread</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={markAll} disabled={data.unreadCount === 0}>
            Mark all read
          </button>
          <button type="button" className="link-btn" onClick={clearAll} disabled={data.items.length === 0}>Clear all</button>
        </div>
      </div>

      <Alert tone="info" className="mb-4">
        Notifications are delivered in-app only. No push, email or SMS provider is configured on this
        build, so nothing is sent to your phone or inbox.
      </Alert>

      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: 'All', count: data.items.length },
          { value: 'unread', label: 'Unread', count: data.unreadCount },
          { value: 'order', label: 'Orders' },
          { value: 'account', label: 'Account' },
          { value: 'support', label: 'Support' },
        ]} />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <BlockSkeleton height={80} count={3} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState icon="🔔" title="Nothing here yet"
            message="Order updates, account changes and support replies will show up here."
            action={<Link to="/" className="btn">Back to home</Link>} />
        </div>
      ) : (
        <div className="card">
          {visible.map((n) => (
            <div key={n.id} className="line" style={{
              gridTemplateColumns: '44px 1fr auto',
              background: n.isRead ? undefined : 'var(--fe-primary-light)',
              padding: '14px 16px',
            }}>
              <span className="empty-icon" style={{ width: 44, height: 44, fontSize: 20 }} aria-hidden="true">
                {TYPE_ICON[n.type] || TYPE_ICON.info}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <b>{n.title}</b>
                  {!n.isRead && <span className="badge">New</span>}
                </div>
                <p className="small muted" style={{ margin: '2px 0 4px' }}>{n.body}</p>
                <div className="row" style={{ gap: 10 }}>
                  <span className="tiny muted">{relativeTime(n.createdAt)}</span>
                  {n.link && <Link className="tiny" to={n.link}>View</Link>}
                  {!n.isRead && <button type="button" className="link-btn" onClick={() => markRead(n.id)}>Mark read</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
