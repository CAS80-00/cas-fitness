const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db/client');
const { authenticateToken } = require('../middleware/authMiddleware');
const { sendUserConfirmationEmail, sendSuperuserNotificationEmail, sendPaymentReceipt, sendLoginInstructionsEmail, sendConsultationSchedulingEmail } = require('../services/emailService');

// Test endpoint
router.get('/health', (req, res) => {
  console.log('Health check called - Time:', new Date().toISOString());
  res.json({ status: 'Stripe routes loaded successfully', timestamp: new Date().toISOString() });
});

// POST create payment intent for subscription
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { amount, planId, customerId, userEmail, userName, cartItems } = req.body;

    console.log('Payment intent (authenticated) requested:', { amount, planId, customerId, userEmail, userName, cartItems });

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const amountInCents = Math.round(amount * 100);
    console.log(`Converting $${amount} to ${amountInCents} cents for Stripe`);

    // Build description from cart items or single plan
    const description = cartItems && cartItems.length > 0 
      ? `CAS Fitness Plan Purchase - ${cartItems.length} item(s)`
      : `CAS Fitness Plan Purchase - Plan ID: ${planId}`;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description,
      metadata: {
        planId: planId || 'multiple',
        customerId: customerId || req.user.id,
        userEmail,
        userName,
        itemCount: cartItems ? cartItems.length : 1,
      },
    });

    console.log(`Stripe payment intent created: ${paymentIntent.id} for $${paymentIntent.amount / 100}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// POST create payment intent for guest checkout
router.post('/create-payment-intent-guest', async (req, res) => {
  try {
    const { amount, planId, userEmail, userName, cartItems } = req.body;

    console.log('Payment intent requested:', { amount, planId, userEmail, userName, cartItems });

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const amountInCents = Math.round(amount * 100);
    console.log(`Converting $${amount} to ${amountInCents} cents for Stripe`);

    // Build description from cart items or single plan
    const description = cartItems && cartItems.length > 0 
      ? `CAS Fitness Plan Purchase - ${cartItems.length} item(s)`
      : `CAS Fitness Plan Purchase - Plan ID: ${planId}`;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description,
      metadata: {
        planId: planId || 'multiple',
        userEmail,
        userName,
        isGuest: 'true',
        itemCount: cartItems ? cartItems.length : 1,
      },
    });

    console.log(`Stripe payment intent created: ${paymentIntent.id} for $${paymentIntent.amount / 100}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// POST confirm payment (called after Stripe processes payment)
router.post('/confirm-payment', async (req, res) => {
  res.setHeader('X-Route-Hit', 'confirm-payment');
  try {
    const { paymentIntentId, planId, userEmail, userName, isGuest, cartItems } = req.body;

    console.log('Confirm payment request:', { paymentIntentId, planId, userEmail, userName, isGuest, cartItemsCount: cartItems?.length, cartItems });

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: paymentIntent.status,
      });
    }

    const amount = paymentIntent.amount / 100; // Convert back to dollars

    // Handle multiple items or single plan
    if (cartItems && cartItems.length > 0) {
      console.log(`Processing ${cartItems.length} items for email...`);
      const chargeId = paymentIntent.charges?.data?.[0]?.id;
      
      // For multiple items, create a transaction for each item
      for (const item of cartItems) {
        if (!item.id) {
          console.error('Item missing id:', item);
          return res.status(400).json({ error: 'Cart item missing required id field' });
        }
        
        await db.query(
          `INSERT INTO transactions (user_email, plan_id, amount, stripe_transaction_id, status, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            userEmail,
            item.id,
            Number(item.activePrice || 0),
            paymentIntentId,
            'completed',
            JSON.stringify({
              userName,
              isGuest,
              stripeChargeId: chargeId,
              itemTitle: item.title,
              cartSize: cartItems.length,
            }),
          ]
        );
      }

      // Send email with all items
      try {
        console.log(`Sending confirmation email with ${cartItems.length} items to ${userEmail}`);
        await sendUserConfirmationEmail(userEmail, userName, cartItems, amount);
        const chargeId = paymentIntent.charges?.data?.[0]?.id;
        
        // Send receipt email
        await sendPaymentReceipt(
          userEmail,
          userName,
          `Multiple Plans (${cartItems.length} items)`,
          amount,
          paymentIntentId,
          'purchase'
        );
        
        await sendSuperuserNotificationEmail({
          student_name: userName,
          email: userEmail,
          planTitle: `Multiple Plans (${cartItems.length} items)`,
          planPrice: amount.toFixed(2),
          cartItems: cartItems,
          stripeChargeId: chargeId,
        });
      } catch (emailError) {
        console.error('Email sending error (non-blocking):', emailError);
      }
    } else {
      // Single plan transaction
      const result = await db.query(
        `INSERT INTO transactions (user_email, plan_id, amount, stripe_transaction_id, status, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [
          userEmail,
          planId,
          amount,
          paymentIntentId,
          'completed',
          JSON.stringify({
            userName,
            isGuest,
            stripeChargeId: paymentIntent.charges.data[0]?.id,
          }),
        ]
      );

      // Send email for single plan
      try {
        await sendUserConfirmationEmail(userEmail, userName, [{ id: planId, title: 'Membership Plan', activePrice: amount }], amount);
        
        // Send receipt email
        await sendPaymentReceipt(
          userEmail,
          userName,
          'Membership Plan',
          amount,
          paymentIntentId,
          'purchase'
        );
        
        await sendSuperuserNotificationEmail({
          student_name: userName,
          email: userEmail,
          planTitle: 'Membership Plan',
          planPrice: amount.toFixed(2),
          stripeChargeId: paymentIntent.charges.data[0]?.id,
        });
      } catch (emailError) {
        console.error('Email sending error (non-blocking):', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
    });
  } catch (err) {
    console.error('Error confirming payment:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to confirm payment', details: err.message });
  }
});

