const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET: Student's active subscriptions with plan details
router.get('/student/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT 
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
        p.title,
        p.description,
        p.price,
        p.billing_cycle,
        p.session_count,
        p.is_discontinued
      FROM user_subscriptions us
      JOIN plans p ON us.plan_id = p.id
      WHERE us.user_id = $1
      ORDER BY us.start_date DESC`,
      [userId]
    );

    res.json({ subscriptions: result.rows });
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// GET: Single subscription details
router.get('/:subscriptionId', authenticateToken, async (req, res) => {
  const { subscriptionId } = req.params;

  try {
    const result = await db.query(
      `SELECT 
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
        p.title,
        p.description,
        p.price,
        p.billing_cycle,
        p.session_count,
        p.is_discontinued
      FROM user_subscriptions us
      JOIN plans p ON us.plan_id = p.id
      WHERE us.id = $1`,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const subscription = result.rows[0];
    res.json({ subscription });
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST: Cancel a subscription
router.post('/:subscriptionId/cancel', authenticateToken, async (req, res) => {
  const { subscriptionId } = req.params;

  try {
    // Get subscription details first
    const subRes = await db.query(
      'SELECT id, status FROM user_subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subRes.rows[0].status === 'CANCELLED') {
      return res.status(400).json({ error: 'Subscription is already cancelled' });
    }

    // Cancel subscription
    const result = await db.query(
      `UPDATE user_subscriptions 
       SET status = 'CANCELLED', cancelled_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, plan_id, status, cancelled_at`,
      [subscriptionId]
    );

    const subscription = result.rows[0];
    res.json({ 
      success: true, 
      message: 'Subscription cancelled successfully',
      subscription 
    });
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// POST: Auto-lock price if plan is discontinued
// Called by admin when discontinuing a plan
router.post('/lock-price-for-plan/:planId', async (req, res) => {
  const { planId } = req.params;

  try {
    // Get plan details
    const planRes = await db.query(
      'SELECT id, price FROM plans WHERE id = $1',
      [planId]
    );

    if (planRes.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planRes.rows[0];

    // Update all active subscriptions for this plan to lock the price
    const result = await db.query(
      `UPDATE user_subscriptions 
       SET locked_price = $1, price_locked_at = NOW()
       WHERE plan_id = $2 AND status = 'ACTIVE' AND locked_price IS NULL
       RETURNING id, user_id, locked_price, price_locked_at`,
      [plan.price, planId]
    );

    res.json({ 
      success: true, 
      message: `Price locked for ${result.rowCount} active subscriptions`,
      lockedSubscriptions: result.rows 
    });
  } catch (err) {
    console.error('Error locking prices:', err);
    res.status(500).json({ error: 'Failed to lock prices' });
  }
});

// GET: Check if subscription plan is discontinued and price is locked
router.get('/:subscriptionId/price-status', authenticateToken, async (req, res) => {
  const { subscriptionId } = req.params;

  try {
    const result = await db.query(
      `SELECT 
        us.id,
        us.locked_price,
        us.price_locked_at,
        p.is_discontinued,
        p.price as current_price,
        p.title
      FROM user_subscriptions us
      JOIN plans p ON us.plan_id = p.id
      WHERE us.id = $1`,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const sub = result.rows[0];
    const priceStatus = {
      subscriptionId: sub.id,
      isDiscontinued: sub.is_discontinued,
      isPriceLocked: sub.locked_price !== null,
      lockedPrice: sub.locked_price,
      priceLockedAt: sub.price_locked_at,
      currentPrice: sub.current_price,
      planTitle: sub.title,
      displayPrice: sub.locked_price || sub.current_price,
    };

    res.json({ priceStatus });
  } catch (err) {
    console.error('Error checking price status:', err);
    res.status(500).json({ error: 'Failed to check price status' });
  }
});

// GET: Check card expiry and pause subscription if needed
router.post('/check-card-status/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    // Get active card
    const cardRes = await db.query(
      `SELECT id, expiry_month, expiry_year, is_active 
       FROM student_credit_cards 
       WHERE student_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [userId]
    );

    if (cardRes.rows.length === 0) {
      return res.json({ hasCard: false, isExpired: false });
    }

    const card = cardRes.rows[0];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const cardYear = parseInt(card.expiry_year, 10);
    const cardMonth = parseInt(card.expiry_month, 10);

    const isExpired = cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth);

    // If card is expired and subscription is active, pause it
    if (isExpired) {
      await db.query(
        `UPDATE user_subscriptions 
         SET status = 'PAUSED', auto_renew = FALSE
         WHERE user_id = $1 AND status = 'ACTIVE'
         RETURNING id`,
        [userId]
      );
    }

    res.json({ 
      hasCard: true, 
      isExpired, 
      message: isExpired ? 'Subscription paused due to expired card' : 'Card is valid' 
    });
  } catch (err) {
    console.error('Error checking card status:', err);
    res.status(500).json({ error: 'Failed to check card status' });
  }
});

// PUT: Update subscription status (for pausing/resuming)
router.put('/:subscriptionId/status', authenticateToken, async (req, res) => {
  const { subscriptionId } = req.params;
  const { status } = req.body;

  const validStatuses = ['ACTIVE', 'PAUSED', 'CANCELLED', 'INACTIVE', 'EXPIRED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await db.query(
      `UPDATE user_subscriptions 
       SET status = $1
       WHERE id = $2
       RETURNING id, status`,
      [status, subscriptionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ 
      success: true, 
      message: `Subscription ${status.toLowerCase()}`,
      subscription: result.rows[0] 
    });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update subscription status' });
  }
});

module.exports = router;
