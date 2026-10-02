# Workout Calendar - Quick Integration Guide

## Quick Start (5 Minutes)

### 1. Database Migration
```bash
cd backend
# Run your database migration tool or manually execute:
psql -U your_user -d your_db -f db/schema.sql
```

### 2. Restart Backend Server
```bash
npm run dev
# Watch for: "Workout auto-complete job started (runs every 5 minutes)."
```

### 3. Import Component
```jsx
// In your Student Dashboard
import WorkoutCalendar from "../components/WorkoutCalendar";

export default function StudentDashboard() {
  return (
    <WorkoutCalendar 
      isStudent={true}
      isTrainer={false}
      isSuperuser={false}
    />
  );
}
```

### 4. Test in Browser
- Go to student profile
- Select trainer → click time slot → verify booking
- Check database: `SELECT * FROM workout_sessions WHERE status='SCHEDULED';`

---

## Integration Examples

### Student Profile Dashboard
```jsx
import WorkoutCalendar from "../components/WorkoutCalendar";

export default function StudentProfile({ user }) {
  return (
    <div>
      <h1>My Bookings</h1>
      <WorkoutCalendar 
        isStudent={true}
        isTrainer={false}
        isSuperuser={false}
      />
    </div>
  );
}
```

### Employee (Trainer) Dashboard
```jsx
import WorkoutCalendar from "../components/WorkoutCalendar";

export default function TrainerDashboard({ user }) {
  return (
    <div>
      <h1>My Schedule</h1>
      <WorkoutCalendar 
        trainerId={user.id}
        isStudent={false}
        isTrainer={true}
        isSuperuser={false}
      />
    </div>
  );
}
```

### Superuser Admin Panel
```jsx
import WorkoutCalendar from "../components/WorkoutCalendar";

export default function AdminCalendarSettings() {
  return (
    <div>
      <h1>Calendar Configuration</h1>
      <WorkoutCalendar 
        isStudent={false}
        isTrainer={false}
        isSuperuser={true}
      />
    </div>
  );
}
```

### Master Calendar View (All Trainers)
```jsx
import MasterWorkoutCalendar from "../components/MasterWorkoutCalendar";
import { useUsers } from "../hooks/useUsers";

export default function AdminMasterCalendar() {
  const { trainers } = useUsers();
  
  return (
    <div>
      <h1>All Trainers' Schedule</h1>
      <MasterWorkoutCalendar trainers={trainers} />
    </div>
  );
}
```

---

## Component Props Reference

```typescript
interface WorkoutCalendarProps {
  // Optional trainer ID for filtering
  trainerId?: string;
  
  // Role flags for UI visibility
  isStudent?: boolean;      // Shows booking interface
  isTrainer?: boolean;      // Shows availability setup & status updates
  isSuperuser?: boolean;    // Shows global settings panel
  
  // User role (for automatic prop setting)
  userRole?: 'student' | 'trainer' | 'admin' | 'superuser';
}
```

---

## Environment Setup

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:5000/api
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/cas_fitness
PORT=5000
JWT_SECRET=your_secret_key
```

---

## Database Verification Queries

### Verify Schema Setup
```sql
-- Check if new tables exist
\dt calendar_settings trainer_availability trainer_vacations workout_sessions

-- Check auto_completed_at column
\d workout_sessions

-- View calendar settings
SELECT * FROM calendar_settings;

-- View trainer availability
SELECT 
  trainer_id, 
  day_of_week, 
  start_time::text, 
  end_time::text, 
  location_format 
FROM trainer_availability 
ORDER BY trainer_id, day_of_week;
```

### Monitor Auto-Complete Job
```sql
-- Count auto-completed sessions
SELECT COUNT(*) as completed_count 
FROM workout_sessions 
WHERE auto_completed_at IS NOT NULL;

-- View recent auto-completions
SELECT 
  id, 
  student_id, 
  trainer_id, 
  end_time, 
  auto_completed_at 
FROM workout_sessions 
WHERE auto_completed_at > NOW() - INTERVAL '1 hour'
ORDER BY auto_completed_at DESC;
```

---

## Component State Management

The WorkoutCalendar component manages:

```javascript
// Session Data
sessions: WorkoutSession[]

// UI State
statusMessage: string          // Success messages
errorMessage: string           // Error alerts
selectedSession: Session|null  // For status modal
showStatusModal: boolean       // Modal visibility

// Trainer Setup
availabilityRules: Rule[]      // Working hours
vacations: Vacation[]          // Blocked dates
showAvailabilitySetup: boolean // Panel visibility

// Superuser Settings
calendarSettings: Settings     // Global config
showSettings: boolean          // Panel visibility
```

---

## API Token Handling

```javascript
// Component automatically reads JWT from localStorage
const token = localStorage.getItem("cas_jwt");

