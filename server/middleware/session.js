/**
 * Guest session identity.
 *
 * Signed-in users own their cart by user id. Guests get an anonymous session id
 * in a non-httpOnly cookie (it holds no secrets — it is only a cart key). On
 * login the guest cart is merged into the user's cart and the guest key deleted.
 */
import crypto from 'node:crypto';

const GUEST_COOKIE = 'fe_guest';

export function attachCartOwner(req, res, next) {
  if (req.user) {
    req.cartOwnerKey = `u:${req.user.id}`;
    req.isGuestCart = false;
    return next();
  }
  let sid = req.cookies?.[GUEST_COOKIE];
  if (!sid || !/^[a-f0-9]{32}$/.test(sid)) {
    sid = crypto.randomBytes(16).toString('hex');
    res.cookie(GUEST_COOKIE, sid, { httpOnly: false, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
  }
  req.cartOwnerKey = `s:${sid}`;
  req.guestSessionId = sid;
  req.isGuestCart = true;
  next();
}

export const GUEST_COOKIE_NAME = GUEST_COOKIE;
