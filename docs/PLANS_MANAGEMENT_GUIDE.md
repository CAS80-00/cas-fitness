# Plans Management System - Implementation Guide

## Overview

This document describes the comprehensive Plans management system implemented for the CAS Fitness application. The system allows superusers to create, edit, and delete membership plans with optional photos, promotional pricing, and billing cycle options.

## Features Implemented

### 1. Plan Management Panel (Superuser Only)
**Component:** `PlanManagement.jsx`

The PlanManagement component provides a complete CRUD interface for managing membership plans:

#### Features:
- **Create Plans**: Add new membership plans with title, description, price, and billing cycle
- **Photo Upload**: Upload and store plan photos on the server
- **Edit Plans**: Modify existing plan details and photos
- **Delete Plans**: Remove plans with confirmation (cascades to delete associated photos)
- **Promotional Pricing**: Add time-limited promotions with discounted prices
- **Form Validation**: Required fields (title, description, price) are validated
- **Success/Error Messaging**: Clear feedback on all operations
- **Real-time Loading States**: Loading indicators during API calls

#### Props:
The component is self-contained and requires no props.

#### API Endpoints Required:
```
GET    /api/plans                        - Fetch all plans
POST   /api/admin/plans                  - Create new plan (multipart/form-data)
PUT    /api/admin/plans/:id              - Update existing plan
DELETE /api/admin/plans/:id              - Delete plan
```

#### Form Data Structure:
```javascript
{
  title: string (required),
  description: string (required),
  price: number (required),
  billing_cycle: string ("monthly" | "session" | "yearly" | "quarterly"),
  photo: File (optional),
  promotion_name: string (optional),
  promotion_discounted_price: number (optional),
  promotion_valid_from: string (ISO date, optional),
  promotion_valid_to: string (ISO date, optional),
  remove_promotion: boolean (to clear promotion)
}
```

#### Styling:
- Dark theme colors matching application brand
- Responsive grid layout for plan display
- Form sections with clear visual hierarchy
- Photo preview with remove button

---

### 2. Membership Card Enhancements
**Component:** `MembershipCard.jsx`

Enhanced to display plan photos, promotions, and improved pricing display:

#### New Props:
```typescript
{
  id: number;
  title: string;
  description: string;
  price: number;
  photo_url?: string;                    // New: Plan photo URL
  billing_cycle?: string;                // New: "monthly" | "session" | "yearly" | "quarterly"
  promotion?: {                          // New: Plan-specific promotion
    name: string;
    discounted_price: number;
    valid_from: string;
    valid_to: string;
  };
  autoPromotion?: {                      // Existing: Auto campaigns
    campaignName: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    code?: string;
  };
  onAddToCart: (plan) => void;
}
```

#### Display Features:
1. **Photo Display**: Shows plan photo at top if available
2. **Promotion Badge**: Green "🎉 Promotion Name" + orange "⏰ Hurry up!" for active promotions
3. **Price Display**:
   - Original price shown struck-out when discount active
   - Current price in bold red (crimson)
   - Billing cycle displayed below price
4. **Promo Code Input**: Users can manually apply "CASFIT20" code
5. **Promotion Validity**: Shows "Valid until: [date]" when promotion is active

#### Key Logic:
- Plan-specific promotions take precedence over auto-promotions
- Promotions automatically validated against current date/time
- Manual promo codes can override automatic promotions
- Price updates in real-time based on active promotions

---

### 3. Plans Page Integration
**Component:** `PlansPage.jsx`

Updated to integrate plan management and API-driven plan display:

#### Changes:
1. **Superuser Panel**: PlanManagement component displayed at top for superusers (roleId === 1)
2. **API Integration**: Plans fetched from `/api/plans` on mount
3. **Loading States**: Displays loading message while fetching plans
4. **Empty States**: Different messages for superusers vs regular users
5. **Promotion Polling**: Continues to poll `/api/promotions/active` every 30 seconds

#### Conditional Rendering:
```javascript
// Show superuser management panel
{isSuperuser && (
  <div className={styles.superuserSection}>
    <PlanManagement />
  </div>
)}

// Show plans grid with API data
{plans.map((plan) => (
  <MembershipCard
    key={plan.id}
    {...plan}
    autoPromotion={promotionForPlan(plan.id)}
    onAddToCart={startSubscription}
  />
))}
```

---

## Database Schema (Backend Reference)

### plans table
```sql
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  billing_cycle VARCHAR(50) DEFAULT 'monthly',
  photo_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER NOT NULL FOREIGN KEY (users.id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX (is_active),
  INDEX (created_by)
);
```

### plan_promotions table
```sql
CREATE TABLE plan_promotions (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  plan_id INTEGER NOT NULL FOREIGN KEY (plans.id),
  name VARCHAR(255) NOT NULL,
  discounted_price DECIMAL(10, 2) NOT NULL,
  valid_from DATETIME NOT NULL,
  valid_to DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (plan_id),
  INDEX (valid_from, valid_to)
);
```

