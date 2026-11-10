# Automatic Subscription Renewal System - Implementation Guide

## Overview
The system now supports automatic recurring subscription payments. Superusers can set renewal frequencies, and the system will automatically charge students on their next payment date.

## What Was Added

### 1. Database Schema Changes
**New Fields in `user_subscriptions` table:**
- `renewal_frequency` - VARCHAR(50): WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY
- `next_renewal_date` - TIMESTAMPTZ: When the next charge will occur
- `last_renewal_date` - TIMESTAMPTZ: When the last renewal payment was processed
- `locked_price` - NUMERIC: Price lock for discontinued plans
- `price_locked_at` - TIMESTAMPTZ: When price was locked
- `cancelled_at` - TIMESTAMPTZ: When subscription was cancelled

**Migration Applied:**
- Run via: `backend/db/migrations/001-add-renewal-fields.sql`
- Status: ✅ Completed

### 2. Backend API Endpoints

#### Set Renewal Frequency (Superuser Only)
```
PUT /api/subscriptions/:subscriptionId/renewal-frequency
Authorization: Bearer <superuser_token>

Request Body:
{
  "renewal_frequency": "MONTHLY"  // or WEEKLY, BIWEEKLY, QUARTERLY, YEARLY
}

Response:
{
  "success": true,
  "message": "Renewal frequency set successfully",
  "subscription": {
    "id": 123,
    "renewal_frequency": "MONTHLY",
    "next_renewal_date": "2026-12-09T23:22:55Z",
    ...
  }
}
```

### 3. Backend Batch Job

**Location:** `backend/jobs/subscription-renewal.js`

**Features:**
- `processSubscriptionRenewals()` - Main function to process renewals
- `scheduleRenewalJob()` - Schedule to run on interval (default: hourly)

**How it Works:**
1. Queries for active subscriptions where `next_renewal_date <= NOW()`
2. Charges the student's saved Stripe payment method
3. On success: Calculates and stores next renewal date
4. On failure: Pauses subscription (requires reactivation with new card)

**Usage in server startup:**
```javascript
// In backend/server.js or main entry point
const { scheduleRenewalJob } = require('./jobs/subscription-renewal');
scheduleRenewalJob(); // Runs every hour
```

### 4. Frontend Components

#### SubscriptionManagement Component
**New Fields Displayed:**
- **Next Payment** - Shows `next_renewal_date` in human-readable format
- **Renewal Frequency** - Shows frequency (WEEKLY, MONTHLY, etc.)

**Location:** `frontend/src/components/SubscriptionManagement.jsx`

**Example Display:**
```
Plan: Premium Monthly
Price: $99.99/month
Start Date: Nov 9, 2026
Renewal Date: Dec 9, 2026
Next Payment: Dec 9, 2026
Renewal Frequency: MONTHLY
Status: ACTIVE
```

#### StudentProfile Component
**New Fields Displayed:**
- **Next Payment** - In Column 2 (Profile Info)
- Shows when the next payment will be charged

**Location:** `frontend/src/pages/StudentProfile.jsx`

## Workflow: How Renewal Works

### For Superusers (Setting Up Renewal)
1. Navigate to student's subscription in admin panel
2. Call the `PUT /subscriptions/:subscriptionId/renewal-frequency` endpoint
3. Select frequency (MONTHLY, QUARTERLY, etc.)
4. System calculates next renewal date and stores it
5. Student can see "Next Payment" in their profile

### For Automatic Renewal Job
1. Every hour (configurable), check for subscriptions needing renewal
2. Find all subscriptions where `next_renewal_date <= NOW()`
3. For each subscription:
   - Verify student has saved Stripe payment method
   - Create off-session payment with Stripe
   - If payment succeeds:
     - Calculate next renewal date
     - Update subscription's `next_renewal_date`
     - Update `last_renewal_date`
   - If payment fails:
     - Set subscription status to 'PAUSED'
     - Student must reactivate with valid card

### For Students
1. See their renewal frequency in "My Subscriptions"
2. See next payment date in Profile Info section
3. If payment fails, get prompted to update card to reactivate

## Configuration

### Running the Renewal Job

**Option 1: Immediate Test**
```bash
cd backend
node -e "const { processSubscriptionRenewals } = require('./jobs/subscription-renewal'); processSubscriptionRenewals().then(r => console.log(r));"
```

**Option 2: Scheduled (in server code)**
```javascript
const { scheduleRenewalJob } = require('./jobs/subscription-renewal');

// Start the scheduled job on server startup
if (process.env.ENABLE_RENEWAL_JOB === 'true') {
  scheduleRenewalJob();
  console.log('Subscription renewal job scheduled');
}
```

**Option 3: External Cron Job**
Create a cron job or scheduled task that runs:
```bash
curl -X POST http://localhost:5000/api/admin/process-renewals \
  -H "Authorization: Bearer <superuser_token>"
```

## Database Schema Update (Already Applied)

```sql
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS renewal_frequency VARCHAR(50),
ADD COLUMN IF NOT EXISTS next_renewal_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_renewal_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS price_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_renewal_date 
ON user_subscriptions(next_renewal_date) 
WHERE status = 'ACTIVE';
```

## Testing the System

### 1. Test Setting Renewal Frequency (as Superuser)
```bash
curl -X PUT http://localhost:5000/api/subscriptions/1/renewal-frequency \
  -H "Authorization: Bearer <superuser_token>" \
  -H "Content-Type: application/json" \
  -d '{"renewal_frequency": "MONTHLY"}'
```

### 2. Check Subscription Data
```bash
# Query the database
SELECT id, user_id, renewal_frequency, next_renewal_date, status 
FROM user_subscriptions 
WHERE id = 1;
```

### 3. Test Renewal Job
```bash
# From backend directory
node -e "const { processSubscriptionRenewals } = require('./jobs/subscription-renewal'); processSubscriptionRenewals().then(r => { console.log('Result:', r); process.exit(0); });"
```

## Files Modified

### Backend
- `backend/db/schema.sql` - Updated user_subscriptions table schema
- `backend/routes/subscriptions.js` - Added renewal frequency endpoint
- `backend/jobs/subscription-renewal.js` - NEW - Batch renewal job
- `backend/db/migrations/001-add-renewal-fields.sql` - NEW - Migration script

### Frontend
- `frontend/src/components/SubscriptionManagement.jsx` - Display renewal info
- `frontend/src/pages/StudentProfile.jsx` - Display next payment in profile

## Commits
- `64ad218` - Implement automated subscription renewal system

## Next Steps

1. ✅ Database migration applied
2. ✅ Backend code updated
3. ✅ Frontend code updated
4. ⏳ Enable the renewal job in server startup (add to backend/server.js)
5. ⏳ Test the full workflow
6. ⏳ Set up production cron job or scheduler

## Troubleshooting

**Issue: "Next Payment" not showing**
- Check that subscription has `next_renewal_date` in database
- Verify renewal_frequency is set to one of: WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY
- Refresh browser and reload subscription data

**Issue: Renewal job not processing**
- Check that `scheduleRenewalJob()` is called on server startup
- Verify Stripe API key is configured
- Check server logs for job execution messages
- Ensure payment methods are saved for students

**Issue: Payment failing during renewal**
- Verify Stripe payment method is saved and valid
- Check Stripe dashboard for declined payments
- Ensure billing amount matches plan price
- Check database for `price_locked_at` if plan discontinued

## Future Enhancements

- Web hook integration for Stripe events
- Email notifications before renewal
- Renewal payment retry logic
- Manual renewal trigger for superusers
- Renewal pause/resume functionality
- Customizable renewal frequencies per plan
