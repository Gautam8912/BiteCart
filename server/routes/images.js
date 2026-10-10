/**
 * Generated product artwork.
 *
 * Instead of shipping 200+ binary photos (which would bloat the repo and break
 * offline), every SKU and dish gets a deterministic SVG built from its slug:
 * the hue comes from a hash, so the same product always looks the same while
 * the catalogue stays visually varied. Responses are gzipped and immutable.
 *
 * GET /api/images/:name.svg
 */
import express from 'express';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const router = express.Router();

/** Category-ish hue bands, picked by hashing the slug. */
const HUES = [18, 32, 45, 92, 128, 168, 196, 214, 258, 292, 330, 348];

function hash(s) {
  return crypto.createHash('sha1').update(String(s)).digest();
}

/** Escapes text for safe inclusion in SVG/XML. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name, kind) {
  const clean = String(name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (kind === 'restaurant') return 'FE';
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return 'FE';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function readableLabel(name) {
  const clean = String(name || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > 26 ? `${clean.slice(0, 25).trim()}…` : clean;
}

export function buildSvg(name, kind = 'product') {
  const h = hash(`${kind}:${name}`);
  const hue = HUES[h[0] % HUES.length];
  const sat = 42 + (h[1] % 22);
  const bg1 = `hsl(${hue} ${sat}% 96%)`;
  const bg2 = `hsl(${(hue + 24) % 360} ${sat}% 88%)`;
  const accent = `hsl(${hue} ${sat + 12}% 44%)`;
  const accentSoft = `hsl(${hue} ${sat}% 82%)`;
  const glyph = initials(name, kind);
  const label = readableLabel(name);
  const r1 = 30 + (h[2] % 26);
  const r2 = 16 + (h[3] % 20);

  const isRestaurant = kind === 'restaurant';
  const glyphSize = isRestaurant ? 40 : 34;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${esc(label)}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>
</linearGradient>
<clipPath id="c"><rect width="400" height="400"/></clipPath>
</defs>
<g clip-path="url(#c)">
<rect width="400" height="400" fill="url(#g)"/>
<circle cx="330" cy="70" r="${r1 * 2.4}" fill="${accentSoft}" opacity="0.45"/>
<circle cx="52" cy="352" r="${r2 * 2.8}" fill="${accentSoft}" opacity="0.4"/>
<rect x="0" y="300" width="400" height="100" fill="${accent}" opacity="0.10"/>
<circle cx="200" cy="168" r="${r1 + 34}" fill="#ffffff" opacity="0.72"/>
<circle cx="200" cy="168" r="${r1 + 34}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="3"/>
<text x="200" y="168" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="${glyphSize}" font-weight="700" fill="${accent}">${esc(glyph)}</text>
<text x="200" y="336" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="19" font-weight="600" fill="#22303c" opacity="0.82">${esc(label)}</text>
<text x="200" y="362" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="13" fill="#5b6b7a" opacity="0.9">${isRestaurant ? 'Food Express partner kitchen' : 'Food Express'}</text>
</g>
</svg>`;
}

router.get('/:name.svg', (req, res) => {
  const name = String(req.params.name || '').replace(/[^a-z0-9._-]/gi, '').slice(0, 80);
  if (!name) return res.status(400).type('text/plain').send('bad name');
  const kind = name.startsWith('restaurant-') ? 'restaurant' : (name.startsWith('dish-') ? 'dish' : 'product');
  const svg = buildSvg(name.replace(/^(restaurant|dish)-/, ''), kind);
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  if (acceptsGzip) {
    res.set('Content-Encoding', 'gzip');
    return res.end(zlib.gzipSync(svg, { level: 9 }));
  }
  res.end(svg);
});

export default router;