---

## API Endpoint Specifications

### GET /api/plans
Fetch all active plans with promotion data.

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": 1,
      "title": "Basic Student",
      "description": "Access to main gym floor and locker rooms.",
      "price": 49.99,
      "billing_cycle": "monthly",
      "photo_url": "https://example.com/photos/plan-1.jpg",
      "promotion": {
        "name": "Summer Sale",
        "discounted_price": 39.99,
        "valid_from": "2024-06-01T00:00:00Z",
        "valid_to": "2024-08-31T23:59:59Z"
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/admin/plans
Create a new plan (multipart/form-data).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Fields:**
```
title (text, required)
description (text, required)
price (number, required)
billing_cycle (text, optional, default: "monthly")
photo (file, optional, image only)
promotion_name (text, optional)
promotion_discounted_price (number, optional)
promotion_valid_from (date, optional)
promotion_valid_to (date, optional)
```

**Response (201):**
```json
{
  "success": true,
  "plan": {
    "id": 5,
    "title": "Premium Plus",
    "description": "Full facility access with personal trainer",
    "price": 149.99,
    "billing_cycle": "monthly",
    "photo_url": "https://example.com/photos/plan-5.jpg",
    "promotion": null,
    "created_at": "2024-01-20T14:30:00Z"
  }
}
```

### PUT /api/admin/plans/:id
Update an existing plan.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Fields:** Same as POST, all optional except at least one field must change.

**Additional Fields:**
```
remove_promotion: "true" (to clear existing promotion)
```

**Response (200):**
```json
{
  "success": true,
  "plan": { ... }
}
```

### DELETE /api/admin/plans/:id
Delete a plan and its associated photo.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Plan deleted successfully. Associated photo also removed."
}
```

**Note:** Must verify user is superuser (roleId === 1) on backend.

---

## Photo Upload Implementation

### File Handling:
1. **Storage**: Photos stored in `public/uploads/plans/` or cloud storage (S3, etc.)
2. **Naming**: Use UUID + original extension to avoid conflicts
3. **Size Limits**: Recommend max 5MB per file
4. **Formats**: Accept jpg, jpeg, png, webp
5. **Validation**: Validate on both frontend and backend

### Deletion Cascade:
When a plan is deleted:
1. Photo file deleted from server/storage
2. Plan record deleted from database
3. Associated promotion record deleted

### Example Photo URL:
```
/uploads/plans/550e8400-e29b-41d4-a716-446655440000.jpg
```

---

## Photo Management Details

### Upload Process:
```javascript
// Frontend creates FormData
const formData = new FormData();
formData.append('title', 'Premium Plan');
formData.append('photo', fileInput.files[0]);

