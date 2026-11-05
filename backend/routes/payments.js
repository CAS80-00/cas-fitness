const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const db = require("../db/client");
const { authenticateToken, optionalAuthenticate, canAccessUser } = require("../middleware/authMiddleware");
const { sendUserConfirmationEmail, sendSuperuserNotificationEmail } = require("../services/emailService");


// Create Setup Intent for saving a card without charging
router.post("/setup-intent", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get or create Stripe customer
    const userRes = await db.query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [userId]
    );
    let customerId = userRes.rows[0]?.stripe_customer_id;

    if (!customerId) {
      const userDetails = await db.query(
        `SELECT email, first_name, last_name FROM users WHERE id = $1`,
        [userId]
      );
      const user = userDetails.rows[0];

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      await db.query(
        `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, userId]
      );
    }

    // Create setup intent for future payment method
    // Note: payment_method_types is deprecated, Stripe now uses Dashboard settings
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
    });

    res.json({
      success: true,
      clientSecret: setupIntent.client_secret,
    });
  } catch (err) {
    console.error("Error creating setup intent:", err.message);
    res.status(500).json({ error: "Failed to create setup intent" });
  }
});

// Save a new payment method (called after client confirms card with Stripe Elements)
router.post("/save-payment-method", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { paymentMethodId, cardholder_name } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: "Payment method ID is required" });
    }

    // Get payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (!paymentMethod.card) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const card = paymentMethod.card;

    // Check if this payment method is already saved
    const existing = await db.query(
      `SELECT id FROM stripe_payment_methods WHERE stripe_payment_method_id = $1`,
      [paymentMethodId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "This payment method is already saved" });
    }

    // Save payment method to database
    const result = await db.query(
      `INSERT INTO stripe_payment_methods 
       (user_id, stripe_payment_method_id, card_brand, card_last_4, expiry_month, expiry_year, cardholder_name, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, stripe_payment_method_id, card_brand, card_last_4, expiry_month, expiry_year, cardholder_name`,
      [userId, paymentMethodId, card.brand.toUpperCase(), card.last4, card.exp_month, card.exp_year, cardholder_name]
    );

    const savedMethod = result.rows[0];
    res.json({
      success: true,
      paymentMethod: {
        id: savedMethod.id,
        stripe_payment_method_id: savedMethod.stripe_payment_method_id,
        card_brand: savedMethod.card_brand,
        card_last_4: savedMethod.card_last_4,
        expiry_month: String(savedMethod.expiry_month).padStart(2, "0"),
        expiry_year: savedMethod.expiry_year,
        cardholder_name: savedMethod.cardholder_name,
      },
    });
  } catch (err) {
    console.error("Error saving payment method:", err.message);
    res.status(500).json({ error: "Failed to save payment method" });
  }
});

// Get saved payment methods for a user
router.get("/payment-methods/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  if (!canAccessUser(req, userId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const result = await db.query(
      `SELECT id, stripe_payment_method_id, card_brand, card_last_4, expiry_month, expiry_year, cardholder_name, is_default
       FROM stripe_payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    const methods = result.rows.map((row) => ({
      id: row.id,
      stripe_payment_method_id: row.stripe_payment_method_id,
      card_brand: row.card_brand,
      card_last_4: row.card_last_4,
      expiry_month: String(row.expiry_month).padStart(2, "0"),
      expiry_year: row.expiry_year,
      cardholder_name: row.cardholder_name,
      is_default: row.is_default,
    }));

    res.json({ paymentMethods: methods });
  } catch (err) {
    console.error("Error fetching payment methods:", err.message);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

// Get default payment method for a user
router.get("/credit-card/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  if (!canAccessUser(req, userId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const result = await db.query(
      `SELECT id, card_brand, card_last_4, expiry_month, expiry_year, cardholder_name
       FROM stripe_payment_methods
       WHERE user_id = $1 AND is_default = TRUE
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ card: null });
    }

    const card = result.rows[0];
    res.json({
      card: {
        cardholder_name: card.cardholder_name,
        card_number_masked: "XXXX XXXX XXXX " + card.card_last_4,
        card_type: card.card_brand,
        expiry_month: String(card.expiry_month).padStart(2, "0"),
        expiry_year: card.expiry_year,
      },
    });
  } catch (err) {
    console.error("Error fetching credit card:", err.message);
    res.status(500).json({ error: "Failed to fetch credit card" });
  }
});

// Delete a saved payment method
router.delete("/payment-methods/:methodId", authenticateToken, async (req, res) => {
  try {
    const { methodId } = req.params;
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT stripe_payment_method_id FROM stripe_payment_methods WHERE id = $1 AND user_id = $2`,
      [methodId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const paymentMethodId = result.rows[0].stripe_payment_method_id;

    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethodId);

    // Delete from database
    await db.query(
      `DELETE FROM stripe_payment_methods WHERE id = $1`,
      [methodId]
    );

    res.json({ success: true, message: "Payment method deleted" });
  } catch (err) {
    console.error("Error deleting payment method:", err.message);
    res.status(500).json({ error: "Failed to delete payment method" });
  }
});

// Legacy endpoint for compatibility (accepts payment from profile)
// Creates a payment intent using a saved Stripe payment method
router.post("/credit-card", optionalAuthenticate, async (req, res) => {
  const { paymentMethodId, student_name, email, phone, planTitle, planPrice, billingCycle } = req.body;
  const userId = req.user?.userId;

  if (!paymentMethodId || !student_name || !email || !phone) {
    return res.status(400).json({ error: "Payment method ID, name, email, and phone are required" });
  }

  try {
    // Create payment intent using Stripe
    const amountInCents = Math.round((planPrice || 0) * 100);

    // Get or create Stripe customer
    let customerId;
    if (userId) {
      const userRes = await db.query(
        `SELECT stripe_customer_id FROM users WHERE id = $1`,
        [userId]
      );
      customerId = userRes.rows[0]?.stripe_customer_id;

      if (!customerId) {
        const userDetails = await db.query(
          `SELECT email, first_name, last_name FROM users WHERE id = $1`,
          [userId]
        );
        const user = userDetails.rows[0];

        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          metadata: { user_id: userId },
        });
        customerId = customer.id;

        await db.query(
          `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
          [customerId, userId]
        );
      }
    } else {
      // Guest checkout
      const customer = await stripe.customers.create({
        email,
        name: student_name,
        phone,
      });
      customerId = customer.id;
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: `${planTitle} - ${billingCycle}`,
      metadata: {
        user_id: userId || "guest",
        plan_title: planTitle,
        billing_cycle: billingCycle,
      },
    });

    if (paymentIntent.status === "succeeded") {
      // Send confirmation emails
      try {
        await sendUserConfirmationEmail(email, student_name, {
          title: planTitle || "Membership Plan",
          price: planPrice || "0.00",
          billing_cycle: billingCycle || "Monthly",
        });

        await sendSuperuserNotificationEmail({
          student_name,
          email,
          phone,
          planTitle: planTitle || "Membership Plan",
          planPrice: planPrice || "0.00",
          billingCycle: billingCycle || "Monthly",
        });
      } catch (emailError) {
        console.error("Email sending error (non-blocking):", emailError);
      }

      res.json({
        success: true,
        message: "Payment processed successfully",
        transactionId: paymentIntent.id,
      });
    } else if (paymentIntent.status === "requires_action") {
      res.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
      });
    } else {
      res.status(400).json({
        error: "Payment failed. Please try again.",
        status: paymentIntent.status,
      });
    }
  } catch (err) {
    console.error("Error processing payment:", err.message);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

module.exports = router;
