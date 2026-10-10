/**
 * Error boundary: a render crash anywhere in the tree shows a recoverable panel
 * instead of a blank white screen.
 */
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Logged to the browser console; nothing sensitive is captured.
    console.error('[food-express] render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page">
        <div className="empty">
          <div className="empty-icon" style={{ background: 'var(--fe-danger-light)', color: 'var(--fe-danger)' }} aria-hidden="true">⚠</div>
          <h3>This page hit an unexpected error</h3>
          <p>The rest of Food Express is unaffected. Reloading usually clears it; if it keeps happening, tell us what you were doing.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn" onClick={() => { this.setState({ error: null }); window.location.assign('/'); }}>
              Back to home
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
