# How Superusers Create Subscriptions - Quick Reference

## 3 Ways Users Get Subscriptions

### 1. **Automatic** (Free, happens immediately)
✅ New user registers → verifies OTP → **automatic free subscription created**
- No superuser action needed
- User can access gym immediately
- Good for freemium model or trials

### 2. **Payment** (User purchases on Plans page)
✅ User clicks plan → fills form → pays → **subscription created by payment system**
- User initiates, superuser doesn't need to do anything
- Happens automatically via checkout flow
- Test card: `4539148273410928`

### 3. **Superuser Assignment** (Manual creation) ⭐ NEW
✅ Superuser creates subscription directly in member profile
- No payment required
- Can assign any plan to any member
- Can set start/end dates and auto-renewal

---

## How to Create Subscription as Superuser

### Quick Steps:

1. **Open Superuser Dashboard**
2. **Click "Manage Members"**
3. **Find the member** (search by name/email)
4. **Click "View Profile"**
5. **Scroll to "Subscriptions" section**
6. **Click "+ Add Subscription"**
7. **Fill the form:**
   - Plan: *Select from list*
   - Status: ACTIVE (for immediate access)
   - Start Date: Today
   - End Date: *(Leave empty for no expiration)*
   - Auto-Renew: Yes/No
8. **Click "Create Subscription"**

✅ **Done!** Member now has access to the plan.

---

## What You Can Do

### Create
- Assign any plan to any member
- Set trial periods (with end dates)
- Activate immediately or for future dates

### Update
- Cancel a subscription (click "Cancel Subscription")
- Change status from ACTIVE to other states

### Delete
- Remove subscriptions (click "Delete" button)
- Requires confirmation

### View
- See all member subscriptions
- View dates, pricing, status

---

## Common Use Cases

| Scenario | Steps |
|----------|-------|
| **New member needs immediate access** | Create subscription with Status=ACTIVE |
| **Give 30-day free trial** | Create subscription, set End Date 30 days out, Auto-Renew=NO |
| **Member paid but subscription didn't create** | Manually create subscription with correct plan |
| **Cancel membership** | Click "Cancel Subscription" button |
| **Member says "I can't access QR code"** | Check if subscription Status=ACTIVE |

---

## Subscription Status Meanings

| Status | Meaning | Member Access |
|--------|---------|---|
| 🟢 ACTIVE | Currently valid | ✅ Can use gym |
| 🔴 INACTIVE | Disabled | ❌ Blocked |
| 🟠 CANCELLED | User cancelled | ❌ Blocked |
| 🟣 EXPIRED | Past end date | ❌ Blocked |

---

## API Endpoints (For Developers)

```bash
# Get subscriptions for a member
GET /api/admin/subscriptions/user/{userId}

# Create subscription
POST /api/admin/subscriptions
Body: { userId, planId, status, startDate, endDate, autoRenew }

# Update subscription
PUT /api/admin/subscriptions/{subscriptionId}
Body: { status, endDate, autoRenew }

# Delete subscription
DELETE /api/admin/subscriptions/{subscriptionId}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Don't see Subscriptions section" | Make sure you're viewing a MEMBER (not employee) profile |
| "QR code still shows error after creating subscription" | Refresh page (Ctrl+Shift+R) and wait 5 seconds |
| "Can't create subscription" | Select a plan from dropdown, check you're logged in as superuser |
| "Delete button not working" | Confirm deletion in the popup, check browser console for errors |

---

## Key Points

✅ **Automatic**: Every new user gets a free subscription on registration  
✅ **Easy**: One-click creation in member profile  
✅ **Flexible**: Set dates, status, auto-renewal  
✅ **No payment needed**: Superuser can assign any plan  
✅ **Instant access**: Members can use QR code immediately after creation  

---

## Need More Help?

See [SUBSCRIPTION_MANAGEMENT_GUIDE.md](./SUBSCRIPTION_MANAGEMENT_GUIDE.md) for detailed documentation.
