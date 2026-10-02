# Plans Management - Quick Reference Guide

## 🚀 Quick Start

### For Superusers
1. Navigate to Plans page
2. Look for orange-bordered "Manage Plans" section at top
3. Click "+ Add New Plan" button
4. Fill in form:
   - Title (required)
   - Description (required)
   - Price (required)
   - Billing Cycle (optional, default: monthly)
   - Photo (optional)
   - Promotion (optional)
5. Click "Create Plan"

### For Regular Users
1. Navigate to Plans page
2. Browse available plans with photos
3. See active promotions with "🎉" badge and "⏰ Hurry up!" message
4. Apply promo code "CASFIT20" if desired
5. Click "Add to Cart"

---

## 📁 File Structure

```
frontend/src/
├── components/
│   ├── PlanManagement.jsx          ← New! Plan CRUD interface
│   └── MembershipCard.jsx          ← Updated with photos & promotions
├── pages/
│   └── PlansPage.jsx               ← Updated to use API & PlanManagement
└── styles/
    ├── PlanManagement.module.css   ← New! Management panel styles
    ├── MembershipCard.module.css   ← Updated card styles
    └── PlansPage.module.css        ← Updated page styles
```

---

## 🔑 Key Components

### PlanManagement.jsx
**Purpose:** Superuser interface for managing plans

**Key State:**
```javascript
const [plans, setPlans] = useState([])      // All plans
const [showForm, setShowForm] = useState()  // Show create/edit form
const [editingPlan, setEditingPlan] = useState()  // Current edit
const [formData, setFormData] = useState()  // Form values
const [promoData, setPromoData] = useState() // Promotion values
```

**Key Methods:**
- `loadPlans()` - Fetch from `/api/plans`
- `handleSubmit()` - Create/update plan via POST/PUT
- `handleDeletePlan()` - Delete plan via DELETE
- `handlePhotoChange()` - Preview photo before upload

---

### MembershipCard.jsx - New Props
**Purpose:** Display individual plan card with photos and promotions

**New Props:**
```typescript
{
  photo_url?: string              // Plan photo URL
  billing_cycle?: string          // "monthly" | "session" | "yearly" | "quarterly"
  promotion?: {                   // Plan-specific promotion
    name: string
    discounted_price: number
    valid_from: string
    valid_to: string
  }
}
```

**Key Features:**
- Photo display (top of card)
- Promotion badge (top-right corner)
- Price display with strikethrough
- Billing cycle info
- Promo code input
- Add to cart button

---

### PlansPage.jsx - Key Changes
**Purpose:** Main plans shopping page

**New Features:**
- Superuser management panel integration
- Plans fetched from `/api/plans`
- Promotion polling every 30 seconds
- Loading/empty states

**New State:**
```javascript
const [plans, setPlans] = useState([])
const [plansLoading, setPlansLoading] = useState(true)
```

---

## 🎨 Styling

### New CSS Classes

**PlanManagement.module.css:**
- `.container` - Main management panel
- `.formContainer` - Create/edit form
- `.planCard` - Individual plan display in admin
- `.plansGrid` - Grid layout for plans

**MembershipCard.module.css:**
- `.photoContainer` - Photo display area
- `.promoBadge` - Promotion badge display
- `.currentPrice` - Price with color styling

**PlansPage.module.css:**
- `.superuserSection` - Orange-bordered admin panel
- `.loading` - Loading state styling
- `.empty` - Empty state styling

---

## 📊 API Endpoints Required

### GET /api/plans
Returns all plans with promotion data.

### POST /api/admin/plans
Create a new plan (multipart/form-data).

**Form Fields:**
```
title, description, price, billing_cycle, photo, 
promotion_name, promotion_discounted_price, 
promotion_valid_from, promotion_valid_to
```

### PUT /api/admin/plans/:id
Update a plan.

### DELETE /api/admin/plans/:id
Delete a plan.

---

## 🔄 Data Flow

### Creating a Plan
```
Form → handleSubmit() → FormData → POST /api/admin/plans 
→ loadPlans() → setState → Re-render
```

### Viewing Promotions
```
PlansPage mount → loadPlans() → MembershipCard checks validity 
→ Show badge if valid → Poll every 30 seconds
```

### Adding to Cart
```
"Add to Cart" → startSubscription() → Cart drawer → Checkout
```

---

## ⚙️ Configuration

### Promotion Polling Interval
**File:** `PlansPage.jsx`, line ~65
**Current:** 30 seconds
**Change:** Modify `setInterval(loadPromotions, 30000)`

### Billing Cycles
**File:** `PlanManagement.jsx`, line ~108
**Options:** monthly, session, yearly, quarterly
**Add more:** Add `<option>` in select

### Promo Code
**File:** `MembershipCard.jsx`, line ~121
**Current:** "CASFIT20"
**To change:** Modify validation logic

---

## 🐛 Quick Debugging

### Is PlanManagement showing?
```javascript
// In console:
console.log('roleId:', currentUser?.roleId); // Should be 1
```

### Are plans loading?
```javascript
// In console:
fetch('/api/plans').then(r => r.json()).then(console.log);
```

### Are promotions showing?
```javascript
// In console:
fetch('/api/promotions/active').then(r => r.json()).then(console.log);
// Check dates are valid
```

---

## ✅ Checklist for Backend

- [ ] GET /api/plans endpoint
- [ ] POST /api/admin/plans endpoint
- [ ] PUT /api/admin/plans/:id endpoint
- [ ] DELETE /api/admin/plans/:id endpoint
- [ ] plans database table
- [ ] plan_promotions table
- [ ] Photo upload/storage
- [ ] Photo deletion cascade
- [ ] Superuser auth checks
- [ ] Form validation

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| PlanManagement not showing | Check roleId === 1 |
| Plans not loading | Verify /api/plans endpoint |
| Photo not uploading | Check multipart/form-data header |
| Promotions not showing | Check date validity and wait 30s |
| Build error | Add @reference "./global.css" to CSS |

---

**Documentation Files:**
- `PLANS_MANAGEMENT_GUIDE.md` - Comprehensive guide
- `PHASE_3_SUMMARY.md` - Implementation summary
- This file - Quick reference

