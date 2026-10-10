/**
 * Food Express — Express server.
 *
 * Serves the REST API under /api and the built React app (client/dist) at /.
 * In development the Vite dev server proxies /api here, so both run from one
 * origin and the session cookie works without CORS gymnastics.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getDb, seed } from './db/index.js';
import { attachUser } from './middleware/auth.js';
import { attachCartOwner } from './middleware/session.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';
import { settingsMap } from './utils/settings.js';

import catalogRoutes from './routes/catalog.js';
import authRoutes from './routes/auth.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import accountRoutes from './routes/account.js';
import notificationRoutes, { supportRouter } from './routes/notifications.js';
import locationRoutes from './routes/location.js';
import adminRoutes from './routes/admin.js';
import imageRoutes from './routes/images.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENT_DIST = path.join(ROOT, 'client', 'dist');

export function createApp() {
  // Guarantee a seeded database on boot so a fresh clone just works.
  seed();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Inline styles/SVG artwork: the design system uses CSS custom properties
        // and the catalogue ships generated inline SVG images.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  // Session + guest cart identity for every request.
  app.use(attachUser);
  app.use(attachCartOwner);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'food-express-api', time: new Date().toISOString() });
  });

  /** Public app configuration the client needs before first paint. */
  app.get('/api/config', (_req, res) => {
    const d = getDb();
    const s = settingsMap(d);
    res.json({
      appName: s.app_name || 'Food Express',
      currency: s.currency || 'INR',
      freeDeliveryThreshold: s.free_delivery_threshold_paise,
      deliveryFee: s.delivery_fee_paise,
      handlingFee: s.handling_fee_paise,
      demoMode: !!s.demo_mode,
      demoPayments: !!s.demo_payments_enabled,
      simulatedTracking: !!s.simulated_order_tracking,
      couponsAreDemo: !!s.coupons_are_demo,
      supportEmail: s.support_email,
      supportPhone: s.support_phone,
      counts: {
        products: d.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').get().n,
        restaurants: d.prepare('SELECT COUNT(*) AS n FROM restaurants WHERE is_open = 1').get().n,
        menuItems: d.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n,
        cities: d.prepare('SELECT COUNT(*) AS n FROM cities').get().n,
      },
    });
  });

  app.use('/api/images', imageRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/support', supportRouter);
  app.use('/api/location', locationRoutes);
  app.use('/api/admin', adminRoutes);
  // Catalogue last so /api/products/sections is not shadowed by /api/products/:slug.
  app.use('/api', catalogRoutes);

  app.use('/api', notFoundHandler);

  /* ------------------------- static front-end ---------------------------- */
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
    // SPA fallback: unknown non-API paths render index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send(
        'Food Express API is running. The front-end is not built yet — run `npm run build`, or use `npm run dev` for the Vite dev server.',
      );
    });
  }

  app.use(errorHandler);
  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Food Express API listening on http://0.0.0.0:${port}`);
  });
}
