import { useState } from 'react';
import styles from '../styles/CreditCardModal.module.css';

export default function CreditCardModal({ userId, isOpen, onClose, onCardSaved }) {
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  const formatCardNumber = (value) => {
    return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\s/g, '').slice(0, 16);
    setCardNumber(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!cardNumber) {
      setError('Card number is required');
      return;
    }

    if (cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Card number must be 16 digits');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/payments/credit-card`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_number: cardNumber.replace(/\s/g, ''),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save card');
      }

      const data = await res.json();
      setSuccess('Card saved successfully!');
      setCardNumber('');
      setTimeout(() => {
        onClose();
        if (onCardSaved) {
          onCardSaved(data.card);
        }
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add Credit Card</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="cardNumber">Card Number</label>
            <input
              id="cardNumber"
              type="text"
              value={formatCardNumber(cardNumber)}
              onChange={handleInputChange}
              placeholder="1234 5678 9012 3456"
              className={styles.input}
              maxLength="19"
              disabled={loading}
            />
            <p className={styles.hint}>Enter your 16-digit card number</p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
