# Plan Reordering - Quick Testing Checklist

## Pre-Test Setup
- [ ] Backend running on `http://localhost:5000`
- [ ] Frontend running on `http://localhost:5174`
- [ ] Database migration applied: `node backend/db/migrate.js`

## Test Scenarios

### 1. Verify UI Rendering ✓
- [ ] Log in as superuser
- [ ] Navigate to Superuser Dashboard
- [ ] Click "Manage Plans" section
- [ ] Verify "🔀 Reorder Plans" button appears in header
- [ ] Verify "+ Add New Plan" button still visible

### 2. Enter Reorder Mode ✓
- [ ] Click "🔀 Reorder Plans" button
- [ ] Verify reordering list appears above plans grid
- [ ] Verify plans grid is hidden
- [ ] Verify list shows: number, plan title, up/down arrows
- [ ] Verify "Save Order" and "Cancel" buttons replace other buttons

### 3. Test Movement Controls ✓
- [ ] **First plan**: Verify ↑ button is DISABLED
- [ ] **First plan**: Click ↓, verify plan moves down one position
- [ ] **Last plan**: Verify ↓ button is DISABLED  
- [ ] **Last plan**: Click ↑, verify plan moves up one position
- [ ] **Middle plans**: Test ↑ and ↓ buttons work correctly
- [ ] **After move**: Verify numbering updates (1, 2, 3... N)

### 4. Test Save Functionality ✓
- [ ] Reorder 2-3 plans
- [ ] Click "Save Order"
- [ ] Verify success message appears (green)
- [ ] Verify plans grid reappears below
- [ ] Verify plans display in new order in grid

### 5. Test Persistence ✓
- [ ] After saving, refresh the page (F5)
- [ ] Verify plans remain in reordered position
- [ ] Check database: `SELECT id, title, display_order FROM plans ORDER BY display_order, id;`
- [ ] Verify display_order values match new sequence

### 6. Test Cancel ✓
- [ ] Click "🔀 Reorder Plans" again
- [ ] Reorder some plans
- [ ] Click "Cancel"
- [ ] Verify reordering list disappears
- [ ] Verify plans grid shows original order

### 7. Test Multiple Reorders ✓
- [ ] Reorder and save (e.g., move plan 3 to position 1)
- [ ] Reorder again immediately (e.g., swap positions 2 and 3)
- [ ] Click "Save Order"
- [ ] Verify new order persists

### 8. Test Public View ✓
- [ ] As superuser, set plans to custom order: [Elite, Basic, Pro, Teen]
- [ ] Log out (or open incognito window)
- [ ] Navigate to /plans page
- [ ] Verify public users see plans in superuser's custom order
- [ ] Verify order matches public UI (cards appear in new sequence)

### 9. Test Edge Cases ✓
- [ ] **Single plan**: Create scenario with 1 plan
  - [ ] Verify up/down arrows are disabled
  - [ ] Verify reorder mode still works
  
- [ ] **Duplicate order values**: Check database directly
  - [ ] All display_order values should be unique (0, 1, 2, 3...)
  - [ ] No gaps or duplicates

- [ ] **Add plan during reorder**: 
  - [ ] Plan Management → Reorder mode
  - [ ] Click Cancel
  - [ ] Click Add New Plan
  - [ ] Verify form still works

### 10. API Response Validation ✓
- [ ] Open browser DevTools (F12)
- [ ] Go to Network tab
- [ ] Click "Reorder Plans"
- [ ] Reorder plans and save
- [ ] Find POST request to `/api/plans/reorder`
- [ ] Verify request includes: `planOrder` array with id and displayOrder
- [ ] Verify response: `{ "success": true, "message": "Plans reordered successfully." }`

## Expected Behavior Summary

| Action | Expected Behavior |
|--------|------------------|
| Click Reorder | List mode activated, grid hidden |
| Move plan ↑ | Plan swaps with one above |
| Move plan ↓ | Plan swaps with one below |
| Save order | API call made, success message shown, grid reappears in new order |
| Cancel | Changes discarded, grid shows original order |
| Refresh page | Order persists from database |
| View as public | Plans appear in superuser's custom order |

## Database Verification Commands

```sql
-- Check display_order values are sequential
SELECT id, title, display_order FROM plans ORDER BY display_order, id;

-- Reset display_order to default (if needed)
UPDATE plans SET display_order = 0;

-- Verify column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'plans' AND column_name = 'display_order';
```

## Troubleshooting During Testing

| Issue | Solution |
|-------|----------|
| Reorder button not visible | Login as superuser (castech7777@gmail.com) |
| Column doesn't exist error | Run: `node backend/db/migrate.js` |
| Changes not saving | Check browser console for API errors |
| Plans not reordering in API response | Restart backend with: `npm start` |
| Frontend not reflecting changes | Hard refresh browser (Ctrl+Shift+R) |

## Sign-Off

- [ ] All 10 test scenarios passed
- [ ] Database correctly stores display_order values
- [ ] Public users see plans in custom order
- [ ] No errors in browser console
- [ ] No errors in server console

**Tested by:** ________________  
**Date:** ________________  
**Notes:** ________________________________________________________________
