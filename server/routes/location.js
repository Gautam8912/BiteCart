/**
 * Location API — cities, localities, PIN-code serviceability.
 *
 * Honest coverage: `status` is returned verbatim ('live-simulated', 'limited',
 * 'coming-soon'). The UI shows it as-is and checkout refuses 'coming-soon'.
 * Nothing here claims delivery is operational where it is not.
 */
import express from 'express';
import { getDb } from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = express.Router();

const cityShape = (c) => ({
  id: c.id, name: c.name, state: c.state, etaMin: c.eta_min, etaMax: c.eta_max,
  deliveryFee: c.delivery_fee_paise, pincodes: safeJson(c.pincodes),
  localities: safeJson(c.localities), status: c.status, isDefault: !!c.is_default_city,
  /** Copy shown to the user. Deliberately does not overstate availability. */
  statusLabel: {
    'live-simulated': 'Simulated live coverage (demo)',
    limited: 'Limited coverage — selected areas only',
    'coming-soon': 'Coming soon — not delivering yet',
  }[c.status] || c.status,
});

router.get('/cities', (_req, res) => {
  const cities = getDb().prepare('SELECT * FROM cities ORDER BY is_default_city DESC, name ASC').all().map(cityShape);
  res.json({ items: cities });
});

/** Local + PIN search across every configured city. */
router.get('/search', (req, res) => {
  const term = String(req.query.q || '').trim();
  if (term.length < 2) return res.json({ items: [] });
  const cities = getDb().prepare('SELECT * FROM cities ORDER BY is_default_city DESC, name ASC').all();
  const needle = term.toLowerCase();
  const items = [];
  for (const c of cities) {
    const shape = cityShape(c);
    if (c.name.toLowerCase().includes(needle)) items.push({ type: 'city', city: shape.name, state: shape.state, status: shape.status, statusLabel: shape.statusLabel, eta: `${shape.etaMin}–${shape.etaMax} min` });
    for (const loc of shape.localities) {
      if (loc.toLowerCase().includes(needle)) items.push({ type: 'locality', locality: loc, city: shape.name, state: shape.state, status: shape.status, statusLabel: shape.statusLabel, eta: `${shape.etaMin}–${shape.etaMax} min` });
    }
    if (/^\d{4,6}$/.test(term)) {
      const hit = shape.pincodes.find((p) => p.startsWith(term));
      if (hit) items.push({ type: 'pincode', pincode: hit, city: shape.name, state: shape.state, status: shape.status, statusLabel: shape.statusLabel, eta: `${shape.etaMin}–${shape.etaMax} min` });
    }
  }
  res.json({ items: items.slice(0, 20) });
});

/** Serviceability check used by the address form and the checkout guard. */
router.get('/check', (req, res) => {
  const pincode = String(req.query.pincode || '').replace(/\D/g, '');
  if (!/^[1-9]\d{5}$/.test(pincode)) throw ApiError.unprocessable('Enter a valid 6-digit PIN code.');
  const cities = getDb().prepare('SELECT * FROM cities').all();
  const match = cities.find((c) => safeJson(c.pincodes).includes(pincode));
  if (!match) {
    return res.json({ serviceable: false, reason: 'We do not deliver to this PIN code yet.', city: null });
  }
  const shape = cityShape(match);
  res.json({
    serviceable: match.status !== 'coming-soon',
    city: shape,
    reason: match.status === 'coming-soon'
      ? `${match.name} is listed as coming soon — delivery is not operational there yet.`
      : `${match.name}: ${shape.statusLabel}.`,
  });
});

function safeJson(v) {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

export default router;
