# Subscription Management Guide

## Overview

The CAS Fitness application supports three main ways to acquire subscriptions:

1. **Automatic (Default)** - New users get a free subscription automatically upon registration
2. **Payment** - Users purchase plans via the checkout flow on the Plans page
3. **Superuser Assignment** - Superusers manually create/manage subscriptions for members

---

## How Users Get Subscriptions

### 1. Automatic Free Subscription (Default)

Every new user who registers is automatically assigned a FREE subscription when they complete OTP verification.

**Backend Process:**
- When a user registers → verification code is sent
- When user verifies OTP → account becomes ACTIVE
- **Automatically**: A subscription is created with `plan_id = 1` (usually the free/default plan)

**Result:** Users can immediately access gym features (QR code, etc.) without any payment.

**Database Impact:**
```sql
-- Automatically inserted during registration
INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, auto_renew)
VALUES (user_id, 1, 'ACTIVE', NOW(), TRUE)
```

---

### 2. Payment/Checkout Flow

Users can purchase premium plans via the Plans page.

**User Journey:**
1. Navigate to **Plans** page
2. Click on a plan card
3. Fill subscription form (member info)
4. Enter payment details (test card: `4539148273410928`, exp: `12/28`, CVC: `123`, ZIP: `10001`)
5. Payment processed → Subscription created

**Endpoint:** `POST /api/payments/process`

**Test Card Details (Development):**
- Card Number: `4539148273410928`
- Expiration: `12/28`
- CVC: `123`
- ZIP: `10001`

---

### 3. Superuser Manual Assignment (NEW)

Superusers can now create and manage subscriptions for members directly from the member profile.

**Access Points:**
- **Superuser Dashboard** → Manage Members
- Click **"View Profile"** on any member
- Scroll to **"Subscriptions"** section
- Click **"+ Add Subscription"** button

---

## Superuser Subscription Management

### Viewing Member Subscriptions

When viewing a member profile as superuser:

1. Scroll to the **Subscriptions** section
2. View all active and past subscriptions
3. See subscription details:
   - Plan name and price
   - Subscription status (ACTIVE, INACTIVE, CANCELLED, EXPIRED)
   - Start date and end date
   - Auto-renew setting

### Creating a Subscription

**Steps:**

1. Go to member profile (Superuser Dashboard → Members → View Profile)
2. Find the **Subscriptions** section
3. Click **"+ Add Subscription"** button
4. Fill out the form:
   - **Plan**: Select from dropdown (required)
   - **Status**: Choose ACTIVE, INACTIVE, or EXPIRED
   - **Start Date**: When subscription begins (default: today)
   - **End Date**: When subscription expires (optional)
   - **Auto-Renew**: Toggle automatic renewal on/off
5. Click **"Create Subscription"** button

**Example:**
- Give a new member immediate access by creating an ACTIVE subscription
- Set a trial period by choosing an end date 30 days from now
- Don't auto-renew trial subscriptions

### Updating a Subscription

**Quick Actions:**
- Click **"Cancel Subscription"** button to mark as CANCELLED
- This prevents the member from accessing restricted features

**Via API:**
```bash
PUT /api/admin/subscriptions/{subscription_id}
{
  "status": "CANCELLED",
  "endDate": "2026-12-31",
  "autoRenew": false
}
```

### Deleting a Subscription

**Steps:**
1. Click **"Delete"** button on the subscription card
2. Confirm the deletion
3. Subscription is removed immediately

---

## API Endpoints (Backend)

### Get All Subscriptions for a User

```bash
GET /api/admin/subscriptions/user/{userId}
```

**Response:**
```json
{
  "subscriptions": [
    {
      "id": 1,
      "userId": "user-uuid",
      "planId": 2,
      "planTitle": "Premium",
      "planPrice": "29.99",
      "billingCycle": "monthly",
      "status": "ACTIVE",
      "startDate": "2026-10-01T00:00:00Z",
      "endDate": null,
      "autoRenew": true
    }
  ]
}
```

### Create a Subscription

```bash
POST /api/admin/subscriptions
Content-Type: application/json

{
  "userId": "user-uuid",
  "planId": 2,
  "status": "ACTIVE",
  "startDate": "2026-10-01T00:00:00Z",
  "endDate": null,
  "autoRenew": true
}
```

**Required Fields:**
- `userId` (string UUID)
- `planId` (integer)

**Optional Fields:**
- `status` (default: "ACTIVE")
- `startDate` (default: now)
- `endDate` (null = no expiration)
- `autoRenew` (default: false)

### Update a Subscription

```bash
PUT /api/admin/subscriptions/{subscriptionId}
Content-Type: application/json

{
  "status": "CANCELLED",
  "endDate": "2026-12-31T00:00:00Z",
  "autoRenew": false
}
```

**Updatable Fields:**
- `status` - "ACTIVE", "INACTIVE", "CANCELLED", "EXPIRED"
- `endDate` - Subscription expiration date
- `autoRenew` - Boolean

### Delete a Subscription

```bash
DELETE /api/admin/subscriptions/{subscriptionId}
```

---

## Database Schema

### `user_subscriptions` Table

```sql
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT REFERENCES plans(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT TRUE
);
```

