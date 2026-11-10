import { useState, useEffect } from 'react';
import styles from '../styles/SubscriptionManagement.module.css';

export default function SubscriptionManagement({ userId }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [showReactivationModal, setShowReactivationModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [reactivationStep, setReactivationStep] = useState('select'); // 'select', 'confirm', 'processing'
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

  const handleResumeSubscription = async (subscriptionId) => {
    setCancellingId(subscriptionId);
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/subscriptions/${subscriptionId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resume subscription');
      }

      setError('');
      loadSubscriptions();
      alert('Subscription resumed!');
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const loadPaymentMethods = async () => {
    if (!userId) return;
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/payments/payment-methods/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (err) {
      console.error('Error loading payment methods:', err);
    }
  };

  const openReactivationModal = async (subscription) => {
    setSelectedSubscription(subscription);
    await loadPaymentMethods();
    setReactivationStep('select');
    setSelectedPaymentMethod(null);
    setShowReactivationModal(true);
  };

  const handleReactivateSubscription = async () => {
    if (!selectedPaymentMethod || !selectedSubscription) {
      setError('Please select a payment method');
      return;
    }

    setReactivationStep('confirm');
  };

  const handleProcessReactivation = async () => {
    if (!selectedPaymentMethod || !selectedSubscription) {
      setError('Payment method or subscription missing');
      return;
    }

    setReactivationStep('processing');
    try {
      const token = localStorage.getItem('cas_jwt');
      const amount = Number(selectedSubscription.price || selectedSubscription.locked_price);

      const res = await fetch(`${apiBaseUrl}/subscriptions/${selectedSubscription.id}/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: selectedPaymentMethod.id,
          amount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Payment failed');
      }

      setError('');
      setShowReactivationModal(false);
      loadSubscriptions();
      alert('Subscription reactivated successfully!');
    } catch (err) {
      setError(err.message);
      setReactivationStep('confirm');
    }
  };

  const closeReactivationModal = () => {
    setShowReactivationModal(false);
    setSelectedSubscription(null);
    setSelectedPaymentMethod(null);
    setReactivationStep('select');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateRenewalDate = (startDate, billingCycle, endDate) => {
    // If end_date is already set, use it
    if (endDate) {
      return new Date(endDate);
    }

    // Calculate based on billing cycle
    const start = new Date(startDate);
    const renewalDate = new Date(start);

    if (billingCycle === 'MONTHLY' || billingCycle === 'month') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else if (billingCycle === 'QUARTERLY' || billingCycle === 'quarter') {
      renewalDate.setMonth(renewalDate.getMonth() + 3);
    } else if (billingCycle === 'YEARLY' || billingCycle === 'year') {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else if (billingCycle === 'WEEKLY' || billingCycle === 'week') {
      renewalDate.setDate(renewalDate.getDate() + 7);
    }

    return renewalDate;
  };

  const getStatusBadge = (status, isDiscontinued, priceLocked) => {
    let badgeClass = styles.statusBadge;
    let badgeText = status;

    if (isDiscontinued && priceLocked) {
      badgeClass += ` ${styles.statusLocked}`;
      badgeText = 'Price Locked';
    } else if (status === 'ACTIVE') {
      badgeClass += ` ${styles.statusActive}`;
    } else if (status === 'PAUSED') {
      badgeClass += ` ${styles.statusPaused}`;
      badgeText = 'Paused';
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

      {subscriptions.filter(sub => sub.status === 'ACTIVE').length === 0 ? (
        <div className={styles.emptyState}>
          <p>No active subscriptions</p>
        </div>
      ) : (
        <div className={styles.subscriptionsList}>
          {subscriptions.filter(sub => sub.status === 'ACTIVE').map((sub) => {
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

                  {sub.next_renewal_date && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Next Payment:</span>
                      <span className={styles.value}>{formatDate(sub.next_renewal_date)}</span>
                    </div>
                  )}

                  {sub.renewal_frequency && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Renewal Frequency:</span>
                      <span className={styles.value}>{sub.renewal_frequency}</span>
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
                  {sub.status === 'PAUSED' && (
                    <>
                      <button
                        className={styles.resumeButton}
                        onClick={() => handleResumeSubscription(sub.id)}
                        disabled={cancellingId === sub.id}
                      >
                        {cancellingId === sub.id ? 'Resuming...' : 'Resume Subscription'}
                      </button>
                      <button
                        className={styles.cancelButton}
                        onClick={() => handleCancelSubscription(sub.id)}
                        disabled={cancellingId === sub.id}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {sub.status === 'INACTIVE' && (
                    <button
                      className={styles.reactivateButton}
                      onClick={() => openReactivationModal(sub)}
                      disabled={reactivatingId === sub.id}
                    >
                      {reactivatingId === sub.id ? 'Processing...' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showReactivationModal && selectedSubscription && (
        <div className={styles.modalOverlay} onClick={closeReactivationModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reactivate Subscription</h3>
              <button className={styles.modalClose} onClick={closeReactivationModal}>✕</button>
            </div>

            {reactivationStep === 'select' && (
              <div className={styles.modalBody}>
                {error && <div className={styles.error}>{error}</div>}

                {paymentMethods.length === 0 ? (
                  <div className={styles.emptyPaymentMethods}>
                    <p>No payment methods on file. Please add a card first.</p>
                  </div>
                ) : (
                  <div className={styles.paymentMethodsList}>
                    <p className={styles.label}>Select a payment method:</p>
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`${styles.paymentMethodOption} ${selectedPaymentMethod?.id === method.id ? styles.selected : ''}`}
                        onClick={() => setSelectedPaymentMethod(method)}
                      >
                        <input
                          type="radio"
                          checked={selectedPaymentMethod?.id === method.id}
                          onChange={() => setSelectedPaymentMethod(method)}
                        />
                        <div className={styles.methodDetails}>
                          <span className={styles.cardBrand}>{method.card_brand}</span>
                          <span className={styles.cardLast4}>•••• •••• •••• {method.card_last_4}</span>
                          <span className={styles.expiry}>{method.expiry_month}/{method.expiry_year}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.modalFooter}>
                  <button className={styles.cancelBtn} onClick={closeReactivationModal}>Cancel</button>
                  <button
                    className={styles.nextBtn}
                    onClick={handleReactivateSubscription}
                    disabled={!selectedPaymentMethod || paymentMethods.length === 0}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {reactivationStep === 'confirm' && selectedPaymentMethod && (
              <div className={styles.modalBody}>
                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.confirmationContent}>
                  <h4>Confirm Reactivation</h4>
                  
                  <div className={styles.confirmationDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Plan:</span>
                      <span className={styles.value}>{selectedSubscription.title}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Amount:</span>
                      <span className={styles.amount}>
                        ${(Number(selectedSubscription.locked_price || selectedSubscription.price) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Billing Cycle:</span>
                      <span className={styles.value}>{selectedSubscription.billing_cycle}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Payment Method:</span>
                      <span className={styles.value}>
                        {selectedPaymentMethod.card_brand} •••• {selectedPaymentMethod.card_last_4}
                      </span>
                    </div>
                  </div>

                  <div className={styles.warningBox}>
                    <p>By clicking "Renew", you authorize this charge to your payment method.</p>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.cancelBtn} onClick={() => setReactivationStep('select')}>Back</button>
                  <button
                    className={styles.renewBtn}
                    onClick={handleProcessReactivation}
                  >
                    Renew
                  </button>
                </div>
              </div>
            )}

            {reactivationStep === 'processing' && (
              <div className={styles.modalBody}>
                <div className={styles.processingMessage}>
                  <p>Processing payment...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
