/**
 * Notification center + customer support.
 *
 * Notifications are IN-APP ONLY: there is no push/email/SMS provider wired up,
 * and the API says so. Read state is per user, so clearing your notifications
 * never touches another account's.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitize } from '../utils/helpers.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const d = getDb();
  const rows = d.prepare(`
    SELECT n.*, CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END AS is_read
    FROM notifications n
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    WHERE n.user_id = ? OR n.user_id IS NULL
    ORDER BY n.id DESC LIMIT 100`).all(req.user.id, req.user.id);

  res.json({
    items: rows.map((n) => ({
      id: n.id, type: n.type, title: n.title, body: n.body, link: n.link,
      createdAt: n.created_at, isRead: !!n.is_read,
    })),
    unreadCount: rows.filter((n) => !n.is_read).length,
    delivery: 'in-app only — no push, email or SMS provider is configured.',
  });
});

router.post('/:id/read', asyncHandler((req, res) => {
  const d = getDb();
  const id = Number.parseInt(req.params.id, 10);
  const n = d.prepare('SELECT * FROM notifications WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(id, req.user.id);
  if (!n) throw ApiError.notFound('That notification does not exist.');
  d.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)').run(id, req.user.id);
  res.json({ ok: true });
}));

router.post('/read-all', (req, res) => {
  getDb().prepare(`INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
                   SELECT n.id, ? FROM notifications n WHERE n.user_id = ? OR n.user_id IS NULL`)
    .run(req.user.id, req.user.id);
  res.json({ ok: true });
});

router.delete('/', (req, res) => {
  const info = getDb().prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true, cleared: info.changes });
});

/* ------------------------------ support ---------------------------------- */
const support = express.Router();
support.use(requireAuth);

support.get('/tickets', (req, res) => {
  res.json({
    items: getDb().prepare('SELECT id, subject, message, status, created_at FROM support_tickets WHERE user_id = ? ORDER BY id DESC')
      .all(req.user.id),
  });
});

support.post('/tickets', asyncHandler((req, res) => {
  const d = getDb();
  const subject = sanitize(req.body?.subject, 120);
  const message = sanitize(req.body?.message, 4000);
  if (!subject || subject.length < 4) throw ApiError.unprocessable('Please add a subject (at least 4 characters).');
  if (!message || message.length < 10) throw ApiError.unprocessable('Please describe the issue in a little more detail.');

  let orderId = null;
  if (req.body?.orderNumber) {
    const o = d.prepare('SELECT id FROM orders WHERE order_number = ? AND user_id = ?').get(req.body.orderNumber, req.user.id);
    if (!o) throw ApiError.notFound('That order number is not in your account.');
    orderId = o.id;
  }

  const info = d.prepare('INSERT INTO support_tickets (user_id, email, subject, message, order_id) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.user.email, subject, message, orderId);
  d.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, 'support', 'Support request received',
      'This is an in-app demo ticket — no email has been sent. Our demo team will not reply.', '/support');

  res.status(201).json({
    id: info.lastInsertRowid,
    note: 'Stored locally as a demo ticket. No email or external ticketing system is connected.',
  });
}));

export { support as supportRouter };
export default router;
