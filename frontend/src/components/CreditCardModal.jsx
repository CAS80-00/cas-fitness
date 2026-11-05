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
  const [elements, setElements] = useState(null);
  const cardNumberRef = useRef(null);
  const expiryRef = useRef(null);
  const cvcRef = useRef(null);
  const cardNumberElement = useRef(null);
  const expiryElement = useRef(null);
  const cvcElement = useRef(null);
  const stripeLoadedRef = useRef(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  // Load Stripe from CDN once only
  useEffect(() => {
    if (stripeLoadedRef.current) return;

    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripeKey) {
      console.error('VITE_STRIPE_PUBLISHABLE_KEY is not set');
      setError('Payment system is not configured');
      return;
    }

    const loadStripe = () => {
      if (!window.Stripe) {
        console.error('Stripe.js failed to load');
        setError('Payment system failed to load');
        return;
      }

      try {
        const stripeInstance = window.Stripe(stripeKey);
        setStripe(stripeInstance);
        setElements(stripeInstance.elements());
        stripeLoadedRef.current = true;
      } catch (err) {
        console.error('Error initializing Stripe:', err);
        setError('Payment system configuration error');
      }
    };

    // Check if Stripe is already loaded
    if (window.Stripe) {
      loadStripe();
      return;
    }

    // Load Stripe from CDN
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = loadStripe;
    script.onerror = () => {
      console.error('Failed to load Stripe.js');
      setError('Failed to load payment system');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script - it needs to stay for Stripe
    };
  }, []);

  // Mount individual card elements
  useEffect(() => {
    if (!stripe || !elements) return;
    if (!cardNumberRef.current || !expiryRef.current || !cvcRef.current) return;
    if (cardNumberElement.current || expiryElement.current || cvcElement.current) return;

    try {
      const elementStyle = {
        base: {
          fontSize: '14px',
          color: '#e5e7eb',
          fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
          '::placeholder': {
            color: '#6b7280',
          },
        },
        invalid: {
          color: '#fca5a5',
        },
      };

      // Create card number element
      const cardNumberEl = elements.create('cardNumber', { style: elementStyle });
      cardNumberEl.mount(cardNumberRef.current);
      cardNumberElement.current = cardNumberEl;

      // Create expiry element
      const expiryEl = elements.create('cardExpiry', { style: elementStyle });
      expiryEl.mount(expiryRef.current);
      expiryElement.current = expiryEl;

      // Create CVC element
      const cvcEl = elements.create('cardCvc', { style: elementStyle });
      cvcEl.mount(cvcRef.current);
      cvcElement.current = cvcEl;
    } catch (err) {
      console.error('Error mounting card elements:', err);
      setError('Failed to initialize payment fields');
    }

    return () => {
      if (cardNumberElement.current) {
        try {
          cardNumberElement.current.unmount();
        } catch (e) {
          console.error('Error unmounting card number element:', e);
        }
        cardNumberElement.current = null;
      }
      if (expiryElement.current) {
        try {
          expiryElement.current.unmount();
        } catch (e) {
          console.error('Error unmounting expiry element:', e);
        }
        expiryElement.current = null;
      }
      if (cvcElement.current) {
        try {
          cvcElement.current.unmount();
        } catch (e) {
          console.error('Error unmounting CVC element:', e);
        }
        cvcElement.current = null;
      }
    };
  }, [stripe, elements]);

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

    if (!stripe || !elements) {
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
        const errorData = await setupRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create setup intent');
      }

      const { clientSecret } = await setupRes.json();

      // Confirm card and create payment method using card number element
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardNumberElement.current,
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
        const data = await saveRes.json().catch(() => ({}));
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

            <div className={styles.cardDetailsGroup}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Card Number</label>
                <div className={styles.stripeElement} ref={cardNumberRef} />
              </div>

              <div className={styles.cardRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Expiry Date</label>
                  <div className={styles.stripeElement} ref={expiryRef} />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>CVC</label>
                  <div className={styles.stripeElement} ref={cvcRef} />
                </div>
              </div>
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}
            {success && <div className={styles.successMessage}>{success}</div>}

            <button
              type="submit"
              disabled={loading || !stripe || !elements}
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
