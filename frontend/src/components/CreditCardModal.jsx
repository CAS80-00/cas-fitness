import { useState } from 'react';
import styles from '../styles/CreditCardModal.module.css';

export default function CreditCardModal({ userId, isOpen, onClose, onCardSaved }) {
  const [formData, setFormData] = useState({
    cardNumber: '',
    cardholderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  const formatCardNumber = (value) => {
    return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'cardNumber') {
      processedValue = value.replace(/\s/g, '').slice(0, 16);
    } else if (name === 'cvv') {
      processedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.cardNumber || !formData.cardholderName || !formData.expiryMonth || !formData.expiryYear || !formData.cvv || !formData.address) {
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

    // Check if card is expired
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const cardYear = parseInt(formData.expiryYear, 10);
    const cardMonth = parseInt(formData.expiryMonth, 10);

    if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
      setError('Card is expired. Please enter a valid card.');
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
          card_number: formData.cardNumber.replace(/\s/g, ''),
          cardholder_name: formData.cardholderName,
          expiry_month: formData.expiryMonth,
          expiry_year: formData.expiryYear,
          cvv: formData.cvv,
          address: formData.address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save card');
      }

      const data = await res.json();
      setSuccess('Card saved successfully!');
      setFormData({
        cardNumber: '',
        cardholderName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        address: '',
      });
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
              name="cardNumber"
              value={formatCardNumber(formData.cardNumber)}
              onChange={handleInputChange}
              placeholder="1234 5678 9012 3456"
              className={styles.input}
              maxLength="19"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="cardholderName">Cardholder Name</label>
            <input
              id="cardholderName"
              type="text"
              name="cardholderName"
              value={formData.cardholderName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="expiryMonth">Expiry Month</label>
              <select
                id="expiryMonth"
                name="expiryMonth"
                value={formData.expiryMonth}
                onChange={handleInputChange}
                className={styles.input}
                disabled={loading}
              >
                <option value="">MM</option>
                {[...Array(12)].map((_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return <option key={i} value={month}>{month}</option>;
                })}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="expiryYear">Expiry Year</label>
              <select
                id="expiryYear"
                name="expiryYear"
                value={formData.expiryYear}
                onChange={handleInputChange}
                className={styles.input}
                disabled={loading}
              >
                <option value="">YYYY</option>
                {[...Array(10)].map((_, i) => {
                  const year = new Date().getFullYear() + i;
                  return <option key={i} value={year}>{year}</option>;
                })}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="cvv">CVV</label>
              <input
                id="cvv"
                type="password"
                name="cvv"
                value={formData.cvv}
                onChange={handleInputChange}
                placeholder="123"
                className={styles.input}
                maxLength="4"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="address">Address</label>
            <input
              id="address"
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="123 Main Street, City, State ZIP"
              className={styles.input}
              disabled={loading}
            />
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
