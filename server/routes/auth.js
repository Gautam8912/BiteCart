/**
 * Authentication API.
 *
 * Passwords are bcrypt-hashed (cost 10) and never stored or returned in plain
 * text. Sessions are httpOnly cookies. On successful login the guest cart is
 * merged into the account cart (MAX per line, so quantities are not doubled).
 *
 * Google sign-in is NOT wired up: it needs a real OAuth client. The route is
 * implemented as an explicit 501 with the exact configuration required, rather
 * than pretending to succeed. See README → "Backend configuration still needed".
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db/index.js';
import { signToken, cookieOptions, COOKIE_NAME, requireAuth } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { isValidEmail, isValidIndianMobile, passwordProblems, sanitize } from '../utils/helpers.js';
import { mergeCarts } from '../utils/cart.js';

const router = express.Router();

/**
 * Brute-force protection for the credential endpoints.
 *
 * The limit is configurable so the integration test suite (which legitimately
 * signs in dozens of times in a few seconds) can raise it via FE_AUTH_RATE_LIMIT.
 * It stays at 25 per 15 minutes by default, which is what a human needs.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.FE_AUTH_RATE_LIMIT || 25),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.', code: 'RATE_LIMITED' },
});

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role,
  avatarUrl: u.avatar_url, loyaltyPoints: u.loyalty_points,
  isEmailVerified: !!u.is_email_verified, isMobileVerified: !!u.is_mobile_verified,
  createdAt: u.created_at,
});

function loginResponse(req, res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  return { user: publicUser(user), token };
}

function notify(userId, type, title, body, link = null) {
  getDb().prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, body, link);
}

/* ------------------------------ registration ----------------------------- */
router.post('/register', authLimiter, asyncHandler((req, res) => {
  const d = getDb();
  const name = sanitize(req.body?.name, 60);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const mobileRaw = String(req.body?.mobile || '').replace(/\D/g, '');
  const mobile = mobileRaw ? mobileRaw.slice(-10) : null;
  const password = String(req.body?.password || '');

  if (!name || name.length < 2) throw ApiError.unprocessable('Please enter your full name.');
  if (!isValidEmail(email)) throw ApiError.unprocessable('Please enter a valid email address.');
  if (mobile && !isValidIndianMobile(mobile)) throw ApiError.unprocessable('Mobile number must be 10 digits starting with 6–9.');

  const problems = passwordProblems(password);
  if (problems.length) throw ApiError.unprocessable(problems.join(' '), { field: 'password' });
  if (!req.body?.acceptTerms) throw ApiError.unprocessable('Please accept the Terms and Privacy Policy to continue.');

  const dupEmail = d.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (dupEmail) throw ApiError.conflict('An account with this email already exists. Try signing in instead.');
  if (mobile) {
    const dupMobile = d.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
    if (dupMobile) throw ApiError.conflict('An account with this mobile number already exists.');
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = d.prepare(`INSERT INTO users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, 'customer')`)
    .run(name, email, mobile, hash);
  const user = d.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  notify(user.id, 'account', 'Welcome to Food Express',
    'Your account is ready. Add a delivery address to start ordering.', '/account/addresses');

  // Bring the guest cart across.
  const guestKey = req.cartOwnerKey?.startsWith('s:') ? req.cartOwnerKey : null;
  const merged = guestKey ? mergeCarts(`u:${user.id}`, guestKey).merged : 0;

  res.status(201).json({ ...loginResponse(req, res, user), cartMergedFromGuest: merged });
}));

/* --------------------------------- login --------------------------------- */
router.post('/login', authLimiter, asyncHandler((req, res) => {
  const d = getDb();
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!identifier || !password) throw ApiError.unprocessable('Enter your email or mobile number and password.');

  const isMobile = /^\d{10}$/.test(identifier);
  const user = isMobile
    ? d.prepare('SELECT * FROM users WHERE mobile = ?').get(identifier)
    : d.prepare('SELECT * FROM users WHERE email = ?').get(identifier);

  // Same message for unknown account and wrong password: no account enumeration.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw ApiError.unauthorized('Incorrect credentials. Please check and try again.');
  }

  const guestKey = req.cartOwnerKey?.startsWith('s:') ? req.cartOwnerKey : null;
  const merged = guestKey ? mergeCarts(`u:${user.id}`, guestKey).merged : 0;

  res.json({ ...loginResponse(req, res, user), cartMergedFromGuest: merged });
}));

