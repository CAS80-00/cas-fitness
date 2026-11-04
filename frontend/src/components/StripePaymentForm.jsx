import { useState, useEffect } from 'react';
import styles from '../styles/StripePaymentForm.module.css';

export default function StripePaymentForm({ amount, planId, userEmail, userName, onSuccess, onError, isGuest = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  // Load Stripe
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      const stripeInstance = window.Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      setStripe(stripeInstance);
      const elementsInstance = stripeInstance.elements();
      setElements(elementsInstance);
      const cardEl = elementsInstance.create('card');
      cardEl.mount('#card-element');
      setCardElement(cardEl);
    };
    document.body.appendChild(script);
  }, []);

  // Create payment intent on mount
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const endpoint = isGuest
          ? `${apiBaseUrl}/stripe/create-payment-intent-guest`
          : `${apiBaseUrl}/stripe/create-payment-intent`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(isGuest ? {} : { Authorization: `Bearer ${localStorage.getItem('cas_jwt')}` }),
          },
          body: JSON.stringify({ amount, planId, userEmail, userName }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err.message);
        onError?.(err.message);
      }
    };

    createPaymentIntent();
  }, [amount, planId, userEmail, userName, isGuest, apiBaseUrl, onError]);

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!stripe || !cardElement) {
      setError('Card form not ready');
      return;
    }

    // Validate card by attempting to get card details
    const { error: cardError } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (cardError) {
      setError(cardError.message);
      onError?.(cardError.message);
      return;
    }

    // Card is valid, show confirmation page
    setShowConfirmation(true);
  };

  const handleConfirmPayment = async () => {
    setError('');
    setLoading(true);

    if (!stripe || !clientSecret) {
      setError('Payment form not ready');
      setLoading(false);
      return;
    }

    try {
      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { email: userEmail, name: userName },
        },
      });

      if (stripeError) {
        setError(stripeError.message);
        onError?.(stripeError.message);
        setLoading(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirm payment on backend
        const confirmResponse = await fetch(`${apiBaseUrl}/stripe/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            planId,
            userEmail,
            userName,
            isGuest,
          }),
        });

        if (!confirmResponse.ok) {
          throw new Error('Failed to confirm payment');
        }

        const confirmData = await confirmResponse.json();
        onSuccess?.(confirmData);
      } else {
        setError(`Payment status: ${paymentIntent.status}`);
        onError?.(`Payment status: ${paymentIntent.status}`);
      }
    } catch (err) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setShowConfirmation(false);
    setError('');
  };

  return (
    <>
      {!showConfirmation ? (
        // Card Entry Form
        <form onSubmit={handleCardSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Card Details</label>
            <div id="card-element" className={styles.cardElement}></div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={!stripe || loading}
            className={styles.submitButton}
          >
            {loading ? 'Processing...' : `Review Order - $${amount.toFixed(2)}`}
          </button>
        </form>
      ) : (
        // Payment Confirmation Page
        <div className={styles.confirmationPage}>
          <div className={styles.confirmationHeader}>
            <h2 className={styles.confirmationTitle}>Order Confirmation</h2>
            <p className={styles.confirmationSubtitle}>Please review your order before confirming payment</p>
          </div>

          <div className={styles.orderSummary}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Plan:</span>
              <span className={styles.summaryValue}>Plan ID: {planId}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Email:</span>
              <span className={styles.summaryValue}>{userEmail}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Name:</span>
              <span className={styles.summaryValue}>{userName}</span>
            </div>
            <div className={styles.summaryDivider}></div>
            <div className={styles.summaryRow + ' ' + styles.totalRow}>
              <span className={styles.totalLabel}>Total Amount to Charge:</span>
              <span className={styles.totalAmount}>${amount.toFixed(2)}</span>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.confirmationActions}>
            <button
              type="button"
              onClick={handleBackToForm}
              disabled={loading}
              className={styles.backButton}
            >
              ← Back to Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={loading}
              className={styles.confirmButton}
            >
              {loading ? 'Processing Payment...' : `✓ Confirm & Pay $${amount.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}


