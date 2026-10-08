# Trainer Session Management - Quick Start Guide

## 🎯 What Can You Do?

Manage personal trainer sessions for students (members) with:
- ✅ Add/Delete trainer sessions for any member
- ✅ Set start time and expiration dates
- ✅ Track individual session completion
- ✅ Create reusable session packages
- ✅ Mark sessions as completed, scheduled, cancelled, or no-show

---

## 📍 Where to Access It

1. **Admin Dashboard** → **Members** → Select a member
2. Look for the **"Manage Trainer Sessions"** button (blue) near the bottom
3. Click to expand the trainer session management interface

---

## 🚀 Quick Start: Assign Sessions to a Member

### Step 1: Open Trainer Session Manager
- Go to member profile
- Click "+ Manage Trainer Sessions"

### Step 2: Add Sessions
1. Click **"+ Add New Session Package"**
2. Select a **Trainer** from dropdown
3. Enter **Number of Sessions** (e.g., 4, 8, 12)
4. Choose **Start Date** 
   - Expiration date auto-calculates (1 session per week)
   - Edit expiration date if needed
5. (Optional) Select a **Package Template** or leave blank for custom
6. (Optional) Add **Notes** (e.g., "Goal: Improve strength")
7. Click **"Save Session"**

✅ Session is now assigned and tracking begins!

---

## 📊 View Session Details

### See Individual Session Logs
1. In the "Sessions" tab, find the session
2. Click **"View Details"** button
3. See all individual session logs in a table
4. Each log shows:
   - Session number (1, 2, 3, 4...)
   - Scheduled date
   - Completed date
   - Current status (PENDING, SCHEDULED, COMPLETED, etc.)
   - Location format (IN_PERSON or VIDEO)
   - Notes

### Update Session Status
- Click the status dropdown in each log row
- Select new status:
  - **PENDING** - Not yet scheduled
  - **SCHEDULED** - Member appointment confirmed
  - **COMPLETED** - Session happened, training complete
  - **CANCELLED** - Session was cancelled
  - **RESCHEDULED** - Session moved to different date
  - **NO_SHOW** - Member didn't show up

---

## ✏️ Edit Existing Sessions

1. In "Sessions" tab, find the session
2. Click **"Edit"** button
3. Modify:
   - Trainer assignment
   - Start/Expiration dates
   - Status (ACTIVE, EXPIRED, COMPLETED, CANCELLED)
   - Notes
4. Click **"Save Session"**

---

## 🗑️ Delete Sessions

⚠️ **Warning:** This cannot be undone!

1. In "Sessions" tab, find the session
2. Click **"Delete"** button
3. Confirm deletion
4. ✅ All related session logs are automatically deleted

---

## 📦 Session Packages Tab

View available reusable session packages (created by superusers):
- Package name and description
- Number of sessions included
- Session duration
- Package price

Use these as templates when assigning sessions!

---

## 📌 Status Explanations

| Status | Color | Meaning |
|--------|-------|---------|
| **ACTIVE** | 🟢 Green | Sessions are valid, member can use them |
| **EXPIRED** | 🔴 Red | Expiration date has passed, no longer valid |
| **COMPLETED** | 🔵 Blue | All sessions were used and completed |
| **CANCELLED** | ⚫ Gray | Sessions were cancelled by admin |

---

## 💡 Pro Tips

1. **Auto-Calculate Expiration**
   - Set start date
   - Enter number of sessions
   - Expiration date automatically calculated (assumes 1 session/week)
   - Manually adjust if needed

2. **Session Planning**
   - Use session packages for consistency
   - Add notes for trainer context
   - Update statuses regularly to track progress

3. **Bulk Operations**
   - Create packages once, assign multiple times
   - Update all logs at once with bulk status changes

4. **Track Remaining Sessions**
   - "Remaining Sessions" counter decrements when sessions marked COMPLETED
   - See at a glance how many sessions left

---

## 🔍 Troubleshooting

### No trainers showing in dropdown?
- Ensure trainers exist in the system (admin must create them first)
- Trainers must have TRAINER role assigned

### Can't see "Manage Trainer Sessions" button?
- Ensure you have SUPERUSER or STAFF role
- Check role permissions in admin settings

### Session won't save?
- All required fields filled? (Trainer, dates, session count)
- Expiration date after start date?
- Check browser console for error messages

### Need more sessions for a member?
- Simply create another session assignment!
- Members can have multiple active session packages

---

## 🎓 Example Scenario

**Setting up Alex (member) with personal training:**

1. Click "+ Add New Session Package"
2. Select Trainer: "Mike Johnson"
3. Sessions: 8
4. Start Date: October 1, 2024
5. Expiration: December 31, 2024 (auto-calc shows Nov 26, manual adjust)
6. Notes: "Goal: Marathon prep - 3x week running, 1x cross-training"
7. Save ✅

**Tracking progress:**

Each Monday:
1. View Details on Alex's session
2. Update session 1 status: PENDING → SCHEDULED (after booking confirmed)
3. After session happens: SCHEDULED → COMPLETED
4. Add notes: "Great 5-mile run, pace improving"
5. Repeat for sessions 2, 3, 4, etc.

By December 31, Alex has 8 completed sessions logged! 🎉

---

## 📞 Need More Help?

Refer to the full documentation: `TRAINER_SESSION_MANAGEMENT.md`

Or check these sections:
- API Usage Examples
- Role-Based Access Control
- Database Schema Details
