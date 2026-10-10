/**
 * Branded onboarding/loading screen.
 *
 * It is tied to real progress (config → categories → product rails) rather than
 * a timer, fades out as soon as that work lands, and only plays once per browser
 * session. On failure it offers a retry instead of spinning forever.
 */
import { useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';

const MESSAGES = [
  'Fresh groceries, delivered to your door.',
  'Your favourites are just a tap away.',
  'Preparing your shopping experience…',
  'Checking delivery availability near you…',
];

const STEPS = [
  'Loading store configuration',
  'Loading categories',
  'Loading product catalog',
  'Almost there',
];

export default function Splash() {
  const { splash, phase, error, boot, config } = useApp();

  // Reserve space for the mobile bottom nav while the app is behind the splash.
  useEffect(() => {
    document.body.classList.add('has-mobnav');
    return () => document.body.classList.remove('has-mobnav');
  }, []);

  if (!splash.visible) return null;

  const step = phase === 'error' ? 'Could not finish starting' : STEPS[Math.min(STEPS.length - 1, splash.stepIndex)];

  return (
    <div className={`splash${phase === 'ready' ? ' hide' : ''}`} role="status" aria-live="polite" aria-label="Loading Food Express">
      <div className="splash-inner">
        <div className="splash-logo" aria-hidden="true">
          {/* Scooter + bag illustration, drawn inline so it needs no assets. */}
          <svg width="54" height="54" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="scooter">
            <circle cx="16" cy="46" r="7" />
            <circle cx="48" cy="46" r="7" />
            <path d="M16 46h10l8-14h10" />
            <path d="M30 32h8l4 14" />
            <path d="M40 18h10l2 14" />
            <path d="M38 18v-6h10" />
          </svg>
        </div>

        <h1>Food Express</h1>
        <p style={{ opacity: .85, marginBottom: 4, fontSize: 13.5 }}>Groceries · Food · Daily essentials</p>

        <div className="splash-msg" key={splash.stepIndex}>
          {MESSAGES[splash.stepIndex % MESSAGES.length]}
        </div>

        <div className="splash-bar">
          <div className="splash-fill" style={{ width: `${phase === 'error' ? 100 : splash.progress}%` }} />
        </div>
        <div className="splash-step">{step}</div>

        {phase === 'error' && (
          <div className="splash-retry">
            <p style={{ fontSize: 13.5, opacity: .95, marginBottom: 12 }}>
              {error || 'We could not reach the Food Express service.'}
            </p>
            <button type="button" className="btn" onClick={boot}>Try again</button>
            <p style={{ fontSize: 12, opacity: .8, marginTop: 12 }}>
              Start the API with <code>npm run dev</code> or <code>npm start</code> in the project folder.
            </p>
          </div>
        )}

        {config && phase === 'ready' && (
          <p style={{ fontSize: 12, opacity: .85, marginTop: 10 }}>
            {config.counts.products} products · {config.counts.restaurants} restaurants ready
          </p>
        )}
      </div>
    </div>
  );
}