**Status Values:**
- `ACTIVE` - Subscription is current and valid
- `INACTIVE` - Subscription exists but not active
- `CANCELLED` - User cancelled the subscription
- `EXPIRED` - Subscription end date has passed

---

## Subscription Statuses Explained

| Status | Meaning | Access Allowed | Notes |
|--------|---------|---|---|
| `ACTIVE` | Current valid subscription | ✅ Yes | User can access gym features |
| `INACTIVE` | Subscription disabled | ❌ No | Superuser manually deactivated |
| `CANCELLED` | User cancelled | ❌ No | Often set with end date |
| `EXPIRED` | Past end date | ❌ No | Auto-renewed subscriptions will have new entry |

---

## Use Cases & Examples

### Use Case 1: Grant Free Trial

**Scenario:** New gym member wants 30-day free trial

**Steps:**
1. Open member profile
2. Click "Add Subscription"
3. Select "Free Trial" plan (plan_id 1)
4. Set Status: ACTIVE
5. Set Start Date: Today
6. Set End Date: 30 days from now
7. Set Auto-Renew: OFF (so they must purchase after trial)
8. Click "Create Subscription"

### Use Case 2: Fix Payment Processing Error

**Scenario:** Member bought plan but subscription wasn't created

**Steps:**
1. Open member profile
2. Click "Add Subscription"
3. Select the plan they purchased
4. Set Status: ACTIVE
5. Set Start Date: Date of purchase
6. Set Auto-Renew: ON
7. Click "Create Subscription"

### Use Case 3: Cancel Membership

**Scenario:** Member wants to cancel their subscription

**Steps:**
1. Open member profile
2. Find the subscription to cancel
3. Click "Cancel Subscription"
4. (Optional) Set End Date to make it immediate

### Use Case 4: Issue Replacement Subscription

**Scenario:** Member had subscription expire, manual renewal needed

**Steps:**
1. Open member profile
2. Previous subscription shows as EXPIRED
3. Click "Add Subscription"
4. Select plan again
5. Set Status: ACTIVE
6. Set Start Date: Today
7. Click "Create Subscription"

---

## Common Scenarios

### "Why can't a new user scan the QR code?"

**Answer:** They don't have an ACTIVE subscription. Solutions:
1. Make sure they verified their email/OTP (auto-creates subscription)
2. Manually create a subscription via the member profile
3. Have them purchase a plan

### "Why doesn't the QR code display?"

**Answer:** The `/api/members/generate-pass` endpoint requires an ACTIVE subscription. The user's subscription status is:
- INACTIVE, CANCELLED, or EXPIRED → QR won't display
- No subscription record → QR won't display
- Status shows ACTIVE but still fails → Check database

### "How do I bulk assign subscriptions?"

**Answer:** Currently, subscriptions are created one-by-one via the UI. For bulk operations, use the API:
```bash
# For each user, call:
POST /api/admin/subscriptions
```

Future enhancement: Batch import CSV file with member IDs and plans.

---

## Frontend Components

### MemberSubscriptionManager.jsx

Located: `frontend/src/components/MemberSubscriptionManager.jsx`

**Props:**
- `memberId` (string) - UUID of the member
- `onSubscriptionUpdate` (function) - Callback when subscription changes

**Features:**
- Display all subscriptions for a member
- Create new subscriptions with form validation
- Update subscription status
- Delete subscriptions with confirmation
- Real-time error and success messages

**Usage:**
```jsx
<MemberSubscriptionManager 
  memberId={memberId}
  onSubscriptionUpdate={() => console.log("Subscriptions updated!")}
/>
```

---

## Troubleshooting

### "I don't see the Subscriptions section"

- Check user role is SUPERUSER
- Make sure you're viewing a member (role_id = 4), not an employee
- Try refreshing the page

### "Create Subscription button doesn't respond"

- Check browser console for errors
- Ensure valid JWT token in localStorage
- Verify plan was selected from dropdown
- Check network tab for failed API requests

### "Subscription created but QR code still shows error"

- Refresh page with Ctrl+Shift+R (hard refresh)
- Wait 5 seconds for QR code component to re-fetch
- Check member status is ACTIVE (not SUSPENDED or CANCELLED)

### "Can't delete subscription"

- Confirm you're logged in as SUPERUSER
- Check browser console for error messages
- Subscription ID might be invalid
- Try refreshing and trying again

---

## Future Enhancements

1. **Bulk Subscription Import**
   - CSV upload for assigning subscriptions to multiple members at once

2. **Auto-Renewal Engine**
   - Background job to auto-renew subscriptions and process charges

3. **Subscription History**
   - View past subscriptions and cancellation reasons
   - Track payment history per subscription

4. **Subscription Tiers**
   - Different access levels (basic, premium, elite)
   - Feature access based on subscription tier

5. **Prorated Refunds**
   - Calculate and process refunds for cancelled subscriptions
   - Automatic credit to account for early cancellations

6. **Usage Tracking**
   - Monitor subscription usage (sessions used, visits, etc.)
   - Warn members when approaching limits

---

## Related Documentation

- [Plans Management Guide](./PLANS_MANAGEMENT_GUIDE.md)
- [Superuser Dashboard Guide](./SUPERUSER_DASHBOARD_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
