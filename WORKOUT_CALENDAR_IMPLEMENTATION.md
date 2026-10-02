# Workout Session Calendar Implementation Guide

## Overview

The Workout Session Calendar component provides a complete solution for managing fitness instructor time slots and student workout bookings. The system includes role-based controls for students, trainers, and superusers with timezone handling and automatic status management.

## Features

### 1. **Student Booking Flow** (`isStudent = true`)
- View trainer calendars with available time slots
- Select personal trainer from dropdown
- Click on empty time slots to book workouts
- Real-time confirmation and error handling
- Timezone support: Times displayed in local timezone, stored as UTC in database

### 2. **Trainer Controls** (`isTrainer = true`)
- Set working days and time windows for each day
- Define session format preference (In-Person, Video, Student's Choice)
- Create vacation blockouts to hide unbooked slots automatically
- Manually update session status: Scheduled → Completed, Failed, or Absent
- Click on calendar events to view and update session status
- All availability rules are trainer-specific

### 3. **Superuser Settings** (`isSuperuser = true`)
- Define global slot duration (default: 60 minutes)
- Set break times between sessions (default: 15 minutes)
- Configure cancellation/modification cutoff limit (default: 24 hours)
- Settings applied system-wide to all trainers

### 4. **Automatic Status Management**
- Background job runs every 5 minutes (configured in `server.js`)
- Automatically sets session status to "COMPLETED" 5 minutes after `end_time` passes
- Tracks auto-completion with `auto_completed_at` timestamp
- Prevents duplicate auto-completion with idempotent logic

### 5. **Timezone Handling**
- **Frontend Display**: All times shown in user's local timezone
- **Database Storage**: All times stored as `TIMESTAMPTZ` (UTC) in PostgreSQL
- Automatic conversion handled by FullCalendar and browser JavaScript Date objects

## Database Schema

### New Tables

#### `calendar_settings`
```sql
CREATE TABLE calendar_settings (
    id SERIAL PRIMARY KEY,
    slot_duration_minutes INT DEFAULT 60,
    break_duration_minutes INT DEFAULT 15,
    cancellation_cutoff_hours INT DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

#### `workout_sessions`
- **New Column**: `auto_completed_at TIMESTAMPTZ` - Tracks when session was automatically completed

#### `trainer_availability` (Existing)
- `trainer_id` - FK to users
- `day_of_week` - 0-6 (Sunday-Saturday)
- `start_time` - TIME field (e.g., '09:00:00')
- `end_time` - TIME field (e.g., '17:00:00')
- `location_format` - IN_PERSON, VIDEO, or STUDENT_CHOICE

#### `trainer_vacations` (Existing)
- `trainer_id` - FK to users
- `start_date` - DATE field
- `end_date` - DATE field

## API Endpoints

### Calendar Settings (Superuser)

#### GET `/api/calendars/settings`
Fetch current calendar settings
```json
{
  "settings": {
    "slot_duration_minutes": 60,
    "break_duration_minutes": 15,
    "cancellation_cutoff_hours": 24
  }
}
```

#### PUT `/api/calendars/settings` (Superuser only)
Update calendar settings
```json
{
  "slotDurationMinutes": 60,
  "breakDurationMinutes": 15,
  "cancellationCutoffHours": 24
}
```

### Trainer Availability

#### GET `/api/calendars/trainer-availability`
Fetch trainer's availability rules
```json
{
  "availability": [
    {
      "id": 1,
      "day_of_week": 1,
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "location_format": "IN_PERSON"
    }
  ]
}
```

#### POST `/api/calendars/trainer-availability`
Create or update availability rule
```json
{
  "dayOfWeek": 1,
  "startTime": "09:00:00",
  "endTime": "17:00:00",
  "locationFormat": "IN_PERSON"
}
```

### Trainer Vacations

#### GET `/api/calendars/trainer-vacations`
Fetch trainer's vacation blockouts
```json
{
  "vacations": [
    {
      "id": 1,
      "start_date": "2026-12-20",
      "end_date": "2026-12-31"
    }
  ]
}
```

#### POST `/api/calendars/trainer-vacations`
Add vacation blockout
```json
{
  "startDate": "2026-12-20",
  "endDate": "2026-12-31"
}
```

#### DELETE `/api/calendars/trainer-vacations/:vacationId`
Remove vacation blockout

### Workout Sessions

#### GET `/api/calendars/workouts`
Fetch all workout sessions
```json
{
  "sessions": [
    {
      "id": 1,
      "trainer_id": "uuid",
      "student_id": "uuid",
      "start_time": "2026-10-02T10:00:00Z",
      "end_time": "2026-10-02T11:00:00Z",
      "status": "SCHEDULED",
      "auto_completed_at": null
    }
  ]
}
```

#### POST `/api/calendars/workouts/book`
Book a workout session
```json
{
  "trainerId": "uuid",
  "startTime": "2026-10-02T10:00:00Z",
  "endTime": "2026-10-02T11:00:00Z"
}
```

#### PUT `/api/calendars/workouts/:sessionId/status`
Update session status (Trainer only)
```json
{
  "status": "COMPLETED" | "FAILED" | "ABSENT"
}
```

## Component Usage

### Student View
```jsx
<WorkoutCalendar 
  isStudent={true}
  isTrainer={false}
  isSuperuser={false}
/>
```

### Trainer View
```jsx
<WorkoutCalendar 
  trainerId={currentUserId}
  isStudent={false}
  isTrainer={true}
  isSuperuser={false}
/>
```

### Superuser View
```jsx
<WorkoutCalendar 
  isStudent={false}
  isTrainer={false}
  isSuperuser={true}
/>
```

### Combined View (Embedded in Dashboards)
```jsx
<WorkoutCalendar 
  trainerId={userRole === 'trainer' ? userId : undefined}
  isStudent={userRole === 'student'}
  isTrainer={userRole === 'trainer'}
  isSuperuser={userRole === 'superuser'}
/>
```

## Session Status Lifecycle

```
SCHEDULED (initial status when booked)
    ↓
[5 minutes after end_time]
    ↓
COMPLETED (automatic or manual)

Alternative paths:
- FAILED (trainer marks session missed)
- ABSENT (student no-show)
```

## Key Features

### Atomicity & Race Condition Prevention
- Uses `SELECT FOR UPDATE` for slot holds
- Atomic 5-minute hold prevents double-booking
- Conflict detection for overlapping sessions

### Vacation Blockout Behavior
- Trainer sets vacation dates
- System automatically hides unbooked slots for that date range
- Existing bookings are checked but can be protected by business logic

### Timezone Support
- **Display**: Automatically converted to user's local timezone by browser
- **Storage**: All times stored as `TIMESTAMPTZ (UTC)` in PostgreSQL
- **API**: Timestamps in ISO 8601 format with timezone info

### Error Handling
- Comprehensive error messages for booking conflicts
- Slot hold expiration handling
- Validation of date/time inputs
- Role-based access control

## Background Jobs

### Auto-Complete Job
- **Frequency**: Every 5 minutes
- **Location**: `server.js` in `startMaintenanceJobs()`
- **Logic**: 
  ```javascript
  UPDATE workout_sessions
  SET status = 'COMPLETED', auto_completed_at = NOW()
  WHERE status = 'SCHEDULED'
    AND end_time <= NOW() - INTERVAL '5 minutes'
    AND auto_completed_at IS NULL
  ```
- **Idempotent**: Uses `auto_completed_at IS NULL` check to prevent re-running

## Testing the Implementation

### 1. Database Setup
```bash
cd backend
npm run seed  # Initializes schema and defaults
```

### 2. Start Backend Server
```bash
npm run dev
```

### 3. Start Frontend Dev Server
```bash
npm run dev
```

### 4. Test Student Booking
- Login as student
- Select a trainer from dropdown
- Click on empty time slot
- Verify booking confirmation
- Check database: `SELECT * FROM workout_sessions WHERE student_id = '<your-id>'`

### 5. Test Trainer Availability Setup
- Login as trainer
- Click "Setup Availability" button
- Set working hours for each day
- Add vacation blockout
- Verify data in: `SELECT * FROM trainer_availability WHERE trainer_id = '<trainer-id>'`

### 6. Test Status Updates
- Login as trainer
- Click on a scheduled session
- Select new status (COMPLETED, FAILED, ABSENT)
- Verify update in database

### 7. Test Superuser Settings
- Login as superuser
- Click "Settings" button
- Modify slot duration, break time, cancellation cutoff
- Verify data in: `SELECT * FROM calendar_settings`

### 8. Test Auto-Complete
- Create a session ending 5+ minutes ago
- Wait for next job run (5 min)
- Verify status changed to COMPLETED with timestamp

## Troubleshooting

### Sessions Not Appearing
1. Check network tab for 401/403 errors
2. Verify JWT token is valid
3. Check database: `SELECT * FROM workout_sessions LIMIT 5`

### Trainer Availability Not Saving
1. Ensure user has trainer role
2. Check console for API errors
3. Verify database has `trainer_availability` table

### Auto-Complete Not Working
1. Check server logs for job execution
2. Verify system clock is accurate
3. Check `end_time` is in past for test sessions

### Timezone Issues
1. Verify browser timezone setting
2. Check database timestamps are TIMESTAMPTZ
3. Ensure frontend sends ISO 8601 formatted times

## Performance Considerations

- **Indexes**: Created on `users(email)`, `users(phone)`, `users(role_id, status)`, `consultation_appointments(reserved_until)`, `workout_sessions(reserved_until)`
- **Query Optimization**: Vacation check uses `daterange` operator for efficient date matching
- **Background Job**: Lightweight query runs every 5 minutes with minimal lock contention
- **Calendar Rendering**: FullCalendar automatically handles large event sets

## Security

- **Authentication**: All endpoints require JWT token (except GET settings)
- **Authorization**: 
  - Trainers can only update their own sessions
  - Superusers only can modify calendar settings
  - Students can only book under their own account
- **Input Validation**: All date/time inputs validated
- **SQL Injection Prevention**: Parameterized queries throughout

## Future Enhancements

1. **Recurring Availability**: Support weekly patterns
2. **Student Cancellation**: With cutoff enforcement
3. **Email Notifications**: Booking confirmations and reminders
4. **Payment Integration**: Linked to membership plans
5. **Analytics Dashboard**: Session completion rates, trainer utilization
6. **Calendar Sharing**: Between trainers and coordinators
7. **Resource Booking**: Room/equipment allocation alongside sessions
8. **Rescheduling**: Move sessions without rebooking

---

**Last Updated**: 2026-10-01  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
