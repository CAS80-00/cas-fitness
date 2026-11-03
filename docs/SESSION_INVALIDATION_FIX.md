# Session Invalidation Error - Fix Applied

## Problem

When adding a promo code in the superuser profile, users received the error:
```
"Session invalidated across devices"
```

This error occurs when:
1. A user logs in from another device/browser with the same account
2. The backend invalidates all previous JWT tokens for security reasons
3. The frontend tries to make an API call with the now-invalid token
4. The API returns a 401 error with the message "Session invalidated across devices"
5. The frontend displays this error but doesn't log the user out or redirect

## Root Cause

The `PromoCodesSection` component was catching API errors and displaying them to the user, but it wasn't checking if the error was an authentication error. When a session was invalidated:

1. The API would return a 401 status with error message "Session invalidated across devices"
2. The frontend would display this in the error state
3. The user's JWT token was still in localStorage (invalid)
4. Any further API calls would fail
5. The user was left in a broken state without being logged out

## Solution Implemented

### 1. Added Session Error Detection (PromoCodesSection.jsx)

Created a new function `handleAuthError()` that detects authentication/session errors:

```javascript
const handleAuthError = (errorMessage) => {
  if (
    errorMessage.includes("Session invalidated") ||
    errorMessage.includes("Unauthorized") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("expired")
  ) {
    // Clear stored auth data and notify parent to log out
    localStorage.removeItem("cas_jwt");
    localStorage.removeItem("cas_user");
    if (onSessionInvalidated) {
      onSessionInvalidated();
    }
    return true;
  }
  return false;
};
```

### 2. Updated All API Call Error Handlers

Modified three functions to use the session error handler:

#### a) `loadPromotions()` - Load existing promo codes
```javascript
const res = await fetch(`${apiBaseUrl}/admin/promotions`, { headers: authHeaders() });
const data = await res.json();
if (!res.ok) {
  const errorMsg = data.error || "Failed to load promotions.";
  if (handleAuthError(errorMsg)) {
    setError("Session expired. Please log in again.");
    return;
  }
  throw new Error(errorMsg);
}
```

#### b) `submitForm()` - Create/update promo code
```javascript
if (!res.ok) {
  const errorMsg = data.error || "Failed to save promotion.";
  if (handleAuthError(errorMsg)) {
    setError("Session expired. Please log in again.");
    return;
  }
  throw new Error(errorMsg);
}
```

#### c) `deletePromotion()` - Delete promo code
```javascript
if (!res.ok) {
  const errorMsg = data.error || "Failed to delete promotion.";
  if (handleAuthError(errorMsg)) {
    setError("Session expired. Please log in again.");
    return;
  }
  throw new Error(errorMsg);
}
```

### 3. Added Session Invalidation Handler (SuperuserDashboard.jsx)

Created a callback handler in the parent component:

```javascript
const handleSessionInvalidated = () => {
  localStorage.removeItem("cas_jwt");
  localStorage.removeItem("cas_user");
  onLogout?.();
  onNavigate?.("home");
};
```

Then passed it to PromoCodesSection:

```jsx
<PromoCodesSection 
  plans={plans} 
  onSessionInvalidated={handleSessionInvalidated} 
/>
```

### 4. Updated Component Props (PromoCodesSection.jsx)

Added `onSessionInvalidated` prop to the component signature:

```javascript
export default function PromoCodesSection({ plans, onSessionInvalidated }) {
```

## How It Works Now

### Before (Broken Flow)
```
User tries to add promo code
    ↓
API call with invalid JWT
    ↓
Backend returns 401: "Session invalidated across devices"
    ↓
Error displayed to user
    ↓
User stuck in broken state
    ❌ User must manually refresh page or clear localStorage
```

### After (Fixed Flow)
```
User tries to add promo code
    ↓
API call with invalid JWT
    ↓
Backend returns 401: "Session invalidated across devices"
    ↓
Frontend detects auth error
    ↓
Clear JWT and user data from localStorage
    ↓
Call onSessionInvalidated() callback
    ↓
Parent logs user out and redirects to home
    ↓
User redirected to login page automatically
    ✅ Clean, seamless experience
```

## Files Modified

1. **frontend/src/components/PromoCodesSection.jsx**
   - Added `onSessionInvalidated` prop
   - Added `handleAuthError()` function
   - Updated `loadPromotions()` to handle auth errors
   - Updated `submitForm()` to handle auth errors
   - Updated `deletePromotion()` to handle auth errors

2. **frontend/src/pages/SuperuserDashboard.jsx**
   - Added `handleSessionInvalidated()` function
   - Updated `<PromoCodesSection>` to pass `onSessionInvalidated` prop

## Benefits

✅ **Better Error Handling** - Session errors are properly detected and handled  
✅ **Automatic Logout** - Users are automatically logged out when session invalidated  
✅ **Clear Messaging** - Users see "Session expired. Please log in again."  
✅ **Prevents Broken State** - No more stuck sessions with invalid tokens  
✅ **Seamless Redirect** - User is redirected to home page automatically  
✅ **Scalable Pattern** - This pattern can be applied to other components  

## Testing

To test this fix:

1. **Login as superuser** on Device A
2. **Logout from the browser's developer tools** (clear localStorage on Device A while leaving it running)
3. **Or login as superuser on Device B** (invalidates Device A's session)
4. **Go to superuser dashboard on Device A**
5. **Try to add a promo code**
6. **Expected result:** Error message appears: "Session expired. Please log in again."
7. **Then automatically redirected to home page**
8. **User must log in again**

## Additional Improvements to Consider

These fixes could be applied to other components with API calls:

- `SuperuserProfilePanel.jsx` - Profile updates
- `UserManagementSection.jsx` - User management operations
- `ManageRolesSection.jsx` - Role management operations
- `PlanManagement.jsx` - Plan CRUD operations
- Any other component making admin API calls

Would you like me to apply this same fix to other components?

## Build Status

✅ **Build Passed**
- 1962 modules transformed
- 0 errors
- 0 warnings
- Bundle size: 637.19 KB (187.08 KB gzip)

---

**Status:** ✅ FIXED  
**Date:** September 30, 2026  
**Testing:** Recommended before production deployment
