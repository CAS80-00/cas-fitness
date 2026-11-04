import { useState } from 'react';
import PhoneInputWithCountryCode from './PhoneInputWithCountryCode';
import styles from '../styles/CreditCardModal.module.css';

export default function CreditCardModal({ isOpen, onClose, onCardSaved, cartItems = [], onNavigate }) {
  const [formData, setFormData] = useState({
    studentName: '',
    email: '',
    confirmEmail: '',
    phone: '',
    phoneCountryCode: '+1',
    cardNumber: '',
    cardholderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    country: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'cardNumber') {
      processedValue = value.replace(/\s/g, '').slice(0, 16);
    } else if (name === 'cvv') {
      processedValue = value.replace(/\D/g, '').slice(0, 4);
    } else if (name === 'zipCode') {
      processedValue = value.replace(/\D/g, '').slice(0, 10);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handlePhoneChange = (code, phoneNum) => {
    setFormData(prev => ({ 
      ...prev, 
      phone: phoneNum || '',
      phoneCountryCode: code
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate student info
    const studentInfoRequired = {
      studentName: 'Student Name',
      email: 'Email',
      confirmEmail: 'Confirm Email',
      phone: 'Phone Number',
    };

    for (const [field, label] of Object.entries(studentInfoRequired)) {
      if (!formData[field]) {
        setError(`${label} is required`);
        return;
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate email confirmation
    if (formData.email !== formData.confirmEmail) {
      setError('Email addresses do not match');
      return;
    }

    // Validate credit card info
    const cardInfoRequired = {
      cardNumber: 'Card Number',
      cardholderName: 'Cardholder Name',
      expiryMonth: 'Expiry Month',
      expiryYear: 'Expiry Year',
      cvv: 'CVV',
      country: 'Country',
      street: 'Street Address',
      city: 'City',
      zipCode: 'Zip Code',
    };

    for (const [field, label] of Object.entries(cardInfoRequired)) {
      if (!formData[field]) {
        setError(`${label} is required`);
        return;
      }
    }

    // State is mandatory only for US
    if (formData.country === 'US' && !formData.state) {
      setError('State is required for US addresses');
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
      
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add auth header only if token exists (for logged-in users)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBaseUrl}/payments/credit-card`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          student_name: formData.studentName,
          email: formData.email,
          phone: `${formData.phoneCountryCode}${formData.phone}`,
          card_number: formData.cardNumber.replace(/\s/g, ''),
          cardholder_name: formData.cardholderName,
          expiry_month: formData.expiryMonth,
          expiry_year: formData.expiryYear,
          cvv: formData.cvv,
          country: formData.country,
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          planTitle: cartItems[0]?.title || '',
          planPrice: cartItems[0]?.activePrice || cartItems[0]?.price || '',
          billingCycle: cartItems[0]?.billing_cycle || '',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process payment');
      }

      const data = await res.json();
      setSuccess('Payment processed successfully!');
      
      // Clear form
      setFormData({
        studentName: '',
        email: '',
        confirmEmail: '',
        phone: '',
        phoneCountryCode: '+1',
        cardNumber: '',
        cardholderName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        country: '',
        street: '',
        city: '',
        state: '',
        zipCode: '',
      });

      // Navigate to confirmation page after brief delay
      setTimeout(() => {
        onClose();
        if (onNavigate) {
          onNavigate('confirmation');
        }
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

  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Complete Purchase</h2>
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

          <div className={styles.sectionDivider}>Student Information</div>

          <div className={styles.formGroup}>
            <label htmlFor="studentName">Full Name <span className={styles.required}>*</span></label>
            <input
              id="studentName"
              type="text"
              name="studentName"
              value={formData.studentName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address <span className={styles.required}>*</span></label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="john@example.com"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmEmail">Confirm Email <span className={styles.required}>*</span></label>
            <input
              id="confirmEmail"
              type="email"
              name="confirmEmail"
              value={formData.confirmEmail}
              onChange={handleInputChange}
              placeholder="john@example.com"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phone">Phone Number <span className={styles.required}>*</span></label>
            <PhoneInputWithCountryCode
              id="phone"
              onChange={handlePhoneChange}
              placeholder="Enter phone number"
              required={true}
            />
          </div>

          <div className={styles.sectionDivider}>Payment Information</div>

          <div className={styles.formGroup}>
            <label htmlFor="cardNumber">Card Number <span className={styles.required}>*</span></label>
            <input
              id="cardNumber"
              type="text"
              name="cardNumber"
              value={formData.cardNumber.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim()}
              onChange={handleInputChange}
              placeholder="4111 1111 1111 1111"
              className={styles.input}
              disabled={loading}
              maxLength="19"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="cardholderName">Cardholder Name <span className={styles.required}>*</span></label>
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

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="expiryMonth">Month <span className={styles.required}>*</span></label>
              <select
                id="expiryMonth"
                name="expiryMonth"
                value={formData.expiryMonth}
                onChange={handleInputChange}
                className={styles.input}
                disabled={loading}
              >
                <option value="">Select</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                    {String(i + 1).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="expiryYear">Year <span className={styles.required}>*</span></label>
              <select
                id="expiryYear"
                name="expiryYear"
                value={formData.expiryYear}
                onChange={handleInputChange}
                className={styles.input}
                disabled={loading}
              >
                <option value="">Select</option>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() + i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="cvv">CVV <span className={styles.required}>*</span></label>
              <input
                id="cvv"
                type="text"
                name="cvv"
                value={formData.cvv}
                onChange={handleInputChange}
                placeholder="123"
                className={styles.input}
                disabled={loading}
                maxLength="4"
              />
            </div>
          </div>

          <div className={styles.sectionDivider}>Billing Address</div>

          <div className={styles.formGroup}>
            <label htmlFor="country">Country <span className={styles.required}>*</span></label>
            <input
              id="country"
              type="text"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              placeholder="United States"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="street">Street Address <span className={styles.required}>*</span></label>
            <input
              id="street"
              type="text"
              name="street"
              value={formData.street}
              onChange={handleInputChange}
              placeholder="123 Main St"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="city">City <span className={styles.required}>*</span></label>
              <input
                id="city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="New York"
                className={styles.input}
                disabled={loading}
              />
            </div>
            {formData.country === 'US' && (
              <div className={styles.formGroup}>
                <label htmlFor="state">State <span className={styles.required}>*</span></label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={loading}
                >
                  <option value="">Select State</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.formGroup}>
              <label htmlFor="zipCode">Zip Code <span className={styles.required}>*</span></label>
              <input
                id="zipCode"
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                placeholder="10001"
                className={styles.input}
                disabled={loading}
              />
            </div>
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
              {loading ? 'Processing...' : 'Complete Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


