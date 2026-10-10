/**
 * Authentication + authorization.
 *
 * Sessions are JWTs in an httpOnly, SameSite=Lax cookie (so the browser never
 * keeps a token in JS-readable storage) with an Authorization: Bearer fallback
 * for API clients. Role checks happen HERE, on the server — hiding an admin
 * button in the UI would not be security.
 */
import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';

export const COOKIE_NAME = 'fe_session';

export function jwtSecret() {
  const secret = process.env.FE_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FE_JWT_SECRET must be set (32+ chars) in production.');
  }
  // Dev-only fallback. Never used in production because of the throw above.
  return 'food-express-dev-only-secret-change-me';
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    jwtSecret(),
    { expiresIn: process.env.FE_SESSION_TTL || '7d', issuer: 'food-express' },
  );
}

export function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req?.secure || process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[COOKIE_NAME] || null;
}

function loadUser(id) {
  return getDb()
    .prepare('SELECT id, name, email, mobile, role, avatar_url, loyalty_points, is_email_verified, is_mobile_verified, created_at FROM users WHERE id = ?')
    .get(id);
}

/** Populates req.user when a valid session exists; never rejects on its own. */
export function attachUser(req, _res, next) {
  const token = readToken(req);
  req.user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, jwtSecret(), { issuer: 'food-express' });
      const user = loadUser(payload.sub);
      if (user && (user.role === payload.role)) req.user = user;
    } catch {
      req.user = null; // expired/invalid token behaves as a guest session
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' });
  }
  next();
}

/**
 * Role guard. Roles are read from the users table on every request, so a
 * demoted admin loses access immediately.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.', code: 'FORBIDDEN' });
    }
    next();
  };
}

export const requireAdmin = requireRole('admin');
