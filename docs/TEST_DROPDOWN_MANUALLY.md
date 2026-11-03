# 🧪 MANUAL TESTING GUIDE - DROPDOWN MENU

## Pre-Test Checklist

✅ Frontend build completed successfully (npm run build)
✅ Build shows: 0 errors, 0 warnings
✅ Browser cache cleared
✅ Page refreshed with Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## Test 1: SuperuserProfilePanel - Edit Phone

### Steps:
1. Open application and login as Superuser
2. Navigate to **Dashboard** → **Profile** (or similar superuser section)
3. Click **Edit** button on profile card
4. Scroll down to find **Phone Number** field
5. Click on the **country code button** (e.g., "+1 ▼")

### Expected Result:
```
✅ Dropdown menu appears below the input
✅ Search box appears at top of dropdown
✅ List of 195+ countries displays
✅ Countries show: name (left) and code (right)
   Example: "United States                              +1"
```

### Next Steps:
6. Type "united" in the search box
7. List should filter to show only matching countries

### Expected Result:
```
✅ Search filters in real-time
✅ Shows:
   - United States                         +1
   - United Kingdom                        +44
   - United Arab Emirates                  +971
   - And other "united" countries
```

### Next Steps:
8. Click on **"United Kingdom +44"**

### Expected Result:
```
✅ Dropdown closes
✅ Button now shows "+44 ▼"
✅ Phone input field is now active
```

### Next Steps:
9. Enter a phone number: "7911123456"
10. Click **Save Changes** button

### Expected Result:
```
✅ Form submits successfully
✅ Profile updated
✅ Phone saved as: "+447911123456"
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 2: Add Employee - Phone with Country Code

### Steps:
1. Navigate to **Dashboard** → **Manage Employees**
2. Click **Add Employee** button
3. Fill in form:
   - First Name: "John"
   - Last Name: "Doe"
   - Email: "john@example.com"
4. Locate **Phone** field
5. Click on the **country code button** ("+1 ▼")

### Expected Result:
```
✅ Dropdown appears with countries
✅ Search box is ready for input
✅ Full country list visible
```

### Next Steps:
6. Type "canada" to search
7. Click on **Canada +1**

### Expected Result:
```
✅ Dropdown closes
✅ Country code shows "+1"
✅ Phone field ready for input
```

### Next Steps:
8. Enter phone: "4165551234"
9. Select role and click **Authorize Log In**

### Expected Result:
```
✅ Employee created successfully
✅ Phone number saved with country code: "+14165551234"
✅ Success message appears
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 3: Add Member - Phone Selection

### Steps:
1. Navigate to **Dashboard** → **Manage Members**
2. Click **Add Member** button
3. Fill in member information
4. Find **Phone** field
5. Click country code button

### Expected Result:
```
✅ Dropdown displays with country list
✅ Search functionality works
✅ Can select any country from list
```

### Next Steps:
6. Search for "france"
7. Click on **France +33**
8. Enter phone: "123456789"
9. Complete form and submit

### Expected Result:
```
✅ Member created with phone: "+33123456789"
✅ Country code persisted
✅ Data saved to database
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 4: Edit Member - Modify Phone Country

### Steps:
1. Go to **Manage Members**
2. Find an existing member
3. Click **View Profile Dashboard**
4. Detail modal opens
5. Scroll to **Phone** field
6. Click country code button

### Expected Result:
```
✅ Dropdown appears in modal
✅ Dropdown is above modal content (not hidden)
✅ Search and selection work normally
```

### Next Steps:
7. Change country (e.g., from +1 to +44)
8. Modify phone number if desired
9. Click **Save Changes**

### Expected Result:
```
✅ Modal closes
✅ Changes saved
✅ Phone shows new country code
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 5: Dropdown Search - All Scenarios

### Scenario A: Search by Country Name
```
Search Term: "united"
Expected Results:
  ✅ United States +1
  ✅ United Kingdom +44
  ✅ United Arab Emirates +971
```

**Status: _______  (Pass/Fail)**

### Scenario B: Search by Country Code
```
Search Term: "+1"
Expected Results:
  ✅ All countries with +1 code shown
  ✅ United States +1
  ✅ Canada +1
  ✅ Others...
```

**Status: _______  (Pass/Fail)**

### Scenario C: Search by ISO Code
```
Search Term: "GB"
Expected Results:
  ✅ United Kingdom +44
```

**Status: _______  (Pass/Fail)**

### Scenario D: Partial Search
```
Search Term: "jap"
Expected Results:
  ✅ Japan +81
```

**Status: _______  (Pass/Fail)**

### Scenario E: No Results
```
Search Term: "xyz123"
Expected Results:
  ✅ "No countries found" message appears
```

**Status: _______  (Pass/Fail)**

---

## Test 6: Mobile Responsiveness

### Steps (Mobile Device):
1. Open application on mobile device (or use browser dev tools)
2. Set viewport to mobile (320px - 767px width)
3. Navigate to form with phone field
4. Click country code button

### Expected Result:
```
✅ Dropdown displays in full width
✅ Search box is easily accessible
✅ Country list items are touch-sized
✅ No horizontal scrolling needed
```

### Next Steps:
5. Scroll through country list
6. Search for country
7. Select a country

