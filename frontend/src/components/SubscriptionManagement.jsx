import { useState, useEffect } from 'react';
import styles from '../styles/SubscriptionManagement.module.css';

export default function SubscriptionManagement({ userId }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  useEffect(() => {
    loadSubscriptions();
  }, [userId]);

  const loadSubscriptions = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/subscriptions/student/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load subscriptions');
      }

      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId) => {
    if (!window.confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    setCancellingId(subscriptionId);
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      setError('');
      loadSubscriptions();
      alert('Subscription cancelled successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status, isDiscontinued, priceLocked) => {
    let badgeClass = styles.statusBadge;
    let badgeText = status;

    if (isDiscontinued && priceLocked) {
      badgeClass += ` ${styles.statusLocked}`;
      badgeText = 'Price Locked';
    } else if (status === 'ACTIVE') {
      badgeClass += ` ${styles.statusActive}`;
    } else if (status === 'CANCELLED') {
      badgeClass += ` ${styles.statusCancelled}`;
    } else if (status === 'INACTIVE') {
      badgeClass += ` ${styles.statusInactive}`;
    }

    return <span className={badgeClass}>{badgeText}</span>;
  };

  if (loading) {
    return <div className={styles.container}><p>Loading subscriptions...</p></div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>My Subscriptions</h2>

      {error && <div className={styles.error}>{error}</div>}

      {subscriptions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No active subscriptions</p>
        </div>
      ) : (
        <div className={styles.subscriptionsList}>
          {subscriptions.map((sub) => {
            const priceLocked = sub.locked_price !== null;
            const displayPrice = Number(priceLocked ? sub.locked_price : sub.price);

            return (
              <div key={sub.id} className={styles.subscriptionCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.planTitle}>{sub.title}</h3>
                    <p className={styles.planDescription}>{sub.description}</p>
                  </div>
                  {getStatusBadge(sub.status, sub.is_discontinued, priceLocked)}
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Plan Price:</span>
                    <span className={styles.value}>
                      ${displayPrice.toFixed(2)}/{sub.billing_cycle}
                      {priceLocked && <span className={styles.lockedIcon}> 🔒 Price Locked</span>}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.label}>Sessions:</span>
                    <span className={styles.value}>
                      {sub.remaining_sessions} of {sub.session_count}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.label}>Start Date:</span>
                    <span className={styles.value}>{formatDate(sub.start_date)}</span>
                  </div>

                  {sub.end_date && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>End Date:</span>
                      <span className={styles.value}>{formatDate(sub.end_date)}</span>
                    </div>
                  )}

                  {sub.is_discontinued && (
                    <div className={styles.discontinuedWarning}>
                      ⚠️ This plan is no longer offered. Your price is locked at ${displayPrice.toFixed(2)}
                      until you cancel.
                    </div>
                  )}

                  {sub.cancelled_at && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Cancelled Date:</span>
                      <span className={styles.value}>{formatDate(sub.cancelled_at)}</span>
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  {sub.status === 'ACTIVE' && (
                    <button
                      className={styles.cancelButton}
                      onClick={() => handleCancelSubscription(sub.id)}
                      disabled={cancellingId === sub.id}
                    >
                      {cancellingId === sub.id ? 'Cancelling...' : 'Cancel Subscription'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
