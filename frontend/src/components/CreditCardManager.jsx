import { useState, useEffect } from 'react';
import styles from '../styles/CreditCardManager.module.css';

export default function CreditCardManager({ userId }) {
  const [savedCard, setSavedCard] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  const [formData, setFormData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
  });

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'cardNumber') {
      processedValue = value.replace(/\s/g, '').slice(0, 16);
    } else if (name === 'expiryMonth') {
      processedValue = value.slice(0, 2);
    } else if (name === 'expiryYear') {
      processedValue = value.slice(0, 4);
    } else if (name === 'cvv') {
      processedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const formatCardNumber = (value) => {
    return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.cardholderName || !formData.cardNumber || !formData.expiryMonth || !formData.expiryYear || !formData.cvv) {
      setError('All fields are required');
      return;
    }

    if (formData.cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Card number must be 16 digits');
      return;
    }

    if (formData.cvv.length < 3) {
      setError('CVV must be at least 3 digits');
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
          cardholder_name: formData.cardholderName,
          card_number: formData.cardNumber.replace(/\s/g, ''),
          expiry_month: formData.expiryMonth,
          expiry_year: formData.expiryYear,
          cvv: formData.cvv,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save card');
      }

      const data = await res.json();
      setSavedCard(data.card);
      setSuccess('Card saved successfully!');
      setShowForm(false);
      setFormData({
        cardholderName: '',
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const maskCardNumber = (cardNumber) => {
    return cardNumber.replace(/\d(?=\d{3})/g, 'X');
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Payment Method</h3>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {savedCard && !showForm ? (
        <div className={styles.savedCard}>
          <div className={styles.cardDisplay}>
            <div className={styles.cardBrand}>{savedCard.card_type}</div>
            <div className={styles.cardNumber}>
              {maskCardNumber(savedCard.card_number_masked)}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.cardholder}>{savedCard.cardholder_name}</span>
              <span className={styles.expiry}>
                {savedCard.expiry_month}/{savedCard.expiry_year}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className={styles.updateButton}
          >
            Update Card
          </button>
        </div>
      ) : (
        <form onSubmit={handleSaveCard} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Cardholder Name</label>
            <input
              type="text"
              name="cardholderName"
              value={formData.cardholderName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Card Number</label>
            <input
              type="text"
              name="cardNumber"
              value={formatCardNumber(formData.cardNumber)}
              onChange={handleInputChange}
              placeholder="1234 5678 9012 3456"
              className={styles.input}
              maxLength="19"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Expiry Month</label>
              <select
                name="expiryMonth"
                value={formData.expiryMonth}
                onChange={handleInputChange}
                className={styles.input}
              >
                <option value="">MM</option>
                {[...Array(12)].map((_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return <option key={i} value={month}>{month}</option>;
                })}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Expiry Year</label>
              <select
                name="expiryYear"
                value={formData.expiryYear}
                onChange={handleInputChange}
                className={styles.input}
              >
                <option value="">YYYY</option>
                {[...Array(10)].map((_, i) => {
                  const year = new Date().getFullYear() + i;
                  return <option key={i} value={year}>{year}</option>;
                })}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>CVV</label>
              <input
                type="password"
                name="cvv"
                value={formData.cvv}
                onChange={handleInputChange}
                placeholder="123"
                className={styles.input}
                maxLength="4"
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="submit"
              disabled={loading}
              className={styles.saveButton}
            >
              {loading ? 'Saving...' : 'Save Card'}
            </button>
            {savedCard && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
