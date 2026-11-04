import { useState, useEffect } from 'react';
import styles from '../styles/StripePaymentForm.module.css';

export default function StripePaymentForm({ amount, planId, userEmail, userName, onSuccess, onError, isGuest = false, cartItems = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [cardNumberElement, setCardNumberElement] = useState(null);
  const [cardExpiryElement, setCardExpiryElement] = useState(null);
  const [cardCvcElement, setCardCvcElement] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  // Log props for debugging
  useEffect(() => {
    console.log('StripePaymentForm props:', { amount, planId, cartItems: cartItems?.length, cartItemsList: cartItems });
  }, [amount, planId, cartItems]);

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
      const cardNumberEl = elementsInstance.create('cardNumber');
      const cardExpiryEl = elementsInstance.create('cardExpiry');
      const cardCvcEl = elementsInstance.create('cardCvc');
      
      cardNumberEl.mount('#card-number-element');
      cardExpiryEl.mount('#card-expiry-element');
      cardCvcEl.mount('#card-cvc-element');
      
      setCardNumberElement(cardNumberEl);
      setCardExpiryElement(cardExpiryEl);
      setCardCvcElement(cardCvcEl);
    };
    document.body.appendChild(script);
  }, []);

  // Create payment intent on mount
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const token = localStorage.getItem('cas_jwt');
        const hasValidAuth = isGuest === false && token;
        
        const endpoint = hasValidAuth
          ? `${apiBaseUrl}/stripe/create-payment-intent`
          : `${apiBaseUrl}/stripe/create-payment-intent-guest`;

        const headers = { 'Content-Type': 'application/json' };
        if (hasValidAuth && token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        console.log(`Creating payment intent with endpoint: ${endpoint}, isGuest: ${isGuest}, hasToken: ${!!token}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            amount, 
            planId, 
            userEmail, 
            userName,
            cartItems: cartItems.length > 0 ? cartItems : undefined,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to create payment intent: ${response.status}`);
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (err) {
        console.error('Error creating payment intent:', err);
        setError(err.message);
        onError?.(err.message);
      }
    };

    createPaymentIntent();
  }, [amount, planId, userEmail, userName, isGuest, apiBaseUrl, onError, cartItems]);

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!stripe || !cardNumberElement || !cardExpiryElement || !cardCvcElement) {
      setError('Card form not ready');
      return;
    }

    if (!clientSecret) {
      setError('Payment setup incomplete');
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    try {
      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
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
        const confirmPayload = {
          paymentIntentId: paymentIntent.id,
          planId,
          userEmail,
          userName,
          isGuest,
          cartItems: cartItems.length > 0 ? cartItems : undefined,
        };
        
        console.log('Sending confirm-payment with payload:', confirmPayload);
        
        const confirmResponse = await fetch(`${apiBaseUrl}/stripe/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confirmPayload),
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
            <label className={styles.label}>Card Number</label>
            <div id="card-number-element" className={styles.cardElement}></div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.label}>Expiry Date</label>
              <div id="card-expiry-element" className={styles.cardElement}></div>
            </div>
            <div className={styles.formGroup} style={{ flex: 1, marginLeft: '10px' }}>
              <label className={styles.label}>CVV</label>
              <div id="card-cvc-element" className={styles.cardElement}></div>
            </div>
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
            {cartItems.length > 0 ? (
              // Show cart items list
              <>
                <div className={styles.cartItemsList}>
                  {cartItems.map((item, idx) => (
                    <div key={idx} className={styles.cartItemRow}>
                      <span className={styles.itemName}>{item.title}</span>
                      <span className={styles.itemPrice}>${Number(item.activePrice || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.summaryDivider}></div>
              </>
            ) : (
              // Show single plan details
              <>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Plan:</span>
                  <span className={styles.summaryValue}>Plan ID: {planId}</span>
                </div>
                <div className={styles.summaryDivider}></div>
              </>
            )}
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
              Back to Form
            </button>
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={loading}
              className={styles.confirmButton}
            >
              {loading ? 'Processing...' : `Confirm Payment - $${amount.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