// TEST: Send sample receipt email (for testing purposes only)
router.post('/test-receipt', async (req, res) => {
  try {
    const { email, studentName, planTitle, amount, paymentType } = req.body;

    if (!email || !studentName || !planTitle || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, studentName, planTitle, amount' 
      });
    }

    // Generate a sample transaction ID
    const sampleTransactionId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`Sending test ${paymentType || 'purchase'} receipt to ${email}`);

    await sendPaymentReceipt(
      email,
      studentName,
      planTitle,
      amount,
      sampleTransactionId,
      paymentType || 'purchase'
    );

    res.json({
      success: true,
      message: `Test ${paymentType || 'purchase'} receipt sent to ${email}`,
      transactionId: sampleTransactionId
    });
  } catch (err) {
    console.error('Error sending test receipt:', err.message);
    res.status(500).json({ error: 'Failed to send test receipt', details: err.message });
  }
});

// Test endpoint for login instructions email
router.post('/test-login-instructions', async (req, res) => {
  try {
    const { email, firstName, temporaryPassword } = req.body;

    if (!email || !firstName || !temporaryPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, firstName, temporaryPassword' 
      });
    }

    console.log(`Sending test login instructions email to ${email}`);

    await sendLoginInstructionsEmail(email, firstName, temporaryPassword);

    res.json({
      success: true,
      message: `Test login instructions email sent to ${email}`
    });
  } catch (err) {
    console.error('Error sending test login instructions:', err.message);
    res.status(500).json({ error: 'Failed to send test login instructions', details: err.message });
  }
});

// Test endpoint for payment receipt email
router.post('/test-receipt', async (req, res) => {
  try {
    const { email, studentName, planTitle, amount, paymentType = 'purchase' } = req.body;

    if (!email || !studentName || !planTitle || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, studentName, planTitle, amount' 
      });
    }

    console.log(`Sending test payment receipt email to ${email}`);

    // Generate a test transaction ID
    const testTransactionId = `TEST_${Date.now()}`;

    await sendPaymentReceipt(email, studentName, planTitle, amount, testTransactionId, paymentType);

    res.json({
      success: true,
      message: `Test payment receipt email sent to ${email}`,
      transactionId: testTransactionId
    });
  } catch (err) {
    console.error('Error sending test payment receipt:', err.message);
    res.status(500).json({ error: 'Failed to send test payment receipt', details: err.message });
  }
});

// Test endpoint for consultation scheduling email
router.post('/test-consultation', (req, res) => {
  res.json({
    success: true,
    message: 'Test consultation endpoint works'
  });
});

module.exports = router;
