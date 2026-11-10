const express = require("express");
const router = express.Router();
const db = require("../db/client");
const {
  ROLE,
  authenticateToken,
  requireSuperuser,
  canAccessUser,
} = require("../middleware/authMiddleware");

const SUBSCRIPTION_WITH_PLAN_SELECT = `
  SELECT
    us.id,
    us.user_id,
    us.plan_id,
    us.status,
    us.start_date,
    us.end_date,
    us.auto_renew,
    us.remaining_sessions,
    us.locked_price,
    us.price_locked_at,
    us.cancelled_at,
    us.renewal_frequency,
    us.next_renewal_date,
    us.last_renewal_date,
    p.title,
    p.description,
    p.price,
    p.billing_cycle,
    p.session_count,
    p.is_discontinued
  FROM user_subscriptions us
  JOIN plans p ON us.plan_id = p.id
`;

// Members may only pause/resume their own subscription; any other status
// change (e.g. reactivating a cancelled one) is staff-only.
const MEMBER_ALLOWED_TRANSITIONS = {
  ACTIVE: ["PAUSED"],
  PAUSED: ["ACTIVE"],
};

// Loads a subscription and verifies the caller may act on it. Sends the error
// response and resolves to null when the subscription is missing or off-limits.
async function loadAuthorizedSubscription(req, res) {
  const result = await db.query(
    "SELECT id, user_id, status FROM user_subscriptions WHERE id = $1",
    [req.params.subscriptionId],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Subscription not found" });
    return null;
  }

  const subscription = result.rows[0];
  if (!canAccessUser(req, subscription.user_id)) {
    res.status(403).json({ error: "Access denied." });
    return null;
  }
  return subscription;
}