### Expected Result:
```
✅ All interactions work on mobile
✅ Dropdown is fully scrollable
✅ Selection registers correctly
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 7: Edge Cases

### Edge Case 1: Re-open Dropdown
```
Steps:
1. Click country button → opens
2. Click country button again → closes
3. Click country button again → opens

Expected: ✅ Can toggle open/closed
```

**Status: _______  (Pass/Fail)**

### Edge Case 2: Click Outside
```
Steps:
1. Open dropdown
2. Click somewhere outside dropdown

Expected: ✅ Dropdown closes automatically
```

**Status: _______  (Pass/Fail)**

### Edge Case 3: Clear Search
```
Steps:
1. Open dropdown
2. Type search term
3. Delete all text in search

Expected: ✅ Full list of 195 countries reappears
```

**Status: _______  (Pass/Fail)**

### Edge Case 4: Rapid Country Changes
```
Steps:
1. Open dropdown
2. Select USA (+1)
3. Click button again
4. Select UK (+44)
5. Click button again
6. Select France (+33)

Expected: ✅ All changes register correctly
```

**Status: _______  (Pass/Fail)**

### Edge Case 5: Tab Navigation
```
Steps:
1. Tab to country button
2. Press Enter to open
3. Type to search
4. Press Arrow keys to navigate
5. Press Enter to select

Expected: ✅ Keyboard navigation works
```

**Status: _______  (Pass/Fail)**

---

## Test 8: Data Persistence

### Steps:
1. Select a country (e.g., Germany +49)
2. Enter phone number
3. Save/Submit form
4. Navigate away from page
5. Return to same form/page
6. Check phone field

### Expected Result:
```
✅ Country code is still +49
✅ Phone number is preserved
✅ Data persisted to database
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 9: Multiple Forms Simultaneously

### Steps:
1. Open form 1 with phone field (e.g., Add Employee)
2. Open form 2 in new tab with phone field (e.g., Add Member)
3. Click dropdown in form 1
4. Select a country
5. Switch to form 2 tab
6. Click dropdown in form 2
7. Select a different country

### Expected Result:
```
✅ Form 1 shows selected country +1
✅ Form 2 shows selected country +44
✅ No interference between forms
✅ Each form maintains its own state
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Test 10: Accessibility

### Steps:
1. Open form with phone field
2. Use Tab key to navigate to country button
3. Press Enter to open dropdown
4. Use arrow keys to navigate countries
5. Use screen reader (NVDA, JAWS, or VoiceOver)

### Expected Result:
```
✅ Button is keyboard accessible
✅ Dropdown opens with keyboard
✅ Countries can be selected with keyboard
✅ Screen reader announces countries
✅ No visual focus is lost
```

### Status: _______  (Pass/Fail)
### Notes: _____________________________________________

---

## Summary

| Test # | Name | Status | Pass/Fail |
|--------|------|--------|-----------|
| 1 | SuperuserProfilePanel Edit | _______ | _______ |
| 2 | Add Employee Phone | _______ | _______ |
| 3 | Add Member Phone | _______ | _______ |
| 4 | Edit Member Phone | _______ | _______ |
| 5A | Search by Name | _______ | _______ |
| 5B | Search by Code | _______ | _______ |
| 5C | Search by ISO | _______ | _______ |
| 5D | Partial Search | _______ | _______ |
| 5E | No Results | _______ | _______ |
| 6 | Mobile Responsive | _______ | _______ |
| 7A | Toggle Open/Close | _______ | _______ |
| 7B | Click Outside | _______ | _______ |
| 7C | Clear Search | _______ | _______ |
| 7D | Rapid Changes | _______ | _______ |
| 7E | Keyboard Navigation | _______ | _______ |
| 8 | Data Persistence | _______ | _______ |
| 9 | Multiple Forms | _______ | _______ |
| 10 | Accessibility | _______ | _______ |

---

## Overall Result

**Total Tests Passed: ___ / 18**

### Status Options:
- ✅ ALL TESTS PASSED - Ready for Production
- ⚠️ SOME TESTS FAILED - Needs review
- ❌ CRITICAL FAILURES - Needs fixes

**Overall Status: _______**

---

## Issues Found (if any)

```
Issue 1: ___________________________________________
         ___________________________________________
         
Issue 2: ___________________________________________
         ___________________________________________

Issue 3: ___________________________________________
         ___________________________________________
```

---

## Notes & Observations

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Tester Information

**Name:** ___________________________
**Date:** ___________________________
**Browser:** ___________________________
**OS:** ___________________________
**Device:** ___________________________

---

## Sign-Off

By signing below, I confirm that I have tested the dropdown menu implementation and verified that it meets the requirements.

**Tester Signature:** ___________________________
**Date:** ___________________________

**Manager Approval:** ___________________________
**Date:** ___________________________

---

## Next Steps

If **ALL TESTS PASSED**:
- ✅ Feature is ready for production deployment
- ✅ Can be merged to main branch
- ✅ Can be released to end users

If **SOME TESTS FAILED**:
- ⚠️ Review failed tests with development team
- ⚠️ Create bug tickets for failures
- ⚠️ Retest after fixes are applied

If **CRITICAL FAILURES**:
- ❌ Do NOT deploy to production
- ❌ Escalate to development lead
- ❌ Create incident ticket
- ❌ Schedule emergency fix review

---

**End of Manual Testing Guide**
