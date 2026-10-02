# 🏋️ Workout Calendar - Getting Started Guide

**Status**: ✅ Complete and Ready to Use  
**Last Updated**: October 1, 2026

---

## What's Included?

A complete instructor time slot management system with:
- 📅 Calendar interface with FullCalendar
- 👨‍🏫 Trainer setup panel for availability
- ✋ Student booking system
- ⚙️ Superuser configuration panel
- 🤖 Automatic session status updates
- 🌍 Timezone support (local display, UTC storage)

---

## 🚀 Quick Start (5 Minutes)

### 1. Apply Database Changes
```bash
cd backend
# The schema migrations are idempotent - run this if upgrading:
psql -U your_user -d cas_fitness -f db/schema.sql
```

### 2. Start Backend
```bash
npm run dev
# Look for: "Workout auto-complete job started"
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```

### 4. Test in Browser
- Go to: `http://localhost:5173`
- Login as student/trainer/admin
- Test the calendar features

---

## 👤 User Roles & What They Can Do

### 👨 Student
```jsx
<WorkoutCalendar isStudent={true} />
```
- Select trainer from dropdown
- Click available time slots to book
- See booked sessions in calendar
- Confirm bookings

### 👨‍🏫 Trainer  
```jsx
<WorkoutCalendar trainerId={userId} isTrainer={true} />
```
- Click "Setup Availability"
- Set working hours (Mon-Sun)
- Add vacation blockouts
- Click sessions to update status (Completed/Failed/Absent)

### 🛠️ Superuser
```jsx
<WorkoutCalendar isSuperuser={true} />
```
- Click "Settings"
- Configure slot duration
- Configure break times
- Configure cancellation cutoff
- Changes apply system-wide

---

## 📁 File Structure

```
backend/
├── db/
│   └── schema.sql           ← New calendar_settings table
├── routes/
│   └── calendars.js         ← 10 API endpoints
├── server.js                ← Auto-complete job (every 5 min)
└── middleware/
    └── authMiddleware.js    ← Authentication checks

frontend/
├── src/
│   ├── components/
│   │   └── WorkoutCalendar.jsx    ← Main calendar component
│   └── styles/
│       └── WorkoutCalendar.module.css
└── package.json

Documentation/
├── WORKOUT_CALENDAR_IMPLEMENTATION.md      ← Full guide
├── WORKOUT_CALENDAR_IMPLEMENTATION_SUMMARY.md
├── WORKOUT_CALENDAR_QUICK_REFERENCE.md     ← Developer guide
└── WORKOUT_CALENDAR_COMPLETION_REPORT.md   ← What was done
```

---

## 📊 Key Endpoints

All endpoints need JWT token: `Authorization: Bearer <token>`

| Method | Endpoint | Who | Purpose |
|--------|----------|-----|---------|
| GET | `/api/calendars/workouts` | All | List sessions |
| POST | `/api/calendars/workouts/book` | Student | Book session |
| PUT | `/api/calendars/workouts/:id/status` | Trainer | Update status |
| GET | `/api/calendars/settings` | All | Get config |
| PUT | `/api/calendars/settings` | Superuser | Update config |
| POST | `/api/calendars/trainer-availability` | Trainer | Set hours |
| GET | `/api/calendars/trainer-availability` | Trainer | Get rules |
| POST | `/api/calendars/trainer-vacations` | Trainer | Add vacation |
| GET | `/api/calendars/trainer-vacations` | Trainer | List vacations |
| DELETE | `/api/calendars/trainer-vacations/:id` | Trainer | Remove vacation |

---

## 🗄️ Database Tables

### calendar_settings
Stores global configuration:
```sql
slot_duration_minutes      INT  (default: 60)
break_duration_minutes     INT  (default: 15)
cancellation_cutoff_hours  INT  (default: 24)
```

### trainer_availability
Trainer working hours:
```sql
trainer_id    UUID
day_of_week   INT (0=Sun, 6=Sat)
start_time    TIME
end_time      TIME
location_format VARCHAR (IN_PERSON, VIDEO, STUDENT_CHOICE)
```

### trainer_vacations
Vacation blockouts:
```sql
trainer_id   UUID
start_date   DATE
end_date     DATE
```

### workout_sessions (enhanced)
New column added:
```sql
auto_completed_at TIMESTAMPTZ  (when auto-complete job ran)
```

---

## 🔄 Session Status Flow

```
SCHEDULED (initial when booked)
    ↓
[5 min after end_time]
    ↓
COMPLETED (auto)
    
Alternative (manual trainer update):
├─ FAILED (trainer marked missed)
└─ ABSENT (student no-show)
```

Background job runs every 5 minutes and sets status to COMPLETED for sessions ending 5+ minutes ago.

---

## ✅ Testing Checklist

