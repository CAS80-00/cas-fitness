const db = require('../db/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const { sendPaymentReceipt } = require('../services/emailService');

/**
 * Batch job to process automatic subscription renewals
 * Runs periodically to check for subscriptions that need renewal
 */
async function processSubscriptionRenewals() {
  console.log('[Renewal Job] Starting subscription renewal process...');

  try {
    // Get all active subscriptions that need renewal
    const result = await db.query(
      `SELECT 
        us.id,
        us.user_id,
        us.plan_id,
        us.next_renewal_date,
        us.renewal_frequency,
        p.price,
        p.title,
        p.billing_cycle,
        u.email
      FROM user_subscriptions us
      JOIN plans p ON us.plan_id = p.id
      JOIN users u ON us.user_id = u.id
      WHERE us.status = 'ACTIVE'
        AND us.renewal_frequency IS NOT NULL
        AND us.next_renewal_date IS NOT NULL
        AND us.next_renewal_date <= NOW()
      ORDER BY us.next_renewal_date ASC`
    );

    if (result.rows.length === 0) {
      console.log('[Renewal Job] No subscriptions to renew');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`[Renewal Job] Found ${result.rows.length} subscriptions to renew`);

    let succeeded = 0;
    let failed = 0;

    // Process each subscription
    for (const sub of result.rows) {
      try {
        // Get payment methods for user
        const paymentMethods = await db.query(
          `SELECT stripe_payment_method_id FROM payment_methods 
           WHERE user_id = $1 AND is_default = true LIMIT 1`,
          [sub.user_id]
        );

        if (paymentMethods.rows.length === 0) {
          console.warn(`[Renewal Job] No default payment method for user ${sub.user_id}, marking subscription as PAUSED`);
          
          // Mark subscription as paused since there's no payment method
          await db.query(
            `UPDATE user_subscriptions 
             SET status = 'PAUSED', updated_at = NOW()
             WHERE id = $1`,
            [sub.id]
          );
          failed++;
          continue;
        }

        const paymentMethod = paymentMethods.rows[0].stripe_payment_method_id;

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(sub.price * 100),
          currency: 'usd',
          payment_method: paymentMethod,
          confirm: true,
          off_session: true,
          description: `Subscription renewal: ${sub.title} for ${sub.email}`,
          metadata: {
            subscription_id: sub.id,
            user_id: sub.user_id,
            type: 'renewal'
          }
        });

        if (paymentIntent.status === 'succeeded') {
          // Calculate next renewal date
          const lastRenewal = new Date();
          const nextRenewal = new Date(lastRenewal);
          
          const freq = sub.renewal_frequency;
          if (freq === 'WEEKLY') {
            nextRenewal.setDate(nextRenewal.getDate() + 7);
          } else if (freq === 'BIWEEKLY') {
            nextRenewal.setDate(nextRenewal.getDate() + 14);
          } else if (freq === 'MONTHLY') {
            nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          } else if (freq === 'QUARTERLY') {
            nextRenewal.setMonth(nextRenewal.getMonth() + 3);
          } else if (freq === 'YEARLY') {
            nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
          }

          // Log the transaction
          await db.query(
            `INSERT INTO transactions (user_email, plan_id, amount, stripe_transaction_id, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              sub.email,
              sub.plan_id,
              sub.price,
              paymentIntent.id,
              'succeeded',
              JSON.stringify({
                subscription_id: sub.id,
                type: 'renewal',
                plan_title: sub.title,
                billing_cycle: sub.billing_cycle
              })
            ]
          );

          // Update subscription with new renewal date
          await db.query(
            `UPDATE user_subscriptions 
             SET next_renewal_date = $1, 
                 last_renewal_date = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [nextRenewal, lastRenewal, sub.id]
          );

          // Send payment receipt to user
          try {
            await sendPaymentReceipt(
              sub.email,
              sub.user_id,
              sub.title,
              sub.price,
              paymentIntent.id,
              'renewal'
            );
          } catch (emailError) {
            console.error(`[Renewal Job] Failed to send receipt email for subscription ${sub.id}:`, emailError.message);
          }

          console.log(`[Renewal Job] Successfully renewed subscription ${sub.id} for ${sub.email}`);
          succeeded++;
        } else {
          console.warn(`[Renewal Job] Payment failed for subscription ${sub.id}, status: ${paymentIntent.status}`);
          
          // Log failed transaction
          await db.query(
            `INSERT INTO transactions (user_email, plan_id, amount, stripe_transaction_id, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              sub.email,
              sub.plan_id,
              sub.price,
              paymentIntent.id || 'failed-no-id',
              'failed',
              JSON.stringify({
                subscription_id: sub.id,
                type: 'renewal',
                plan_title: sub.title,
                error: paymentIntent.status
              })
            ]
          ).catch(dbErr => console.error('Failed to log transaction:', dbErr));
          
          // Mark as paused if payment failed
          await db.query(
            `UPDATE user_subscriptions 
             SET status = 'PAUSED', updated_at = NOW()
             WHERE id = $1`,
            [sub.id]
          );
          failed++;
        }
      } catch (error) {
        console.error(`[Renewal Job] Error processing subscription ${sub.id}:`, error.message);
        
        // Mark as paused on error
        await db.query(
          `UPDATE user_subscriptions 
           SET status = 'PAUSED', updated_at = NOW()
           WHERE id = $1`,
          [sub.id]
        ).catch(dbErr => console.error('Failed to update subscription status:', dbErr));
        
        failed++;
      }
    }

    console.log(`[Renewal Job] Completed. Succeeded: ${succeeded}, Failed: ${failed}`);
    return { processed: result.rows.length, succeeded, failed };
  } catch (error) {
    console.error('[Renewal Job] Fatal error:', error);
    return { processed: 0, succeeded: 0, failed: 0, error: error.message };
  }
}

/**
 * Schedule the renewal job to run every hour
 * Can be called from a cron job or scheduler
 */
function scheduleRenewalJob() {
  const intervalMs = 60 * 60 * 1000; // Run every hour
  
  setInterval(() => {
    processSubscriptionRenewals().catch(err => {
      console.error('[Renewal Job] Unhandled error:', err);
    });
  }, intervalMs);
  
  console.log('[Renewal Job] Scheduled to run every hour');
}

module.exports = {
  processSubscriptionRenewals,
  scheduleRenewalJob
};
