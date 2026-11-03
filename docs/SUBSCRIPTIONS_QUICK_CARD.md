# 🎯 SUBSCRIPTIONS - Quick Reference Card

## How Someone Gets a Subscription

```
┌─────────────────────────────────────────────────────────────────┐
│                    3 WAYS TO GET A SUBSCRIPTION                 │
└─────────────────────────────────────────────────────────────────┘

1️⃣  AUTOMATIC (Default)
   └─ Register → Verify OTP → ✅ FREE subscription created
      • No payment needed
      • Immediate gym access
      • Everyone gets this

2️⃣  PAYMENT (User purchases)
   └─ Plans page → Select plan → Pay → ✅ Subscription created
      • User initiates
      • Premium plans available
      • Test card: 4539148273410928

3️⃣  SUPERUSER (Manual assignment)
   └─ Dashboard → Members → View Profile → Create → ✅ Subscription created
      • No payment needed
      • Any plan can be assigned
      • Set trials, dates, auto-renewal
      • NEW FEATURE! ⭐
```

---

## 👤 How Superusers Create Subscriptions

### The UI Path:
```
Superuser Dashboard
    ↓
"Manage Members" tab
    ↓
Find member (search by name/email)
    ↓
Click "View Profile"
    ↓
Scroll to "Subscriptions" section
    ↓
Click "+ Add Subscription"
    ↓
Fill form:
  • Plan: [dropdown]
  • Status: ACTIVE
  • Start Date: [date picker]
  • End Date: [date picker or leave blank]
  • Auto-Renew: [toggle]
    ↓
Click "Create Subscription"
    ↓
✅ Member now has access!
```

---

## 📋 Subscription Statuses

```
🟢 ACTIVE
   Status: Member can use gym
   When: Subscription is current and valid
   Action: Used for active members

🔴 INACTIVE
   Status: Member blocked
   When: Superuser deactivated it
   Action: Member can't access anything

🟠 CANCELLED
   Status: Member blocked
   When: User or superuser cancelled
   Action: Can't revert (create new one)

🟣 EXPIRED
   Status: Member blocked
   When: End date has passed
   Action: Create new subscription to re-activate
```

---

## 🔧 Common Superuser Tasks

### ✅ Create a Free Trial (30 days)
```
Form:
  Plan: Basic Plan
  Status: ACTIVE
  Start Date: Today
  End Date: +30 days
  Auto-Renew: OFF
  
Result: Member has 30 days, then must purchase
```

### ✅ Fix Payment Processing Bug
```
Situation: Member paid but no subscription created

Form:
  Plan: Premium Plan
  Status: ACTIVE
  Start Date: [Date they paid]
  End Date: [Leave blank]
  Auto-Renew: ON
  
Result: Subscription created backdated
```

### ✅ Cancel a Member's Subscription
```
Option 1 (Quick):
  Find subscription
  Click "Cancel Subscription" button
  ✅ Done

Option 2 (Scheduled):
  Click subscription
  Set Status: CANCELLED
  Set End Date: [When they lose access]
  Click Update
```

### ✅ Give Employee Free Membership
```
Form:
  Plan: Premium
  Status: ACTIVE
  Start Date: Today
  End Date: [Leave blank] (no expiration)
  Auto-Renew: ON
  
Result: Permanent premium access
```

---

## 🎯 What Happens After Create

```
You click "Create Subscription"
           ↓
Backend creates entry in user_subscriptions table
           ↓
Member profile immediately shows it
           ↓
QR code generator can now create passes
           ↓
Member can scan into gym!
           ↓
Status: ACTIVE ✅
```

---

## ⚡ API Quick Reference

### Create (Superuser Tool)
```bash
POST /api/admin/subscriptions
{
  "userId": "member-uuid",
  "planId": 2,
  "status": "ACTIVE",
  "startDate": "2026-10-01",
  "endDate": null,
  "autoRenew": true
}
```

### Read (Superuser Tool)
```bash
GET /api/admin/subscriptions/user/{userId}
→ Returns all subscriptions with plan details
```

### Update (Superuser Tool)
```bash
PUT /api/admin/subscriptions/{id}
{
  "status": "CANCELLED",
  "endDate": "2026-12-31"
}
```

### Delete (Superuser Tool)
```bash
DELETE /api/admin/subscriptions/{id}
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| **"I don't see Subscriptions in profile"** | Make sure viewing a MEMBER (role_id=4), not employee |
| **"Create button won't click"** | Must select a plan from dropdown |
| **"Member says QR code not working"** | Check subscription Status=ACTIVE and page refresh |
| **"Can't find member"** | Use search box, search by name/email/phone |
| **"Subscription created but not showing"** | Refresh page (Ctrl+F5) |
| **"Delete button grayed out"** | Isn't grayed out - click it and confirm |

---

## 📊 Status Decision Tree

```
Does member need access?
  ├─ YES, immediately
  │  └─ Create with Status: ACTIVE, End Date: [blank]
  │
  ├─ YES, but for limited time (trial)
  │  └─ Create with Status: ACTIVE, End Date: [+30 days], Auto-Renew: OFF
  │
  └─ NO, block access
     └─ Click "Cancel Subscription" or Delete
```

---

## 🏆 Best Practices

✅ **Always set Auto-Renew = ON** for ongoing memberships  
✅ **Set End Dates for trials** so they don't forget to purchase  
✅ **Use Start Date = today** for immediate activation  
✅ **Check subscription status** if member says features not working  
✅ **Keep notes** about why membership was given (trial, staff, etc.)  
✅ **Communicate** with member when subscription changes  

❌ **Don't** delete active subscriptions (Cancel instead)  
❌ **Don't** set future start dates unless it's scheduled  
❌ **Don't** leave End Date blank for trials (they'll have forever)  

---

## 📞 Quick Help

**"How do I know if it worked?"**
→ Member subscription appears in the list with green ACTIVE badge

**"Can I undo a subscription?"**
→ No, but you can Cancel or Delete it, then create a new one

**"What if I make a mistake?"**
→ Just delete it (confirm) and create a new one correctly

**"When does the subscription start?"**
→ Immediately at the Start Date you set

**"When does it end?"**
→ At End Date you set, or never if blank

---

## 🎓 Learn More

- Full guide: `SUBSCRIPTION_MANAGEMENT_GUIDE.md`
- Quick start: `HOW_TO_CREATE_SUBSCRIPTIONS.md`
- System overview: `SUBSCRIPTION_SYSTEM_SUMMARY.md`

---

**Superuser Subscription Management is LIVE! 🚀**
