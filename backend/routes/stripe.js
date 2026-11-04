const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db/client');
const { authenticateToken } = require('../middleware/authMiddleware');

// Test endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'Stripe routes loaded successfully' });
});

// POST create payment intent for subscription
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { amount, planId, customerId, userEmail, userName } = req.body;

    if (!amount || !planId) {
      return res.status(400).json({ error: 'Amount and planId are required' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: `CAS Fitness Plan Purchase - Plan ID: ${planId}`,
      metadata: {
        planId,
        customerId: customerId || req.user.id,
        userEmail,
        userName,
      },
    });

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
    const { amount, planId, userEmail, userName } = req.body;

    if (!amount || !planId) {
      return res.status(400).json({ error: 'Amount and planId are required' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: `CAS Fitness Plan Purchase - Plan ID: ${planId}`,
      metadata: {
        planId,
        userEmail,
        userName,
        isGuest: 'true',
      },
    });

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
  try {
    const { paymentIntentId, planId, userEmail, userName, isGuest } = req.body;

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

    // Record payment in database
    const result = await db.query(
      `INSERT INTO transactions (user_email, plan_id, amount, stripe_transaction_id, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        userEmail,
        planId,
        paymentIntent.amount / 100, // Convert back to dollars
        paymentIntentId,
        'completed',
        JSON.stringify({
          userName,
          isGuest,
          stripeChargeId: paymentIntent.charges.data[0]?.id,
        }),
      ]
    );

    res.json({
      success: true,
      transactionId: result.rows[0].id,
      message: 'Payment confirmed successfully',
    });
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

module.exports = router;
