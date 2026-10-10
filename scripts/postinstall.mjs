#!/usr/bin/env node
/**
 * Postinstall hook: creates and seeds the SQLite database so the app runs
 * immediately after `npm install`. Safe to re-run — it skips when the
 * catalogue already exists.
 */
import { seed, getDb, closeDb } from '../server/db/index.js';

try {
  const result = seed();
  const d = getDb();
  const counts = {
    products: d.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    restaurants: d.prepare('SELECT COUNT(*) AS n FROM restaurants').get().n,
    menu_items: d.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n,
  };
  console.log(`[food-express] database ${result.skipped ? 'already seeded' : 'seeded'}`, counts);
  closeDb();
} catch (err) {
  console.error('[food-express] database seed failed:', err.message);
  console.error('[food-express] you can retry with: npm run seed');
  process.exit(1);
}