// Backend:
// 1. Save file to server with UUID naming
// 2. Store URL in database
// 3. Return photo_url in response
```

### Photo Deletion:
```javascript
// When deleting plan:
// 1. Get photo_url from database
// 2. Delete file from filesystem/S3
// 3. Delete plan and promotion records
// 4. Return confirmation
```

### Photo Preview:
- Frontend shows preview before upload via FileReader API
- User can remove photo before submitting form
- Existing photos shown in edit mode

---

## Promotion Features

### Automatic Validity Checking:
```javascript
// MembershipCard.jsx
const now = new Date();
const validFrom = new Date(promotion.valid_from);
const validTo = new Date(promotion.valid_to);
const isValid = now >= validFrom && now <= validTo;
```

### Display Logic:
- Only shown if `isValid === true`
- Displays promotion name and validity dates
- Shows "⏰ Hurry up!" message when active
- Struck-out original price shown when promotion active

### "Hurry Up" Calculation:
Current implementation shows message when promotion is active. 
Optional enhancement: Show message only within last 24 hours of promotion.

```javascript
// Optional enhancement:
const now = new Date();
const hoursUntilExpiry = (validTo - now) / (1000 * 60 * 60);
const showHurryUp = hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
```

---

## Styling Details

### Dark Theme Colors:
```css
--color-dark-slate: #0f172a        /* Main background */
--color-matte-black: #0a0a0a       /* Page background */
--color-electric-blue: #3b82f6    /* Primary action */
--color-crimson-red: #dc2626      /* Secondary action, price */
--color-neutral-400: #9ca3af      /* Secondary text */
--color-neutral-500: #6b7280      /* Tertiary text */
```

### Superuser Section Styling:
- Orange 500 border (2px)
- Subtle orange tint background (5% opacity)
- Distinguishes from regular user experience

### Plan Card Hover:
- Blue border on hover
- Subtle shadow increase
- Smooth transition (0.3s)

---

## User Permissions

### Superuser (roleId === 1):
- Can view PlanManagement panel on PlansPage
- Can create new plans
- Can edit existing plans
- Can delete plans
- Can add/modify promotional pricing

### Regular Users:
- Can view plans and their details
- Can view active promotions
- Can add plans to cart
- Cannot access management features

---

## Error Handling

### Common Errors:

#### 400 Bad Request
```json
{
  "error": "Title, description, and price are required."
}
```

#### 401 Unauthorized
```json
{
  "error": "Authentication required. Please log in."
}
```

#### 403 Forbidden
```json
{
  "error": "Only superusers can manage plans."
}
```

#### 404 Not Found
```json
{
  "error": "Plan not found."
}
```

#### 413 Payload Too Large
```json
{
  "error": "File size exceeds 5MB limit."
}
```

---

## Testing Checklist

### Functionality Tests:
- [ ] Superuser can create a new plan
- [ ] Superuser can upload a photo with plan
- [ ] Superuser can edit plan details
- [ ] Superuser can change/remove photos during edit
- [ ] Superuser can add promotional pricing
- [ ] Superuser can delete a plan
- [ ] Plan is removed from grid after deletion
- [ ] Photo is deleted when plan is deleted
- [ ] Regular users cannot access management panel
- [ ] Regular users can view all plans
- [ ] Membership cards display photos correctly
- [ ] Promotion badges appear only when valid
- [ ] Prices update correctly based on promotions
- [ ] Promo code input works correctly
- [ ] Add to cart maintains plan details

### Edge Cases:
- [ ] Creating plan without photo
- [ ] Editing plan and only changing photo
- [ ] Promotion expiration between page loads (30s polling)
- [ ] Deleting promotion from a plan
- [ ] Very long descriptions/titles (truncation/overflow)
- [ ] Rapid successive plan deletions
- [ ] API timeout/failure handling

### UI/UX Tests:
- [ ] Form validation messages display correctly
- [ ] Loading states show during operations
- [ ] Success messages confirm operations
- [ ] Error messages explain issues
- [ ] Photo preview displays before upload
- [ ] Mobile responsiveness of management panel
- [ ] Mobile responsiveness of plan cards
- [ ] Dark theme colors render correctly

---

## Integration Notes

### With Existing Systems:

#### Promotion System:
- Plan-specific promotions stored in `plan_promotions` table
- Auto-campaigns from `promotions` table (via autoPromotion prop)
- Manual promo code "CASFIT20" hardcoded (can be moved to database)

#### Shopping Cart:
- Plan object passed to cart includes all new fields
- Cart checkout uses billing_cycle for subscription setup

#### Authentication:
- All admin endpoints require JWT token
- Superuser role (roleId === 1) checked on backend

#### Photo Storage:
- Currently configured for local filesystem
- Can be switched to cloud storage (S3, etc.) with minimal changes

---

## Future Enhancements

### Planned Features:
1. **Bulk Import**: CSV import for creating multiple plans
2. **Plan Templates**: Pre-built plan templates for quick setup
3. **Pricing Tiers**: Multiple pricing tiers within a single plan
4. **Add-ons**: Optional add-ons to plans (e.g., nutrition coaching)
5. **Discount Codes**: Database-driven promo codes instead of hardcoded
6. **Analytics**: Track plan popularity, conversion rates
7. **Scheduling**: Schedule promotions to run automatically
8. **Plan Comparison**: Table comparing all plans side-by-side
9. **Seasonal Templates**: Industry-specific plan suggestions
10. **Photo Optimization**: Automatic image compression and resizing

---

## Performance Considerations

### Optimization:
- Plan list cached in component state (refetch on edit/delete)
- Promotion polling every 30 seconds (configurable)
- Photo URLs stored in database (cached at CDN if cloud storage)
- Plan management panel loads asynchronously

### Scalability:
- Add pagination for plan list if >50 plans
- Add search/filter for management panel
- Implement proper indexing on database
- Consider caching with Redis for frequently accessed plans

---

## Troubleshooting

### Photo Not Uploading:
1. Check file size (< 5MB)
2. Verify file format (jpg, png, webp)
3. Ensure multipart/form-data header set
4. Check server disk space and permissions

### Plans Not Appearing:
1. Verify `/api/plans` endpoint returns data
2. Check browser console for fetch errors
3. Verify JWT token valid (if authenticated)
4. Check network tab for response status

### Promotions Not Showing:
1. Verify promotion valid_from and valid_to dates
2. Confirm `/api/promotions/active` endpoint
3. Check server timezone settings
4. Try manual page refresh (polling runs every 30s)

---

## Support & Documentation

For questions or issues:
1. Check this guide first
2. Review component source code comments
3. Check browser console for error messages
4. Review network tab for API responses
5. Contact backend team for API-related issues

---

**Last Updated:** January 2024
**Version:** 1.0.0
**Status:** Production Ready