/* --------------------------- google sign-in stub ------------------------- */
router.post('/google', (_req, res) => {
  res.status(501).json({
    error: 'Google sign-in is not configured on this server.',
    code: 'PROVIDER_NOT_CONFIGURED',
    required: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FE_REDIRECT_URI'],
    note: 'This endpoint deliberately fails instead of reporting a fake success.',
  });
});

/* --------------------------------- me ------------------------------------ */
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

/* ------------------------------- logout ---------------------------------- */
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

/* --------------------------- password reset ------------------------------ */
/**
 * Demo reset flow: the reset token is RETURNED to the caller because there is no
 * email provider configured. In production, wire a mailer here and stop
 * returning the token. The token is stored hashed, single-use, 30-minute TTL.
 */
router.post('/forgot-password', authLimiter, asyncHandler((req, res) => {
  const d = getDb();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) throw ApiError.unprocessable('Please enter a valid email address.');
  const user = d.prepare('SELECT id FROM users WHERE email = ?').get(email);

  // Always answer the same way, whether or not the account exists.
  const response = { ok: true, message: 'If an account exists for that email, a reset link has been generated.' };
  if (!user) return res.json(response);

  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  d.prepare(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, datetime('now','+30 minutes'))`)
    .run(user.id, tokenHash);

  res.json({ ...response, demoResetToken: token, demo: true });
}));

router.post('/reset-password', authLimiter, asyncHandler((req, res) => {
  const d = getDb();
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const problems = passwordProblems(password);
  if (problems.length) throw ApiError.unprocessable(problems.join(' '));
  if (!token) throw ApiError.unprocessable('Reset token is missing.');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = d.prepare(`SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`)
    .get(tokenHash);
  if (!row) throw ApiError.unprocessable('That reset link is invalid or has expired. Request a new one.');

  d.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), row.user_id);
  d.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  notify(row.user_id, 'account', 'Password changed', 'Your Food Express password was reset. If this was not you, contact support.', '/support');
  res.json({ ok: true });
}));

/* --------------------------- profile & password -------------------------- */
router.patch('/profile', requireAuth, asyncHandler((req, res) => {
  const d = getDb();
  const name = sanitize(req.body?.name, 60) ?? req.user.name;
  if (name.length < 2) throw ApiError.unprocessable('Name must be at least 2 characters.');

  // Avatar upload: accept a data URL up to 1 MB so no file storage service is
  // required in this demo. Real deployments should swap in object storage.
  let avatar = req.user.avatar_url;
  if (typeof req.body?.avatarUrl === 'string') {
    if (req.body.avatarUrl === '') avatar = null;
    else if (!req.body.avatarUrl.startsWith('data:image/')) throw ApiError.unprocessable('Avatar must be a PNG or JPEG data URL.');
    else if (req.body.avatarUrl.length > 1_400_000) throw ApiError.unprocessable('That image is too large (max about 1 MB).');
    else avatar = req.body.avatarUrl;
  }

  d.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?').run(name, avatar, req.user.id);
  res.json({ user: publicUser(d.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));

router.post('/change-password', requireAuth, authLimiter, asyncHandler((req, res) => {
  const d = getDb();
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  const user = d.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, user.password_hash)) throw ApiError.unauthorized('Your current password is incorrect.');
  const problems = passwordProblems(next);
  if (problems.length) throw ApiError.unprocessable(problems.join(' '));
  if (bcrypt.compareSync(next, user.password_hash)) throw ApiError.unprocessable('New password must be different from the current one.');
  d.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
}));

export default router;
