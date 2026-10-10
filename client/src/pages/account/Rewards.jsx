/** Loyalty points + history. Honest about not being redeemable for money. */
import { useEffect, useState } from 'react';
import { Endpoints } from '../../api/client.js';
import { Alert, BlockSkeleton, EmptyState } from '../../components/ui/index.jsx';
import { formatDate } from '../../utils/format.js';

export default function Rewards() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Endpoints.loyalty().then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2>Rewards &amp; loyalty</h2>

      <Alert tone="info">
        <span className="grow">
          Points are recorded by this demo build and are <b>not redeemable for money</b>. A real
          redemption flow needs a rewards ledger with server-side issuance and expiry rules.
        </span>
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <BlockSkeleton height={120} count={2} />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat"><b>{data.points}</b><span>Points balance</span></div>
            <div className="stat"><b>{data.history.length}</b><span>Ledger entries</span></div>
            <div className="stat"><b>1 pt / ₹10</b><span>Earning rate</span></div>
          </div>

          <div className="card card-pad">
            <h3 className="mb-3">Reward history</h3>
            {data.history.length === 0 ? (
              <EmptyState icon="⭐" title="No points yet"
                message="Points are added automatically when an order is placed, and reversed if that order is cancelled." />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Date</th><th>Reason</th><th className="num">Points</th></tr>
                  </thead>
                  <tbody>
                    {data.history.map((h, i) => (
                      <tr key={`${h.created_at}-${i}`}>
                        <td>{formatDate(h.created_at, true)}</td>
                        <td>{h.reason}</td>
                        <td className="num" style={{ color: h.delta >= 0 ? 'var(--fe-success)' : 'var(--fe-danger)' }}>
                          {h.delta > 0 ? '+' : ''}{h.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
