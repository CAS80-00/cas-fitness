import { useState, useEffect } from 'react';
import styles from '../styles/CreditCardManager.module.css';

export default function CreditCardManager({ userId, onAddCard }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  // Load saved payment methods on mount
  useEffect(() => {
    const loadPaymentMethods = async () => {
      if (!userId) return;
      try {
        setLoading(true);
        const token = localStorage.getItem('cas_jwt');
        const res = await fetch(`${apiBaseUrl}/payments/payment-methods/${userId}`, {
          headers: { 
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setPaymentMethods(data.paymentMethods || []);
          const defaultMethod = data.paymentMethods?.find(m => m.is_default);
          setSelectedMethod(defaultMethod || null);
        } else if (res.status !== 404) {
          setError('Failed to load payment methods');
        }
      } catch (err) {
        console.error('Error loading payment methods:', err);
        setError('Failed to load payment methods');
      } finally {
        setLoading(false);
      }
    };
    loadPaymentMethods();
  }, [userId, apiBaseUrl]);

  const handleDeleteMethod = async (methodId) => {
    if (!window.confirm('Are you sure you want to delete this payment method?')) {
      return;
    }

    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/payments/payment-methods/${methodId}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (res.ok) {
        setPaymentMethods(paymentMethods.filter(m => m.id !== methodId));
        setSelectedMethod(null);
      } else {
        setError('Failed to delete payment method');
      }
    } catch (err) {
      console.error('Error deleting payment method:', err);
      setError('Failed to delete payment method');
    }
  };

  const handleEditMethod = (method) => {
    window.alert('Card details cannot be edited. To change card information, delete this card and add a new one.');
  };

  const handleAddCard = () => {
    if (onAddCard) {
      onAddCard();
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>Payment Methods</h3>
        </div>
        <div className={styles.loadingState}>Loading payment methods...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h3 className={styles.title}>Payment Methods</h3>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {paymentMethods.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No payment methods added yet</p>
          <button
            type="button"
            onClick={handleAddCard}
            className={styles.addButton}
          >
            + Add Credit Card
          </button>
        </div>
      ) : (
        <div className={styles.methodsList}>
          {paymentMethods.map((method) => (
            <div key={method.id} className={styles.methodCard}>
              <div className={styles.methodInfo}>
                <div className={styles.cardDisplay}>
                  <div className={styles.cardBrand}>{method.card_brand}</div>
                  <div className={styles.cardNumber}>
                    •••• •••• •••• {method.card_last_4}
                  </div>
                  <div className={styles.cardFooter}>
                    <div>
                      <div className={styles.cardholderLabel}>Cardholder</div>
                      <div className={styles.cardholder}>{method.cardholder_name}</div>
                    </div>
                    <div>
                      <div className={styles.expiryLabel}>Expires</div>
                      <div className={styles.expiry}>
                        {method.expiry_month}/{method.expiry_year}
                      </div>
                    </div>
                  </div>
                  {method.is_default && (
                    <div className={styles.defaultBadge}>DEFAULT</div>
                  )}
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => handleEditMethod(method)}
                      className={styles.editButtonCard}
                      title="Edit payment method"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMethod(method.id)}
                      className={styles.deleteButtonCard}
                      title="Delete payment method"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