// Add token to all requests
headers: {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
}
```

**Note**: Ensure your login flow stores token as `cas_jwt`

---

## Styling Customization

The component uses CSS modules at:
```
frontend/src/styles/WorkoutCalendar.module.css
```

To customize colors/spacing, modify:
```css
.card { /* Main container */ }
.title { /* Header text */ }
.header { /* Toolbar area */ }
.trainerSelect { /* Dropdown styling */ }
.statusMessage { /* Alert styling */ }
```

FullCalendar overrides available via `:global()` pseudo-selector.

---

## Testing Workflow

### Test 1: Student Booking
```
1. Login as student
2. Click "Select Trainer" dropdown
3. Choose any trainer
4. Click blue empty slot
5. Verify "Session scheduled successfully!" message
6. Refresh page - booking should persist
```

### Test 2: Trainer Setup
```
1. Login as trainer
2. Click "Setup Availability"
3. Set Mon-Fri 9-5 In-Person
4. Add vacation Dec 20-31
5. Click "Add" button
6. Refresh page - settings should persist
```

### Test 3: Status Update
```
1. Login as trainer
2. Find your scheduled session on calendar
3. Click on session event
4. Select "COMPLETED" status
5. Verify session color changed to green
6. Refresh page - status should persist
```

### Test 4: Auto-Complete
```
1. Create test session ending 5+ mins ago
2. Check status is "SCHEDULED"
3. Wait 5 minutes (job interval)
4. Refresh page
5. Status should be "COMPLETED" with timestamp
```

### Test 5: Superuser Settings
```
1. Login as superuser (role_id = 1)
2. Click "Settings" button
3. Change slot duration to 90 minutes
4. Click "Save Settings"
5. Verify "Calendar settings updated!" message
6. Check database: SELECT * FROM calendar_settings
```

---

## Common Integration Mistakes

❌ **Mistake 1**: Forgetting JWT token
```jsx
// WRONG - No token
fetch(`${apiBaseUrl}/calendars/workouts`)

// CORRECT - Includes token
const token = localStorage.getItem("cas_jwt");
fetch(`${apiBaseUrl}/calendars/workouts`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

❌ **Mistake 2**: Wrong role flags
```jsx
// WRONG - All flags true = confusing UI
<WorkoutCalendar isStudent={true} isTrainer={true} isSuperuser={true} />

// CORRECT - Only one role
<WorkoutCalendar isStudent={true} isTrainer={false} isSuperuser={false} />
```

❌ **Mistake 3**: Missing environment variable
```jsx
// WRONG - Hardcoded URL
const apiBaseUrl = "http://localhost:5000/api";

// CORRECT - From .env
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
```

---

## Performance Tips

1. **Limit Date Range**: Load only 30 days at a time
2. **Debounce Availability Updates**: Wait 500ms after user input
3. **Cache Settings**: Store `calendar_settings` in SessionStorage
4. **Lazy Load Events**: Use FullCalendar's event source callback
5. **Monitor Job Performance**: Log slow queries > 100ms

---

## Debugging

### Enable Verbose Logging
```javascript
// In WorkoutCalendar.jsx, add to useEffect:
console.log("Sessions loaded:", sessions);
console.log("Availability rules:", availabilityRules);
console.log("Calendar settings:", calendarSettings);
```

### Check Network Requests
1. Open DevTools → Network tab
2. Look for `/api/calendars/*` requests
3. Verify status 200, check response JSON
4. Look for 401 (auth) or 403 (permission) errors

### Database Query Logs
```sql
-- Check connection activity
SELECT datname, count(*) FROM pg_stat_activity 
GROUP BY datname;

-- View slow queries
SELECT query, calls, total_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

---

## Deployment Checklist

- [ ] Database migrations applied to production
- [ ] Environment variables configured
- [ ] JWT token storage verified in localStorage
- [ ] Backend server started with `npm run dev` or production process
- [ ] Frontend built with `npm run build`
- [ ] API CORS configured to allow frontend origin
- [ ] Background job confirmed running (check server logs)
- [ ] Test all user roles (student, trainer, admin)
- [ ] Monitor error logs for first 24 hours

---

## Support Resources

- **Full Documentation**: `WORKOUT_CALENDAR_IMPLEMENTATION.md`
- **Implementation Summary**: `WORKOUT_CALENDAR_IMPLEMENTATION_SUMMARY.md`
- **API Endpoints**: See section in full documentation
- **Database Schema**: `backend/db/schema.sql`
- **Component Code**: `frontend/src/components/WorkoutCalendar.jsx`

---

**Quick Links**:
- 📚 [Full Guide](./WORKOUT_CALENDAR_IMPLEMENTATION.md)
- 📋 [Summary](./WORKOUT_CALENDAR_IMPLEMENTATION_SUMMARY.md)
- 🔧 [Routes](./backend/routes/calendars.js)
- 💾 [Schema](./backend/db/schema.sql)
- 🎨 [Component](./frontend/src/components/WorkoutCalendar.jsx)