### Test 1: Student Books Session (5 min)
1. Login as student
2. Select trainer
3. Click blue time slot
4. See "Session scheduled successfully!"
5. Refresh → session persists
6. Check DB: `SELECT * FROM workout_sessions WHERE student_id = '...'`

### Test 2: Trainer Setup (5 min)
1. Login as trainer
2. Click "Setup Availability"
3. Set Mon-Fri 9AM-5PM
4. Add vacation Dec 20-31
5. Click "Add"
6. Refresh → settings persist
7. Check DB: `SELECT * FROM trainer_availability WHERE trainer_id = '...'`

### Test 3: Update Session Status (2 min)
1. Click on scheduled session
2. Select "COMPLETED"
3. See color change to green
4. Refresh → status persists
5. Check DB: `SELECT status FROM workout_sessions WHERE id = 1`

### Test 4: Auto-Complete Job (5+ min)
1. Create session ending 5+ minutes ago
2. Check status: should be SCHEDULED
3. Wait 5 minutes (job interval)
4. Refresh
5. Status should be COMPLETED
6. Check `auto_completed_at` timestamp in DB

### Test 5: Superuser Settings (3 min)
1. Login as superuser
2. Click "Settings"
3. Change slot duration to 90 min
4. Click "Save Settings"
5. See "Calendar settings updated!"
6. Check DB: `SELECT * FROM calendar_settings`

---

## 🐛 Troubleshooting

### Sessions Not Loading?
- Check browser console for errors
- Verify JWT token is valid
- Check that `/api/calendars/workouts` endpoint works

### Availability Not Saving?
- Ensure user has trainer role
- Check server logs for errors
- Verify `trainer_availability` table exists

### Auto-Complete Not Working?
- Check server logs for job execution
- Verify database timestamps are TIMESTAMPTZ
- Check that sessions have `end_time` in past

### Timezone Wrong?
- Verify browser timezone setting
- Check database: `SELECT NOW();` should show UTC
- Frontend should convert to local automatically

---

## 📚 Documentation Files

Read these in order:

1. **WORKOUT_CALENDAR_START.md** (this file)
   - Quick start and testing

2. **WORKOUT_CALENDAR_QUICK_REFERENCE.md**
   - Integration examples
   - API reference
   - Common mistakes to avoid

3. **WORKOUT_CALENDAR_IMPLEMENTATION.md**
   - Complete technical guide
   - Database schema details
   - All endpoints documented

4. **WORKOUT_CALENDAR_IMPLEMENTATION_SUMMARY.md**
   - What was implemented
   - Performance metrics
   - Maintenance guide

---

## 🎯 Next Steps

1. **For Integration**
   - Review quick reference: `WORKOUT_CALENDAR_QUICK_REFERENCE.md`
   - Add component to your dashboards
   - Test all user roles

2. **For Operations**
   - Set up database backups
   - Monitor background job logs
   - Track error rates

3. **For Enhancement**
   - Review `WORKOUT_CALENDAR_IMPLEMENTATION_SUMMARY.md` "Future Work" section
   - Plan recurring availability feature
   - Plan email notifications

---

## 💡 Pro Tips

### Boost Performance
```javascript
// Limit to current week
const now = new Date();
const weekStart = new Date(now.getDate() - now.getDay());
const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
// Only load sessions between weekStart and weekEnd
```

### Debug Auto-Complete
```sql
-- See all auto-completed sessions in last hour
SELECT id, student_id, trainer_id, end_time, auto_completed_at
FROM workout_sessions
WHERE auto_completed_at > NOW() - INTERVAL '1 hour'
ORDER BY auto_completed_at DESC;
```

### Monitor Component Health
```javascript
// In WorkoutCalendar.jsx
useEffect(() => {
  console.log("Component initialized", { isStudent, isTrainer, isSuperuser });
  console.log("Sessions loaded:", sessions.length);
  console.log("Availability rules:", availabilityRules.length);
}, [sessions, availabilityRules]);
```

---

## 📞 Getting Help

**Issue**: Need to understand the code?
- Read: Technical Implementation Guide

**Issue**: Need to integrate into my dashboard?
- Read: Quick Reference Guide, Integration Examples section

**Issue**: Need API endpoint details?
- Read: Full Implementation Guide, API Endpoints section

**Issue**: Something isn't working?
- Check: Troubleshooting section above
- Review: Server logs and browser console
- Query: Database to verify data

---

## ✨ Summary

You now have a production-ready workout calendar system with:

✅ Complete role-based access control  
✅ Automatic session management  
✅ Timezone support  
✅ Professional UI  
✅ Comprehensive error handling  
✅ Full documentation  

**Ready to deploy. Enjoy!** 🚀

---

**Questions?** Check the documentation files.  
**Found a bug?** Review the troubleshooting section.  
**Ready to extend?** See "Future Work" in the summary document.
