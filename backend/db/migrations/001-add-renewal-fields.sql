-- Migration: Add renewal frequency and next renewal date fields to user_subscriptions
-- This migration adds support for automatic subscription renewal

-- Add new columns if they don't already exist
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS renewal_frequency VARCHAR(50),
ADD COLUMN IF NOT EXISTS next_renewal_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_renewal_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS price_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create an index on next_renewal_date for efficient query of pending renewals
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_renewal_date 
ON user_subscriptions(next_renewal_date) 
WHERE status = 'ACTIVE';
