-- Add billing_cycle column to user_subscriptions table
-- This allows superusers to set or override the billing cycle when creating a subscription

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(50);

-- Create an index for better query performance when filtering by billing cycle
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_billing_cycle 
ON user_subscriptions(billing_cycle);
