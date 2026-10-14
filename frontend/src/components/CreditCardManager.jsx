import { useState, useEffect } from 'react';
import styles from '../styles/CreditCardManager.module.css';

export default function CreditCardManager({ userId, onAddCard }) {
  const [savedCard, setSavedCard] = useState(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  // Load saved card on mount
  useEffect(() => {
    const loadCard = async () => {
      if (!userId) return;
      try {
        const token = localStorage.getItem('cas_jwt');
        const res = await fetch(`${apiBaseUrl}/payments/credit-card/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.card) {
            setSavedCard(data.card);
          }
        }
      } catch (err) {
        console.error('Error loading saved card:', err);
      }
    };
    loadCard();
  }, [userId, apiBaseUrl]);

  const handleAddCard = () => {
    if (onAddCard) {
      onAddCard();
    }
  };

  const maskCardNumberWithLast3 = (cardNumber) => {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 16) return cardNumber;
    const last3 = cleanNumber.slice(-3);
    return 'XXXXXXXXXXXX' + last3;
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h3 className={styles.title}>Payment Method</h3>
      </div>

      {!savedCard ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No payment method added yet</p>
          <button
            type="button"
            onClick={handleAddCard}
            className={styles.addButton}
          >
            + Add Credit Card
          </button>
        </div>
      ) : (
        <div className={styles.savedCard}>
          <div className={styles.cardDisplay}>
            <div className={styles.cardBrand}>{savedCard.card_type}</div>
            <div className={styles.cardNumberContainer}>
              <div className={styles.cardNumber}>
                {maskCardNumberWithLast3(savedCard.card_number_masked)}
              </div>
            </div>
            <div className={styles.cardFooter}>
              <div className={styles.cardholderContainer}>
                <div className={styles.cardholderLabel}>Cardholder</div>
                <div className={styles.cardholder}>{savedCard.cardholder_name}</div>
              </div>
              <div className={styles.expiryContainer}>
                <div className={styles.expiryLabel}>Expires</div>
                <div className={styles.expiry}>
                  {savedCard.expiry_month}/{savedCard.expiry_year}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddCard}
            className={styles.updateButton}
          >
            Update Card
          </button>
        </div>
      )}
    </div>
  );
}
