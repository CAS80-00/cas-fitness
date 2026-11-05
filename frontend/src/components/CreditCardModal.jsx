import { useState, useEffect, useRef } from 'react';
import PhoneInputWithCountryCode from './PhoneInputWithCountryCode';
import styles from '../styles/CreditCardModal.module.css';

export default function CreditCardModal({ isOpen, onClose, onCardSaved, onNavigate }) {
  const [formData, setFormData] = useState({
    cardholderName: '',
    email: '',
    phone: '',
    phoneCountryCode: '+1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stripe, setStripe] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const cardContainerRef = useRef(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  // Load Stripe from CDN
  useEffect(() => {
    if (window.Stripe) {
      setStripe(window.Stripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      setStripe(window.Stripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY));
    };
    document.body.appendChild(script);
  }, []);

  // Mount card element after DOM is ready
  useEffect(() => {
    if (!stripe || !cardContainerRef.current || cardElement) return;

    const elements = stripe.elements();
    const element = elements.create('card', {
      style: {
        base: {
          fontSize: '14px',
          color: '#424242',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#fa755a',
        },
      },
    });
    element.mount(cardContainerRef.current);
    setCardElement(element);

    return () => {
      element.unmount();
    };
  }, [stripe, cardElement]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

    if (!stripe || !cardElement) {
      setError('Payment system is not ready');
      return;
    }

    if (!formData.cardholderName) {
      setError('Cardholder name is required');
      return;
    }

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (!formData.phone) {
      setError('Phone number is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('cas_jwt');

      // Create Setup Intent on backend
      const setupRes = await fetch(`${apiBaseUrl}/payments/setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!setupRes.ok) {
        throw new Error('Failed to create setup intent');
      }

      const { clientSecret } = await setupRes.json();

      // Confirm card and create payment method
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: formData.cardholderName,
              email: formData.email,
              phone: `${formData.phoneCountryCode}${formData.phone}`,
            },
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      // Save payment method to our database
      const saveRes = await fetch(`${apiBaseUrl}/payments/save-payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          paymentMethodId: setupIntent.payment_method,
          cardholder_name: formData.cardholderName,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || 'Failed to save payment method');
      }

      setSuccess('Card saved successfully!');
      
      // Clear form
      setFormData({
        cardholderName: '',
        email: '',
        phone: '',
        phoneCountryCode: '+1',
      });

      // Close modal after delay
      setTimeout(() => {
        onClose();
        if (onCardSaved) {
          onCardSaved();
        }
      }, 1500);
    } catch (err) {
      console.error('Error saving card:', err);
      setError(err.message || 'Failed to save card');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add Payment Method</h3>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalClose}
          >
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Cardholder Name</label>
              <input
                type="text"
                name="cardholderName"
                value={formData.cardholderName}
                onChange={handleInputChange}
                placeholder="John Doe"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Phone Number</label>
              <PhoneInputWithCountryCode
                value={formData.phone}
                countryCode={formData.phoneCountryCode}
                onChange={handlePhoneChange}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Card Details</label>
              <div className={styles.stripeElement} ref={cardContainerRef} />
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}
            {success && <div className={styles.successMessage}>{success}</div>}

            <button
              type="submit"
              disabled={loading || !stripe || !cardElement}
              className={styles.submitButton}
            >
              {loading ? 'Saving...' : 'Save Card'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