router.get("/student/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  if (!canAccessUser(req, userId)) {
    return res.status(403).json({ error: "Access denied." });
  }

  try {
    const result = await db.query(
      `${SUBSCRIPTION_WITH_PLAN_SELECT} WHERE us.user_id = $1 ORDER BY us.start_date DESC`,
      [userId],
    );

    res.json({ subscriptions: result.rows });
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.get("/:subscriptionId", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`${SUBSCRIPTION_WITH_PLAN_SELECT} WHERE us.id = $1`, [
      req.params.subscriptionId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const subscription = result.rows[0];
    if (!canAccessUser(req, subscription.user_id)) {
      return res.status(403).json({ error: "Access denied." });
    }

    res.json({ subscription });
  } catch (err) {
    console.error("Error fetching subscription:", err);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

router.post("/:subscriptionId/cancel", authenticateToken, async (req, res) => {
  try {
    const subscription = await loadAuthorizedSubscription(req, res);
    if (!subscription) return;

    if (subscription.status === "CANCELLED") {
      return res.status(400).json({ error: "Subscription is already cancelled" });
    }

    const result = await db.query(
      `UPDATE user_subscriptions
       SET status = 'CANCELLED', cancelled_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, plan_id, status, cancelled_at`,
      [subscription.id],
    );

    res.json({
      success: true,
      message: "Subscription cancelled successfully",
      subscription: result.rows[0],
    });
  } catch (err) {
    console.error("Error cancelling subscription:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// Locks the current price for every active subscriber of a plan; called when
// a plan is discontinued.
router.post("/lock-price-for-plan/:planId", authenticateToken, requireSuperuser, async (req, res) => {
  const { planId } = req.params;

  try {
    const planRes = await db.query("SELECT id, price FROM plans WHERE id = $1", [planId]);
    if (planRes.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const result = await db.query(
      `UPDATE user_subscriptions
       SET locked_price = $1, price_locked_at = NOW()
       WHERE plan_id = $2 AND status = 'ACTIVE' AND locked_price IS NULL
       RETURNING id, user_id, locked_price, price_locked_at`,
      [planRes.rows[0].price, planId],
    );

    res.json({
      success: true,
      message: `Price locked for ${result.rowCount} active subscriptions`,
      lockedSubscriptions: result.rows,
    });
  } catch (err) {
    console.error("Error locking prices:", err);
    res.status(500).json({ error: "Failed to lock prices" });
  }
});

router.get("/:subscriptionId/price-status", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        us.id,
        us.user_id,
        us.locked_price,
        us.price_locked_at,
        p.is_discontinued,
        p.price as current_price,
        p.title
      FROM user_subscriptions us
      JOIN plans p ON us.plan_id = p.id
      WHERE us.id = $1`,
      [req.params.subscriptionId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const sub = result.rows[0];
    if (!canAccessUser(req, sub.user_id)) {
      return res.status(403).json({ error: "Access denied." });
    }

    res.json({
      priceStatus: {
        subscriptionId: sub.id,
        isDiscontinued: sub.is_discontinued,
        isPriceLocked: sub.locked_price !== null,
        lockedPrice: sub.locked_price,
        priceLockedAt: sub.price_locked_at,
        currentPrice: sub.current_price,
        planTitle: sub.title,
        displayPrice: sub.locked_price || sub.current_price,
      },
    });
  } catch (err) {
    console.error("Error checking price status:", err);
    res.status(500).json({ error: "Failed to check price status" });
  }
});

// Pauses the user's active subscription when their saved card has expired.
router.post("/check-card-status/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  if (!canAccessUser(req, userId)) {
    return res.status(403).json({ error: "Access denied." });
  }

  try {
    const cardRes = await db.query(
      `SELECT expiry_month, expiry_year
       FROM student_credit_cards
       WHERE student_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [userId],
    );

    if (cardRes.rows.length === 0) {
      return res.json({ hasCard: false, isExpired: false });
    }

    const card = cardRes.rows[0];
    const now = new Date();
    const cardYear = parseInt(card.expiry_year, 10);
    const cardMonth = parseInt(card.expiry_month, 10);
    const isExpired =
      cardYear < now.getFullYear() ||
      (cardYear === now.getFullYear() && cardMonth < now.getMonth() + 1);

    if (isExpired) {
      await db.query(
        `UPDATE user_subscriptions
         SET status = 'PAUSED', auto_renew = FALSE
         WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId],
      );
    }

    res.json({
      hasCard: true,
      isExpired,
      message: isExpired ? "Subscription paused due to expired card" : "Card is valid",
    });
  } catch (err) {
    console.error("Error checking card status:", err);
    res.status(500).json({ error: "Failed to check card status" });
  }
});

router.put("/:subscriptionId/auto-renew", authenticateToken, async (req, res) => {
  if (typeof req.body.autoRenew !== "boolean") {
    return res.status(400).json({ error: "autoRenew must be a boolean." });
  }

  try {
    const subscription = await loadAuthorizedSubscription(req, res);
    if (!subscription) return;

    const result = await db.query(
      "UPDATE user_subscriptions SET auto_renew = $1 WHERE id = $2 RETURNING id, auto_renew",
      [req.body.autoRenew, subscription.id],
    );

    res.json({ success: true, subscription: result.rows[0] });
  } catch (err) {
    console.error("Error updating auto-renew:", err);
    res.status(500).json({ error: "Failed to update auto-renewal" });
  }
});

router.put("/:subscriptionId/status", authenticateToken, async (req, res) => {
  const { status } = req.body;

  const validStatuses = ["ACTIVE", "PAUSED", "CANCELLED", "INACTIVE", "EXPIRED"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const subscription = await loadAuthorizedSubscription(req, res);
    if (!subscription) return;

    const isStaff = [ROLE.SUPERUSER, ROLE.STAFF].includes(req.user.roleId);
    if (!isStaff && !MEMBER_ALLOWED_TRANSITIONS[subscription.status]?.includes(status)) {
      return res.status(403).json({ error: "You cannot change the subscription to that status." });
    }

    const result = await db.query(
      "UPDATE user_subscriptions SET status = $1 WHERE id = $2 RETURNING id, status",
      [status, subscription.id],
    );

    res.json({
      success: true,
      message: `Subscription ${status.toLowerCase()}`,
      subscription: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ error: "Failed to update subscription status" });
  }
});

// POST: Reactivate an inactive subscription by charging a saved payment method
router.post("/:subscriptionId/reactivate", authenticateToken, async (req, res) => {
  const { paymentMethodId, amount } = req.body;

  if (!paymentMethodId || !amount) {
    return res.status(400).json({ error: "Payment method ID and amount are required" });
  }

  try {
    const subscription = await loadAuthorizedSubscription(req, res);
    if (!subscription) return;

    // Verify user can only reactivate their own subscription
    if (subscription.user_id !== req.user.id) {
      return res.status(403).json({ error: "You can only reactivate your own subscriptions" });
    }

    // Verify subscription is INACTIVE
    if (subscription.status !== 'INACTIVE') {
      return res.status(400).json({ error: "Only inactive subscriptions can be reactivated" });
    }

    // Get the payment method from database
    const pmResult = await db.query(
      "SELECT * FROM stripe_payment_methods WHERE id = $1 AND user_id = $2",
      [paymentMethodId, req.user.id]
    );

    if (pmResult.rows.length === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const paymentMethod = pmResult.rows[0];
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Get user's stripe customer ID
    const userResult = await db.query(
      "SELECT stripe_customer_id FROM users WHERE id = $1",
      [req.user.id]
    );

    let customerId = userResult.rows[0]?.stripe_customer_id;

    // Create or use existing customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          userId: req.user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await db.query(
        "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
        [customerId, req.user.id]
      );
    }

    // Create payment intent to charge the saved card
    const amountInCents = Math.round(amount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethod.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `CAS Fitness Subscription Reactivation - ${req.user.email}`,
      metadata: {
        userId: req.user.id,
        subscriptionId: subscription.id,
        reactivation: true,
      },
    });

    // Check if payment succeeded
    if (paymentIntent.status === "succeeded") {
      // Update subscription to ACTIVE
      const updatedSub = await db.query(
        "UPDATE user_subscriptions SET status = $1 WHERE id = $2 RETURNING id, status",
        ["ACTIVE", subscription.id]
      );

      res.json({
        success: true,
        message: "Subscription reactivated successfully",
        subscription: updatedSub.rows[0],
        paymentIntentId: paymentIntent.id,
      });
    } else if (paymentIntent.status === "requires_action") {
      res.status(400).json({
        success: false,
        error: "Payment requires additional action",
        clientSecret: paymentIntent.client_secret,
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Payment failed",
        status: paymentIntent.status,
      });
    }
  } catch (err) {
    console.error("Error reactivating subscription:", err.message);
    res.status(500).json({ error: "Failed to reactivate subscription" });
  }
});

// Superuser: Set renewal frequency and calculate next renewal date
router.put("/:subscriptionId/renewal-frequency", authenticateToken, requireSuperuser, async (req, res) => {
  const { subscriptionId } = req.params;
  const { renewal_frequency } = req.body;

  // Validate frequency
  const validFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];
  if (!renewal_frequency || !validFrequencies.includes(renewal_frequency.toUpperCase())) {
    return res.status(400).json({
      error: `Invalid renewal frequency. Must be one of: ${validFrequencies.join(", ")}`
    });
  }

  try {
    // Get current subscription
    const subRes = await db.query(
      "SELECT id, start_date FROM user_subscriptions WHERE id = $1",
      [subscriptionId]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const subscription = subRes.rows[0];
    const startDate = new Date(subscription.start_date);
    const nextRenewalDate = new Date(startDate);

    // Calculate next renewal date based on frequency
    const freq = renewal_frequency.toUpperCase();
    if (freq === "WEEKLY") {
      nextRenewalDate.setDate(nextRenewalDate.getDate() + 7);
    } else if (freq === "BIWEEKLY") {
      nextRenewalDate.setDate(nextRenewalDate.getDate() + 14);
    } else if (freq === "MONTHLY") {
      nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    } else if (freq === "QUARTERLY") {
      nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 3);
    } else if (freq === "YEARLY") {
      nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
    }

    // Update subscription with renewal frequency
    const updateRes = await db.query(
      `UPDATE user_subscriptions 
       SET renewal_frequency = $1, next_renewal_date = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [freq, nextRenewalDate, subscriptionId]
    );

    res.json({
      success: true,
      message: "Renewal frequency set successfully",
      subscription: updateRes.rows[0]
    });
  } catch (err) {
    console.error("Error setting renewal frequency:", err.message);
    res.status(500).json({ error: "Failed to set renewal frequency" });
  }
});

module.exports = router;
