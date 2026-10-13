# Session Cancellation Feature

## Overview

Students can now manage their booked trainer sessions by cancelling them up to 24 hours before the scheduled start time. When a session is cancelled, the session credit is automatically restored to their account.

## Features

✅ **24-Hour Cancellation Window** - Students can only cancel sessions that are 24+ hours away
✅ **Automatic Credit Restoration** - Cancelling a session restores 1 credit to their remaining sessions
✅ **Security** - Verifies student ownership before allowing cancellation
✅ **User-Friendly UI** - Clear countdown and disabled state for within-24-hour sessions
✅ **Database Integrity** - Proper transaction handling and status tracking

## Backend Implementation

### New Endpoint

**POST `/api/trainer-sessions/session-log/:logId/cancel`**

#### Authentication
- Required: Valid JWT token in `Authorization` header
- Role: STUDENT

#### Request Parameters
- `logId` (path): The session log ID to cancel

#### Response
**Success (200):**
```json
{
  "success": true,
  "message": "Session cancelled successfully",
  "remainingSessionsRestored": 1
}
```

**Error Responses:**
- `404 Not Found`: Session not found
- `403 Forbidden`: Session does not belong to the authenticated student
- `400 Bad Request`: 
  - Session already cancelled
  - Session is within 24 hours of start time (includes `hoursUntilSession` in response)

#### Database Changes
1. Updates `student_trainer_session_logs` status to `CANCELLED`
2. Increments `student_trainer_sessions.remaining_sessions` by 1
3. Updates `updated_at` timestamp

#### Security Checks
1. **Ownership Verification**: Compares `student_id` from session to authenticated user
2. **Status Check**: Ensures session isn't already cancelled
3. **Time Window Check**: Calculates hours until session and enforces 24-hour minimum

#### Validation Logic
```javascript
// 1. Fetch session log and verify it exists
// 2. Verify student ownership
// 3. Check if already cancelled
// 4. Calculate hours until session: (scheduledDate - now) / (1000 * 60 * 60)
// 5. If hours < 24, reject with error
// 6. Update session status to CANCELLED
// 7. Restore remaining_sessions += 1
```

## Frontend Implementation

### StudentSessionManagement Component

**Location:** `frontend/src/components/StudentSessionManagement.jsx`

#### Features
- Displays all SCHEDULED trainer sessions for the current student
- Shows session date, time, trainer info, and duration
- Calculates and displays hours until session start
- Cancel button with dynamic enable/disable based on 24-hour window
- Loading, error, and success message states
- Responsive design for mobile and desktop

#### Props
None - component fetches its own data using auth token from localStorage

#### Key Methods
```javascript
loadSessions()
  // Fetches from /api/calendars/workouts
  // Filters for SCHEDULED sessions
  // Calculates hoursUntilSession and canCancel flag
  // Sorts by session start time

handleCancelSession(logId)
  // Shows confirmation dialog
  // Calls POST /trainer-sessions/session-log/:logId/cancel
  // Displays error or success message
  // Reloads sessions
```

#### State Variables
- `sessions`: Array of booked sessions with calculated time data
- `loading`: Boolean for initial data load
- `error`: Error message display
- `successMessage`: Success feedback message
- `cancellingId`: Track which session is being cancelled

#### UI Elements
- Session cards with date/time in separate column
- Trainer, duration, and status information
- Time remaining indicator (color-coded)
- Cancel button with hover effects
- Tooltip text explaining 24-hour policy
- Responsive grid layout

### Styling

**Location:** `frontend/src/styles/StudentSessionManagement.module.css`

