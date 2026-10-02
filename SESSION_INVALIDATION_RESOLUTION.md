# Session Invalidation Fix - After Database Credentials Change

## 🔴 What Happened

You changed the `DATABASE_URL` in `.env` file, which is valid. However, the backend security system detected that your JWT token's `session_version` no longer matches the database's `session_version`. This is a **security feature** to prevent unauthorized access.

**Error Message:** `Session invalidated across devices`

---

## ✅ Quick Fix

### Step 1: Clear Your Browser Data
1. Open your browser
2. Press **F12** to open DevTools
3. Go to **Application** → **Local Storage**
4. Find and delete:
   - `cas_jwt`
   - `cas_user`

**OR** simply clear all local storage for your site.

### Step 2: Log Out and Log Back In
1. Refresh the page: **F5** or **Ctrl+R**
2. You'll be logged out (that's expected)
3. Login again with your superuser credentials:
   - Email: `castech7777@gmail.com`
   - Password: `User@123`

### Step 3: Verify It Works
1. ✅ You should now be logged in without the error
2. Navigate to Plans page
3. Try creating/editing a plan

---

## Why This Happened

The security system works like this:

```
JWT Token (stored in browser):
  - Contains: userId, roleId, sessionVersion: 1
  
Database (on server):
  - Stores: user record with session_version: 1

Authentication Check:
  if (tokenSessionVersion === databaseSessionVersion) {
    ✓ Access granted
  } else {
    ✗ Session invalidated error
  }
```

When database credentials change, sometimes the session tracking gets out of sync, requiring a fresh login to resync.

---

## Complete Steps to Fix

### If Above Quick Fix Doesn't Work:

**Step 1: Restart Both Servers**
```bash
# Terminal 1: Stop and restart backend
cd backend
npm run dev

# Terminal 2: Stop and restart frontend
cd frontend
npm run dev
```

**Step 2: Clear Browser Cache**
1. Hard refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
2. Open DevTools (F12)
3. Go to Application → Local Storage
4. Delete `cas_jwt` and `cas_user`
5. Close DevTools

**Step 3: Log In Again**
1. Log out completely
2. Close browser or go to home page
3. Log in again with:
   - Email: `castech7777@gmail.com`
   - Password: `User@123`

**Step 4: Verify**
- Navigate to Plans page
- Check no errors in browser console (F12 → Console)
- Try creating/editing a plan

---

## Troubleshooting

### Still Getting "Session invalidated" Error?

**Check 1: Is backend running?**
```bash
curl http://localhost:5000/api/plans
```
Should return JSON with plans list (may have error about "Failed to load plans" but that's OK - means backend is responding)

**Check 2: Are you logged in?**
- Open DevTools → Application → Local Storage
- Look for `cas_jwt` key
- If it exists and you still get the error, delete it and log in again

**Check 3: Database connectivity**
- Check backend logs for database errors
- Verify DATABASE_URL in `.env` is correct
- Test database connection manually (optional)

### After New Login, Still Getting Error?

This means the database record is corrupted. Reset it:

```bash
cd backend
npm run seed
```

Then log in again.

---

## What's Normal

✅ **Normal:** Getting logged out when database credentials change  
✅ **Normal:** Need to log in again after DB migration  
✅ **Normal:** Session version mismatch after fresh database  

---

## Session Version Explained

| Event | What Happens |
|-------|--------------|
| User logs in | JWT gets current session_version from DB |
| User logs in from another device | Session_version incremented in DB |
| Old device makes API call | Token has old session_version |
| Middleware checks DB | Sees new session_version |
| Error returned | "Session invalidated across devices" |
| User logs out | Need to get new JWT with new session_version |

---

## Summary

1. ✅ Clear local storage (`cas_jwt`, `cas_user`)
2. ✅ Log out completely
3. ✅ Log in again with superuser credentials
4. ✅ Fresh JWT will have correct session_version
5. ✅ Everything works

This is working as designed - it's a security feature to prevent hijacked sessions.

---

**Status:** This is expected behavior  
**Resolution Time:** 2-3 minutes  
**Risk:** None - just need fresh login
