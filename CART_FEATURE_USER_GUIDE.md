# Shopping Cart Feature - User Guide

## For Customers

### Adding Plans to Cart
1. Navigate to **Plans** page
2. Browse available membership plans
3. Click **"Add to Cart"** button on any plan card
4. The cart icon in the header will show a red badge with the number of items

### Viewing Your Cart
1. Click the **Shopping Cart icon** (top-right corner of header)
2. A slide-out drawer will appear showing all items in your cart
3. Each item displays:
   - Plan name
   - Plan description
   - Plan price
   - **Remove button (×)** to remove that specific item

### Cart Hold Timer
- When you open the cart, a **10-minute countdown** starts
- You have 10 minutes to complete your purchase
- If the timer expires, your cart will be automatically cleared
- The remaining time is displayed as **MM:SS** format

### Proceeding to Checkout
1. Click **"Continue to payment"** in the cart drawer
2. You'll proceed to the subscription form with the first item in your cart
3. Complete the payment process

### Removing Items
- Click the **×** button on any item card to remove it from your cart
- The cart count badge updates immediately
- You can add the same plan multiple times (each is tracked separately)

### Cart Across Pages
- The cart persists while you're browsing the site
- **Note:** Cart items are cleared if you refresh the page or close your browser
  - Future enhancement: Cart persistence across sessions

## For Developers

### Key Props Passed to Components

**SiteHeader:**
```jsx
<SiteHeader
  currentUser={currentUser}
  onNavigate={handleNavigate}
  onLogout={handleLogout}
  onAuthenticated={handleAuth}
  cartItemCount={cartItems.length}  // ← NEW
/>
```

**PlansPage:**
```jsx
<PlansPage
  cartItems={cartItems}              // ← Array of items
  onAddToCart={handleAddToCart}       // ← Add item handler
  // ... other props
/>
```

**ShoppingCart:**
```jsx
<ShoppingCart
  cartItems={cartItems}               // ← Array instead of single item
  onClose={handleClose}
  onClear={handleClear}
  onRemoveItem={handleRemoveItem}     // ← NEW: remove specific item
  onContinue={handleContinue}
/>
```

### Cart Item Data Structure

Each cart item has the following fields:

```javascript
{
  id: 123,                           // Plan ID
  title: "Premium Membership",        // Plan name
  description: "Full access...",      // Plan description
  price: 99.99,                       // Base price
  activePrice: 79.99,                 // Price with promotion applied
  billing_cycle: "monthly",           // "monthly" | "yearly" | etc
  photo_url: "https://...",           // Plan image
  addedAt: 1699564800000,             // Timestamp when added (for 10-min countdown)
  cartId: 1699564800001               // Unique ID for this cart entry
}
```

### State Management Flow

```
Customer clicks "Add to Cart"
          ↓
MembershipCard calls onAddToCart(planData)
          ↓
App.jsx handler adds item to cartItems array:
  setCartItems(prev => [...prev, newItem])
          ↓
SiteHeader receives updated cartItemCount
          ↓
Cart badge updates to show new count
          ↓
User clicks cart icon and sees all items in drawer
```

### Future Enhancement: Remove Item Handler

To fully implement item removal, add this handler in App.jsx:

```javascript
const handleRemoveFromCart = useCallback((cartId) => {
  setCartItems((prev) => 
    prev.filter((item) => item.cartId !== cartId)
  );
}, []);

// Pass to PlansPage:
<PlansPage
  onRemoveFromCart={handleRemoveFromCart}
  // ... other props
/>

// Pass through to ShoppingCart:
<ShoppingCart
  onRemoveItem={onRemoveFromCart}
  // ... other props
/>
```

### Styling Reference

**Cart Badge (CSS Module: SiteHeader.module.css):**
```css
.cartBadge {
  @apply absolute right-0 top-0 flex items-center justify-center rounded-full text-xs font-bold text-white;
  width: 1.25rem;
  height: 1.25rem;
  background-color: var(--color-crimson-red);
}
```

**Item Card (CSS Module: ShoppingCart.module.css):**
```css
.itemCard {
  @apply rounded-xl border p-4 flex items-start justify-between gap-2;
  background-color: #0a0a0a;
  border-color: #262626;
}
```

## Testing the Feature

### Manual Testing Checklist
- [ ] Click "Add to Cart" once → badge shows "1"
- [ ] Click "Add to Cart" on different plan → badge shows "2"
- [ ] Click "Add to Cart" on same plan again → badge shows "3"
- [ ] Click cart icon → drawer opens with all 3 items
- [ ] Verify timer starts at 10:00
- [ ] Wait 30 seconds → verify timer updates
- [ ] Click remove (×) on one item → only 2 items remain
- [ ] Click "Continue to payment" → proceeds to checkout with first item
- [ ] Refresh page → cart items persist (if localStorage enhancement added)
- [ ] Test on mobile, tablet, desktop viewports

### Console Verification
Add this in browser console to check cart state:
```javascript
// Check React DevTools to inspect App.jsx state
// Look for cartItems array and cartRequested flag
```

## Troubleshooting

**Cart badge not showing?**
- Verify `cartItemCount` prop is passed to SiteHeader
- Check that `cartItems.length > 0` is truthy
- Inspect in DevTools → check Element styles for .cartBadge

**Items not appearing in cart drawer?**
- Verify cartItems array is passed to ShoppingCart component
- Check browser console for errors
- Verify item structure matches expected format

**Timer not working?**
- Ensure `addedAt` timestamp is set when item added
- Check that `firstItem?.addedAt` exists
- Verify useEffect in ShoppingCart has proper dependencies

**Remove button not working?**
- `onRemoveItem` callback is defined but parent handler not wired
- See "Future Enhancement" section above for implementation