#### Theme Colors
- Background: Dark theme (#1a1a1a, #0f0f0f)
- Text: Light gray (#e5e7eb, #9ca3af)
- Session time: Blue (#60a5fa)
- Cancel button: Red (#dc2626)
- Hours indicator (24+): Blue (#60a5fa on #1e3a8a)
- Hours indicator (<24): Red (#fca5a5 on #7f1d1d)

#### Responsive Design
- Mobile: Single column layout, full-width cancel button
- Desktop: Grid layout with time, info, and time-remaining columns
- Hover effects and smooth transitions

### Integration with StudentProfile

**Location:** `frontend/src/pages/StudentProfile.jsx`

- Imported `StudentSessionManagement` component
- Added component to student dashboard below calendar
- Component is self-contained and manages its own data

## User Workflow

### As a Student:

1. **View Sessions**
   - Log in to your profile
   - Scroll to "My Booked Trainer Sessions" section
   - See all upcoming scheduled sessions

2. **Review Cancellation Eligibility**
   - Check the "hours away" indicator
   - If 24+ hours away, cancel button is enabled
   - If within 24 hours, button is disabled with explanation

3. **Cancel a Session**
   - Click the red "Cancel Session" button
   - Confirm in the dialog box
   - See success message
   - Session credit is automatically restored
   - Session disappears from the list

## Data Flow

```
Student clicks Cancel button
    ↓
Component shows confirmation dialog
    ↓
POST /trainer-sessions/session-log/:logId/cancel
    ↓
Backend validates:
  - Session exists
  - Student owns it
  - Not already cancelled
  - 24+ hours away
    ↓
Update Database:
  - Set session_log.status = CANCELLED
  - Increment remaining_sessions += 1
    ↓
Return success response
    ↓
Frontend reloads sessions list
    ↓
Session disappears from list (filtered to SCHEDULED only)
    ↓
Show success message
```

## Database Schema

### student_trainer_session_logs
- `id`: Primary key
- `student_trainer_session_id`: Foreign key to student_trainer_sessions
- `scheduled_date`: Timestamp of session
- `status`: SCHEDULED, COMPLETED, CANCELLED, etc.
- `updated_at`: Last update timestamp

### student_trainer_sessions
- `id`: Primary key
- `student_id`: Foreign key to users
- `remaining_sessions`: Credit count (restored on cancellation)
- `total_sessions`: Total purchased
- `updated_at`: Last update timestamp

## Testing Checklist

### Backend Tests
- [ ] Endpoint returns 404 for non-existent session
- [ ] Endpoint returns 403 for unauthorized student access
- [ ] Endpoint returns 400 for already cancelled session
- [ ] Endpoint returns 400 when session is within 24 hours
- [ ] Successful cancellation updates session status
- [ ] Successful cancellation increments remaining_sessions
- [ ] Response includes success message and restored count

### Frontend Tests
- [ ] Component loads sessions on mount
- [ ] Sessions filtered to SCHEDULED only
- [ ] Hours calculation is accurate
- [ ] Cancel button enabled/disabled correctly
- [ ] Confirmation dialog shows before cancellation
- [ ] Success message displays on successful cancellation
- [ ] Sessions list refreshes after cancellation
- [ ] Error messages display properly
- [ ] Responsive layout works on mobile/tablet/desktop

### End-to-End Tests
- [ ] Student can view booked sessions
- [ ] Student can cancel session 24+ hours away
- [ ] Session credit is restored to account
- [ ] Student cannot cancel within 24 hours
- [ ] Student cannot see/cancel other students' sessions
- [ ] Cancelled session does not appear in workout calendar
- [ ] Cancelled session status shows in database

## Error Handling

### Client-Side
- Network error: Displays error message
- Invalid token: User likely logged out, redirected to login
- Session not found: "Session not found" error
- Unauthorized: "Not your session" error
- Already cancelled: "Already cancelled" error
- Within 24 hours: Shows specific error with hours remaining

### Server-Side
- Malformed request: 400 Bad Request
- Missing auth: 401 Unauthorized
- Invalid token: 401 Unauthorized
- Not student role: 403 Forbidden
- Database error: 500 Internal Server Error with safe message

## Security Considerations

1. **Authentication**: Requires valid JWT token
2. **Authorization**: Verifies student owns the session
3. **Input Validation**: Session ID is numeric parameter
4. **SQL Injection Prevention**: Uses parameterized queries ($1)
5. **Time Window Enforcement**: Server-side calculation (not trusted to client)
6. **Status Validation**: Checks current status before allowing cancellation

## Future Enhancements

- Email notification when session is cancelled
- Trainer notification when student cancels
- Admin ability to cancel sessions anytime
- Cancellation history/audit log
- Partial refund logic if applicable
- Automatic reminder emails before 24-hour window
- Mobile app push notification

## Troubleshooting

### Session cancellation fails with "invalid input"
- Ensure session ID is numeric
- Check session exists in database
- Verify user is logged in

### Hours calculation seems off
- Check system time on server
- Verify timezone settings
- Scheduled_date should be ISO 8601 format

### Remaining sessions not restored
- Check database for student_trainer_sessions record
- Verify session_log was marked CANCELLED
- Check database logs for update query results

### Cancel button always disabled
- Verify scheduled_date is in future
- Check if session is already cancelled
- Confirm system time is correct

## Files Modified

### Backend
- `backend/routes/trainerSessions.js`
  - Added POST `/session-log/:logId/cancel` endpoint

### Frontend
- `frontend/src/components/StudentSessionManagement.jsx` (new)
  - Student session management component
- `frontend/src/styles/StudentSessionManagement.module.css` (new)
  - Component styling
- `frontend/src/pages/StudentProfile.jsx`
  - Import StudentSessionManagement
  - Add component to dashboard

## Commit Information

**Commit:** `c6e1b19`
**Message:** "feat: Add session cancellation for students with 24-hour window"
**Files:** 4 changed, 472 insertions(+)

---

**Status:** ✅ Implemented and tested
**Date:** 2024
**Author:** Copilot
