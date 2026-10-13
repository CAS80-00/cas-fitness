const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken } = require("../middleware/authMiddleware");

function getCalendarTable(type) {
  return type === "workout" ? "workout_sessions" : "consultation_appointments";
}

// 1. Atomic Database Slot Hold (SELECT FOR UPDATE)
router.post("/hold-slot", authenticateToken, async (req, res) => {
  const { slotId, type } = req.body; // type: 'consultation' or 'workout'
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const table = getCalendarTable(type);

    // Lock row using SELECT FOR UPDATE to prevent race conditions
    const checkQuery = `
      SELECT id, reserved_until, status 
      FROM ${table} 
      WHERE id = $1 FOR UPDATE
    `;
    const checkRes = await client.query(checkQuery, [slotId]);

    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: "Selected time slot does not exist." });
    }

    const slot = checkRes.rows[0];
    const now = new Date();

    if (
      slot.status !== "PENDING" &&
      slot.reserved_until &&
      new Date(slot.reserved_until) > now
    ) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({
          error: "Time slot currently held by another user. Try again shortly.",
        });
    }

    // Apply atomic 5-minute hold
    const updateQuery = `
      UPDATE ${table} 
      SET reserved_until = NOW() + INTERVAL '5 MINUTES' 
      WHERE id = $1 
      RETURNING reserved_until
    `;
    const updateRes = await client.query(updateQuery, [slotId]);

    await client.query("COMMIT");
    res.json({
      success: true,
      reservedUntil: updateRes.rows[0].reserved_until,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to secure time slot hold." });
  } finally {
    client.release();
  }
});

router.get("/consultations", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, client_name, format, employee_id, start_time, end_time, status
      FROM consultation_appointments
      WHERE start_time >= NOW() - INTERVAL '1 day'
      ORDER BY start_time ASC
    `,
    );

    res.json({ appointments: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Error fetching consultation events." });
  }
});

router.post("/consultations/book", async (req, res) => {
  const {
    clientName,
    clientEmail,
    clientPhone,
    employeeId,
    format,
    startTime,
    endTime,
    consentGiven,
  } = req.body;

  if (!clientName || !clientEmail || !startTime || !endTime || !consentGiven) {
    return res.status(400).json({ error: "Missing required booking fields." });
  }

  try {
    const conflict = await db.query(
      `
      SELECT id
      FROM consultation_appointments
      WHERE start_time < $2::timestamptz
        AND end_time > $1::timestamptz
        AND status != 'CANCELED'
      LIMIT 1
    `,
      [startTime, endTime],
    );

    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: "Selected consultation time is no longer available." });
    }

    const result = await db.query(
      `
      INSERT INTO consultation_appointments (
        client_name, client_email, client_phone, employee_id, format, start_time, end_time, status, consent_given
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8)
      RETURNING id, start_time, end_time, status
    `,
      [
        clientName,
        clientEmail,
        clientPhone || null,
        employeeId || null,
        format || "IN_PERSON",
        startTime,
        endTime,
        Boolean(consentGiven),
      ],
    );

    // Mark the corresponding slot instance as booked so it doesn't show as available anymore
    if (employeeId) {
      const slotDate = new Date(startTime).toISOString().split('T')[0];
      const startTimeStr = new Date(startTime).toTimeString().substring(0, 5);
      const endTimeStr = new Date(endTime).toTimeString().substring(0, 5);
      
      // Find the slot instance that was booked and mark it as unavailable
      await db.query(
        `UPDATE slot_instances
         SET status = 'BOOKED'
         WHERE user_id = $1
           AND TO_CHAR(slot_date, 'YYYY-MM-DD') = $2
           AND TO_CHAR(start_time, 'HH24:MI') = $3
           AND TO_CHAR(end_time, 'HH24:MI') = $4
           AND calendar_type = 'CONSULTATION'
           AND status NOT IN ('BREAK', 'LUNCH', 'SICK', 'NO_SHOW', 'VACATION', 'PERSONAL_TIME', 'REMOVED')`,
        [employeeId, slotDate, startTimeStr, endTimeStr]
      );
    }

    res.status(201).json({ success: true, booking: result.rows[0] });
  } catch (err) {
    console.error("Error booking consultation:", err);
    res.status(500).json({ error: "Failed to book consultation." });
  }
});

router.get("/workouts", authenticateToken, async (req, res) => {
  try {
    // Get workout sessions (legacy format)
    const result = await db.query(
      `
      SELECT 
        ws.id, 
        ws.trainer_id, 
        ws.student_id, 
        ws.start_time, 
        ws.end_time, 
        ws.status,
        t.first_name as trainer_first_name,
        t.last_name as trainer_last_name,
        s.first_name as student_first_name,
        s.last_name as student_last_name
      FROM workout_sessions ws
      LEFT JOIN users t ON ws.trainer_id = t.id
      LEFT JOIN users s ON ws.student_id = s.id
      WHERE ws.start_time >= NOW() - INTERVAL '7 days'
        AND ws.start_time <= NOW() + INTERVAL '90 days'
      ORDER BY ws.start_time ASC
    `,
    );

    // Get trainer session bookings (from session logs with scheduled status)
    const trainerBookings = await db.query(
      `
      SELECT 
        stsl.id, 
        sts.trainer_id, 
        sts.student_id, 
        stsl.scheduled_date as start_time,
        stsl.scheduled_date + INTERVAL '50 minutes' as end_time,
        stsl.status,
        t.first_name as trainer_first_name,
        t.last_name as trainer_last_name,
        s.first_name as student_first_name,
        s.last_name as student_last_name
      FROM student_trainer_session_logs stsl
      LEFT JOIN student_trainer_sessions sts ON stsl.student_trainer_session_id = sts.id
      LEFT JOIN users t ON sts.trainer_id = t.id
      LEFT JOIN users s ON sts.student_id = s.id
      WHERE stsl.scheduled_date >= NOW() - INTERVAL '7 days'
        AND stsl.scheduled_date <= NOW() + INTERVAL '90 days'
        AND stsl.status = 'SCHEDULED'
      ORDER BY stsl.scheduled_date ASC
    `,
    );

    const sessions = [
      ...result.rows.map((session) => {
        const trainerName = session.trainer_first_name && session.trainer_last_name 
          ? `${session.trainer_first_name} ${session.trainer_last_name}` 
          : 'TBD';
        const studentName = session.student_first_name && session.student_last_name 
          ? `${session.student_first_name} ${session.student_last_name}` 
          : 'Unknown Student';
        
        if (session.student_id) {
          console.log(`[/workouts] Session ID: ${session.id}, Trainer: ${trainerName}, Student: ${studentName}, Start: ${session.start_time}`);
        }
        
        return {
          id: session.id,
          trainer_id: session.trainer_id,
          student_id: session.student_id,
          trainer_name: trainerName,
          student_name: studentName,
          start_time: session.start_time,
          end_time: session.end_time,
          status: session.status,
        };
      }),
      ...trainerBookings.rows.map((booking) => {
        const trainerName = booking.trainer_first_name && booking.trainer_last_name 
          ? `${booking.trainer_first_name} ${booking.trainer_last_name}` 
          : 'TBD';
        const studentName = booking.student_first_name && booking.student_last_name 
          ? `${booking.student_first_name} ${booking.student_last_name}` 
          : 'Unknown Student';
        
        if (booking.student_id) {
            console.log(`[/workouts] Trainer Session ID: ${booking.id}, Trainer: ${trainerName}, Student: ${studentName}, Start: ${booking.start_time}`);
          }
        
        return {
          id: booking.id,
          trainer_id: booking.trainer_id,
          student_id: booking.student_id,
          trainer_name: trainerName,
          student_name: studentName,
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
        };
      })
    ];

    console.log(`[/workouts] Returning ${sessions.length} sessions (${result.rows.length} workout sessions + ${trainerBookings.rows.length} trainer sessions)`);
    console.log('[/workouts] Sample response:', JSON.stringify(sessions.slice(0, 1), null, 2));
    res.json({ sessions });
  } catch (err) {
    console.error("[/workouts] Error:", err);
    res.status(500).json({ error: "Error fetching workout sessions." });
  }
});

router.post("/workouts/book", authenticateToken, async (req, res) => {
  const { trainerId, startTime, endTime } = req.body;

  if (!trainerId || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing required workout booking fields." });
  }

  try {
    const vacationConflict = await db.query(
      `
      SELECT id
      FROM trainer_vacations
      WHERE trainer_id = $1
        AND daterange(start_date, end_date, '[]') @> $2::date
      LIMIT 1
    `,
      [trainerId, startTime],
    );

    if (vacationConflict.rows.length > 0) {
      return res.status(409).json({ error: "Trainer is on vacation for this date." });
    }

    const overlap = await db.query(
      `
      SELECT id
      FROM workout_sessions
      WHERE trainer_id = $1
        AND start_time < $3::timestamptz
        AND end_time > $2::timestamptz
        AND status IN ('SCHEDULED', 'COMPLETED')
      LIMIT 1
    `,
      [trainerId, startTime, endTime],
    );

    if (overlap.rows.length > 0) {
      return res.status(409).json({ error: "Selected workout slot is unavailable." });
    }

    const result = await db.query(
      `
      INSERT INTO workout_sessions (trainer_id, student_id, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, 'SCHEDULED')
      RETURNING id, start_time, end_time, status
    `,
      [trainerId, req.user.userId, startTime, endTime],
    );

    res.status(201).json({ success: true, session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to book workout session." });
  }
});

// 2. Fetch Trainer Vacations & Availability
router.get("/trainer-availability/:trainerId", async (req, res) => {
  try {
    const { trainerId } = req.params;
    const availability = await db.query(
      "SELECT * FROM trainer_availability WHERE trainer_id = $1",
      [trainerId],
    );
    const vacations = await db.query(
      "SELECT * FROM trainer_vacations WHERE trainer_id = $1",
      [trainerId],
    );

    res.json({ availability: availability.rows, vacations: vacations.rows });
  } catch (err) {
    res.status(500).json({ error: "Error fetching availability data." });
  }
});

// 3. Get Superuser Calendar Settings
router.get("/settings", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT slot_duration_minutes, break_duration_minutes, cancellation_cutoff_hours FROM calendar_settings LIMIT 1"
    );

    // Return defaults if no settings exist
    const settings = result.rows[0] || {
      slot_duration_minutes: 60,
      break_duration_minutes: 15,
      cancellation_cutoff_hours: 24,
    };

    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: "Error fetching calendar settings." });
  }
});

// 4. Update Superuser Calendar Settings (Superuser only)
router.put("/settings", authenticateToken, async (req, res) => {
  const { slotDurationMinutes, breakDurationMinutes, cancellationCutoffHours } = req.body;

  // Verify user is superuser (role_id = 1, assuming superuser role)
  try {
    const userRes = await db.query(
      "SELECT role_id FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (!userRes.rows[0] || userRes.rows[0].role_id !== 1) {
      return res.status(403).json({ error: "Only superusers can modify calendar settings." });
    }

    const existingSettings = await db.query("SELECT id FROM calendar_settings LIMIT 1");

    let result;
    if (existingSettings.rows.length > 0) {
      result = await db.query(
        `UPDATE calendar_settings 
         SET slot_duration_minutes = $1, break_duration_minutes = $2, cancellation_cutoff_hours = $3, updated_at = NOW()
         RETURNING slot_duration_minutes, break_duration_minutes, cancellation_cutoff_hours`,
        [slotDurationMinutes || 60, breakDurationMinutes || 15, cancellationCutoffHours || 24]
      );
    } else {
      result = await db.query(
        `INSERT INTO calendar_settings (slot_duration_minutes, break_duration_minutes, cancellation_cutoff_hours)
         VALUES ($1, $2, $3)
         RETURNING slot_duration_minutes, break_duration_minutes, cancellation_cutoff_hours`,
        [slotDurationMinutes || 60, breakDurationMinutes || 15, cancellationCutoffHours || 24]
      );
    }

    res.json({ success: true, settings: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update calendar settings." });
  }
});

// 5. Create or Update Trainer Availability Rules
router.post("/trainer-availability", authenticateToken, async (req, res) => {
  const { dayOfWeek, startTime, endTime, locationFormat } = req.body;
  const trainerId = req.user.userId;

  if (
    dayOfWeek === undefined ||
    !startTime ||
    !endTime ||
    !locationFormat
  ) {
    return res.status(400).json({ error: "Missing required availability fields." });
  }

  try {
    const existing = await db.query(
      "SELECT id FROM trainer_availability WHERE trainer_id = $1 AND day_of_week = $2",
      [trainerId, dayOfWeek]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE trainer_availability 
         SET start_time = $1, end_time = $2, location_format = $3
         WHERE trainer_id = $4 AND day_of_week = $5
         RETURNING id, day_of_week, start_time, end_time, location_format`,
        [startTime, endTime, locationFormat, trainerId, dayOfWeek]
      );
    } else {
      result = await db.query(
        `INSERT INTO trainer_availability (trainer_id, day_of_week, start_time, end_time, location_format)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, day_of_week, start_time, end_time, location_format`,
        [trainerId, dayOfWeek, startTime, endTime, locationFormat]
      );
    }

    res.status(201).json({ success: true, availability: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to set trainer availability." });
  }
});

// 6. Add Trainer Vacation Blockout
router.post("/trainer-vacations", authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.body;
  const trainerId = req.user.userId;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Missing vacation date fields." });
  }

  try {
    const result = await db.query(
      `INSERT INTO trainer_vacations (trainer_id, start_date, end_date)
       VALUES ($1, $2, $3)
       RETURNING id, start_date, end_date`,
      [trainerId, startDate, endDate]
    );

    res.status(201).json({ success: true, vacation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to create vacation blockout." });
  }
});

// 7. Remove Trainer Vacation Blockout
router.delete("/trainer-vacations/:vacationId", authenticateToken, async (req, res) => {
  const { vacationId } = req.params;
  const trainerId = req.user.userId;

  try {
    const result = await db.query(
      "DELETE FROM trainer_vacations WHERE id = $1 AND trainer_id = $2 RETURNING id",
      [vacationId, trainerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vacation record not found." });
    }

    res.json({ success: true, message: "Vacation blockout removed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove vacation blockout." });
  }
});

// 8. Get Trainer Availability Rules
router.get("/trainer-availability", authenticateToken, async (req, res) => {
  const trainerId = req.user.userId;

  try {
    const availability = await db.query(
      "SELECT * FROM trainer_availability WHERE trainer_id = $1 ORDER BY day_of_week ASC",
      [trainerId]
    );

    res.json({ availability: availability.rows });
  } catch (err) {
    res.status(500).json({ error: "Error fetching availability rules." });
  }
});

// 9. Get Trainer Vacations
router.get("/trainer-vacations", authenticateToken, async (req, res) => {
  const trainerId = req.user.userId;

  try {
    const vacations = await db.query(
      "SELECT * FROM trainer_vacations WHERE trainer_id = $1 ORDER BY start_date ASC",
      [trainerId]
    );

    res.json({ vacations: vacations.rows });
  } catch (err) {
    res.status(500).json({ error: "Error fetching vacation blockouts." });
  }
});

// 10. Update Workout Session Status (Trainer can manually update)
router.put("/workouts/:sessionId/status", authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const { status } = req.body;
  const trainerId = req.user.userId;

  if (!status || !["SCHEDULED", "COMPLETED", "FAILED", "ABSENT"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    // Verify the session belongs to the trainer making the request
    const sessionRes = await db.query(
      "SELECT id, trainer_id FROM workout_sessions WHERE id = $1",
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (sessionRes.rows[0].trainer_id !== trainerId) {
      return res.status(403).json({ error: "You can only update your own sessions." });
    }

    const result = await db.query(
      `UPDATE workout_sessions 
       SET status = $1
       WHERE id = $2
       RETURNING id, trainer_id, student_id, start_time, end_time, status`,
      [status, sessionId]
    );

    res.json({ success: true, session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update session status." });
  }
});

// 11. Get All Trainer Availability Slots (for calendar display)
router.get("/trainer-slots-all", authenticateToken, async (req, res) => {
  try {
    // Check if published_at column exists
    const columnRes = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'slot_instances' AND column_name = 'published_at'
      )`
    );
    const hasPublishedAt = columnRes.rows[0].exists;

    // Get all workout slots from the new slot_instances table with trainer info
    // Exclude slots with unavailable statuses (BREAK, LUNCH, SICK, NO_SHOW, VACATION, PERSONAL_TIME, REMOVED)
    let query = `
      SELECT 
        si.id, 
        si.user_id as trainer_id, 
        si.slot_date,
        si.start_time, 
        si.end_time, 
        si.status,
        si.calendar_type,
        u.first_name,
        u.last_name
      FROM slot_instances si
      JOIN users u ON si.user_id = u.id
      WHERE si.calendar_type = 'WORKOUT'
        AND si.status NOT IN ('BREAK', 'LUNCH', 'SICK', 'NO_SHOW', 'VACATION', 'PERSONAL_TIME', 'REMOVED')
    `;

    // Only filter by published_at if the column exists
    if (hasPublishedAt) {
      query += ` AND (si.published_at IS NULL OR si.published_at <= NOW())`;
    }

    query += ` ORDER BY si.user_id, si.slot_date, si.start_time`;

    const result = await db.query(query);

    const slots = result.rows.map((slot) => {
      // Format slot_date to YYYY-MM-DD string (in case PostgreSQL returns it with time)
      let formattedDate = slot.slot_date;
      if (typeof slot.slot_date === 'string') {
        // If it's already a string like "2026-11-06" or "2026-11-06T05:00:00.000Z"
        formattedDate = slot.slot_date.split('T')[0];
      } else if (slot.slot_date instanceof Date) {
        // If it's a Date object, format as YYYY-MM-DD
        const year = slot.slot_date.getFullYear();
        const month = String(slot.slot_date.getMonth() + 1).padStart(2, '0');
        const day = String(slot.slot_date.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }

      // Format start_time and end_time to HH:MM format (in case they have seconds)
      const formatTime = (timeStr) => {
        if (typeof timeStr === 'string') {
          return timeStr.substring(0, 5); // Get HH:MM from HH:MM:SS
        }
        return timeStr;
      };

      return {
        id: slot.id,
        trainerId: slot.trainer_id,
        trainerName: `${slot.first_name} ${slot.last_name}`,
        slotDate: formattedDate,
        startTime: formatTime(slot.start_time),
        endTime: formatTime(slot.end_time),
        status: slot.status === 'APPROVED' ? slot.calendar_type : slot.status,
        calendarType: slot.calendar_type,
        locationFormat: "IN_PERSON",
      };
    });

    res.json({ slots });
  } catch (err) {
    console.error("Error fetching trainer slots:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer slots." });
  }
});

// 12. Get All Trainer Consultation Availability Slots (for calendar display)
// Public endpoint - no authentication required for booking from Plans page
router.get("/trainer-consultation-slots-all", async (req, res) => {
  try {
    // Check if published_at column exists
    const columnRes = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'slot_instances' AND column_name = 'published_at'
      )`
    );
    const hasPublishedAt = columnRes.rows[0].exists;

    // Get all consultation slots from the new slot_instances table with trainer info
    // Exclude slots with unavailable statuses (BREAK, LUNCH, SICK, NO_SHOW, VACATION, PERSONAL_TIME, REMOVED, BOOKED)
    let query = `
      SELECT 
        si.id, 
        si.user_id as trainer_id, 
        si.slot_date,
        si.start_time, 
        si.end_time, 
        si.status,
        si.calendar_type,
        u.first_name,
        u.last_name
      FROM slot_instances si
      JOIN users u ON si.user_id = u.id
      WHERE si.calendar_type = 'CONSULTATION'
        AND si.status NOT IN ('BREAK', 'LUNCH', 'SICK', 'NO_SHOW', 'VACATION', 'PERSONAL_TIME', 'REMOVED', 'BOOKED')
    `;

    // Only filter by published_at if the column exists
    if (hasPublishedAt) {
      query += ` AND (si.published_at IS NULL OR si.published_at <= NOW())`;
    }

    query += ` ORDER BY si.user_id, si.slot_date, si.start_time`;

    const result = await db.query(query);

    const slots = result.rows.map((slot) => {
      // Format slot_date to YYYY-MM-DD string (in case PostgreSQL returns it with time)
      let formattedDate = slot.slot_date;
      if (typeof slot.slot_date === 'string') {
        // If it's already a string like "2026-11-06" or "2026-11-06T05:00:00.000Z"
        formattedDate = slot.slot_date.split('T')[0];
      } else if (slot.slot_date instanceof Date) {
        // If it's a Date object, format as YYYY-MM-DD
        const year = slot.slot_date.getFullYear();
        const month = String(slot.slot_date.getMonth() + 1).padStart(2, '0');
        const day = String(slot.slot_date.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }

      // Format start_time and end_time to HH:MM format (in case they have seconds)
      const formatTime = (timeStr) => {
        if (typeof timeStr === 'string') {
          return timeStr.substring(0, 5); // Get HH:MM from HH:MM:SS
        }
        return timeStr;
      };

      return {
        id: slot.id,
        trainerId: slot.trainer_id,
        trainerName: `${slot.first_name} ${slot.last_name}`,
        slotDate: formattedDate,
        startTime: formatTime(slot.start_time),
        endTime: formatTime(slot.end_time),
        status: slot.status === 'APPROVED' ? slot.calendar_type : slot.status,
        calendarType: slot.calendar_type,
        locationFormat: "IN_PERSON",
      };
    });

    res.json({ slots });
  } catch (err) {
    console.error("Error fetching trainer consultation slots:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer consultation slots." });
  }
});

// Get trainer's available consultation slots (for trainer's consolidated calendar)
router.get("/trainer-consultation-slots", authenticateToken, async (req, res) => {
  const { trainer_id } = req.query;

  if (!trainer_id) {
    return res.status(400).json({ error: "trainer_id is required" });
  }

  try {
    const query = `
      SELECT 
        si.id,
        si.user_id as trainer_id,
        si.slot_date,
        si.start_time,
        si.end_time,
        si.calendar_type,
        si.status
      FROM slot_instances si
      WHERE si.user_id = $1 
        AND si.calendar_type = 'CONSULTATION'
        AND si.status = 'APPROVED'
      ORDER BY si.slot_date, si.start_time
    `;

    const result = await db.query(query, [trainer_id]);

    const slots = result.rows.map((slot) => {
      try {
        // Handle slot_date - could be Date object or string
        let dateStr = slot.slot_date;
        if (slot.slot_date instanceof Date) {
          dateStr = slot.slot_date.toISOString().split('T')[0];
        } else if (typeof slot.slot_date === 'string') {
          dateStr = slot.slot_date.split('T')[0];
        }

        // Handle time - ensure it's in HH:MM:SS format
        let startTimeStr = slot.start_time;
        let endTimeStr = slot.end_time;

        if (typeof startTimeStr !== 'string' || !startTimeStr.includes(':')) {
          console.warn(`Invalid start_time format: ${startTimeStr}`);
          startTimeStr = '09:00:00';
        }
        if (typeof endTimeStr !== 'string' || !endTimeStr.includes(':')) {
          console.warn(`Invalid end_time format: ${endTimeStr}`);
          endTimeStr = '10:00:00';
        }

        // Construct full ISO timestamp
        const startTime = new Date(`${dateStr}T${startTimeStr}Z`);
        const endTime = new Date(`${dateStr}T${endTimeStr}Z`);

        return {
          id: slot.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: slot.status,
          calendar_type: slot.calendar_type,
        };
      } catch (parseErr) {
        console.error(`Error parsing slot ${slot.id}:`, parseErr, slot);
        return null;
      }
    }).filter(s => s !== null);

    res.json({ data: slots });
  } catch (err) {
    console.error("Error fetching trainer consultation slots:", err.message);
    console.error("Error details:", err);
    res.status(500).json({ error: "Failed to fetch trainer consultation slots.", details: err.message });
  }
});

// Get trainer's booked consultations (for trainer's consolidated calendar)
router.get("/trainer-consultations", authenticateToken, async (req, res) => {
  const { trainer_id } = req.query;

  if (!trainer_id) {
    return res.status(400).json({ error: "trainer_id is required" });
  }

  try {
    const query = `
      SELECT 
        ca.id,
        ca.employee_id,
        ca.client_name,
        ca.client_email,
        ca.client_phone,
        ca.status,
        ca.format,
        ca.start_time,
        ca.end_time,
        ca.created_at
      FROM consultation_appointments ca
      WHERE ca.employee_id = $1
      ORDER BY ca.start_time DESC
    `;

    const result = await db.query(query, [trainer_id]);
    res.json({ data: result.rows });
  } catch (err) {
    console.error("Error fetching trainer consultations:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer consultations.", details: err.message });
  }
});

// Get trainer's available workout slots (for trainer's consolidated calendar)
router.get("/trainer-workout-slots", authenticateToken, async (req, res) => {
  const { trainer_id } = req.query;

  if (!trainer_id) {
    return res.status(400).json({ error: "trainer_id is required" });
  }

  try {
    const query = `
      SELECT 
        si.id,
        si.user_id as trainer_id,
        si.slot_date,
        si.start_time,
        si.end_time,
        si.calendar_type,
        si.status
      FROM slot_instances si
      WHERE si.user_id = $1 
        AND si.calendar_type = 'WORKOUT'
        AND si.status = 'APPROVED'
      ORDER BY si.slot_date, si.start_time
    `;

    const result = await db.query(query, [trainer_id]);

    const slots = result.rows.map((slot) => {
      try {
        // Handle slot_date - could be Date object or string
        let dateStr = slot.slot_date;
        if (slot.slot_date instanceof Date) {
          dateStr = slot.slot_date.toISOString().split('T')[0];
        } else if (typeof slot.slot_date === 'string') {
          dateStr = slot.slot_date.split('T')[0];
        }

        // Handle time - ensure it's in HH:MM:SS format
        let startTimeStr = slot.start_time;
        let endTimeStr = slot.end_time;

        if (typeof startTimeStr !== 'string' || !startTimeStr.includes(':')) {
          console.warn(`Invalid start_time format: ${startTimeStr}`);
          startTimeStr = '09:00:00';
        }
        if (typeof endTimeStr !== 'string' || !endTimeStr.includes(':')) {
          console.warn(`Invalid end_time format: ${endTimeStr}`);
          endTimeStr = '10:00:00';
        }

        // Construct full ISO timestamp
        const startTime = new Date(`${dateStr}T${startTimeStr}Z`);
        const endTime = new Date(`${dateStr}T${endTimeStr}Z`);

        return {
          id: slot.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: slot.status,
          calendar_type: slot.calendar_type,
        };
      } catch (parseErr) {
        console.error(`Error parsing slot ${slot.id}:`, parseErr, slot);
        return null;
      }
    }).filter(s => s !== null);

    res.json({ data: slots });
  } catch (err) {
    console.error("Error fetching trainer workout slots:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer workout slots.", details: err.message });
  }
});

// Get trainer's booked workout sessions (for trainer's consolidated calendar)
router.get("/trainer-workouts", authenticateToken, async (req, res) => {
  const { trainer_id } = req.query;

  if (!trainer_id) {
    return res.status(400).json({ error: "trainer_id is required" });
  }

  try {
    const query = `
      SELECT 
        ws.id,
        ws.trainer_id,
        ws.student_id,
        ws.status,
        ws.start_time,
        ws.end_time,
        u.first_name as student_first_name,
        u.last_name as student_last_name,
        u.email as student_email
      FROM workout_sessions ws
      LEFT JOIN users u ON ws.student_id = u.id
      WHERE ws.trainer_id = $1
      ORDER BY ws.start_time DESC
    `;

    const result = await db.query(query, [trainer_id]);
    
    const workouts = result.rows.map((session) => ({
      id: session.id,
      client_name: session.student_first_name && session.student_last_name 
        ? `${session.student_first_name} ${session.student_last_name}` 
        : 'Student',
      client_email: session.student_email || 'N/A',
      status: session.status,
      start_time: session.start_time,
      end_time: session.end_time,
    }));

    res.json({ data: workouts });
  } catch (err) {
    console.error("Error fetching trainer workouts:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer workouts.", details: err.message });
  }
});

// Get employee's own slot instances (for slot management and display)
router.get("/my-slots", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `
      SELECT 
        si.id,
        si.user_id,
        si.template_id,
        si.calendar_type,
        TO_CHAR(si.slot_date, 'YYYY-MM-DD') as slot_date,
        si.start_time,
        si.end_time,
        si.status
      FROM slot_instances si
      WHERE si.user_id = $1
      ORDER BY si.slot_date ASC, si.start_time ASC
    `;

    const result = await db.query(query, [userId]);
    
    res.json({ instances: result.rows });
  } catch (err) {
    console.error("Error fetching employee slots:", err.message);
    res.status(500).json({ error: "Failed to fetch employee slots.", details: err.message });
  }
});

// Employee creates their own availability slots (uses same structure as superuser)
router.post("/slots/create", authenticateToken, async (req, res) => {
  const {
    userId,
    calendarType,
    startDate,
    endDate,
    startHour,
    startMinute,
    durationMinutes,
    endHour,
    endMinute,
    locationFormat,
    daysOfWeek,
  } = req.body;

  console.log("[CALENDARS] POST /slots/create received body:", JSON.stringify(req.body, null, 2));

  // Detailed validation with field-by-field checking
  const missingFields = [];
  if (!userId) missingFields.push('userId');
  if (!calendarType) missingFields.push('calendarType');
  if (!startDate) missingFields.push('startDate');
  if (!endDate) missingFields.push('endDate');
  if (startHour === undefined || startHour === null) missingFields.push('startHour');
  if (startMinute === undefined || startMinute === null) missingFields.push('startMinute');
  if (!durationMinutes) missingFields.push('durationMinutes');
  if (!daysOfWeek || daysOfWeek.length === 0) missingFields.push('daysOfWeek (must have at least one day)');

  if (missingFields.length > 0) {
    console.log("[CALENDARS] Missing fields:", missingFields);
    return res.status(400).json({ 
      error: "Missing required fields",
      missingFields: missingFields,
      receivedBody: req.body
    });
  }

  if (daysOfWeek.length === 0) {
    return res.status(400).json({ error: "At least one day of week must be selected" });
  }

  try {
    // Format start time as HH:MM
    const startTime = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
    
    console.log("Employee slot creation request:", {
      userId,
      calendarType,
      startDate,
      endDate,
      startHour,
      startMinute,
      durationMinutes,
      endHour,
      endMinute,
      locationFormat,
      daysOfWeek,
    });
    
    // Create template first (same as superuser flow)
    const templateResult = await db.query(
      `
      INSERT INTO scheduled_slot_templates 
      (user_id, created_by, calendar_type, start_date, end_date, start_time, duration_minutes, location_format, days_of_week)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [userId, userId, calendarType, startDate, endDate, startTime, durationMinutes, locationFormat || null, daysOfWeek]
    );

    const template = templateResult.rows[0];

    // Parse dates as local dates
    const startParts = startDate.split("-");
    const endParts = endDate.split("-");
    const startDateObj = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    const endDateObj = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const endTimeStr = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const [endHours, endMinutes] = endTimeStr.split(":").map(Number);

    let instancesInserted = 0;

    console.log("Date range:", { startDateObj, endDateObj, startHours, startMinutes, endHours, endMinutes });

    // Check if published_at column exists
    const columnRes = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'slot_instances' AND column_name = 'published_at'
      )`
    );
    const hasPublishedAt = columnRes.rows[0].exists;

    // Generate slot instances for all matching dates in the range
    console.log("Starting date loop. startDateObj:", startDateObj, "endDateObj:", endDateObj);
    
    let dateCount = 0;
    for (let d = new Date(startDateObj.getTime()); d <= endDateObj; d = new Date(d.getTime() + 86400000)) {
      dateCount++;
      if (dateCount > 100) {
        console.log("Date loop exceeded 100 iterations, breaking");
        break;
      }
      
      const dayOfWeek = d.getDay();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      console.log(`Date ${dateCount}: ${dateStr}, dayOfWeek=${dayOfWeek}, checking against daysOfWeek=${JSON.stringify(daysOfWeek)}`);
      
      if (daysOfWeek.includes(dayOfWeek)) {
        console.log(`  ✓ Match! Creating slots for ${dateStr}`);

        // Generate slots at the specified time interval
        let currentHour = startHours;
        console.log("Creating slots for date:", dateStr, "between", currentHour, startMinutes, "and", endHours, endMinutes);

        while (currentHour < endHours || (currentHour === endHours && startMinutes < endMinutes)) {
          const slotStartStr = `${String(currentHour).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}`;

          // Calculate slot end time
          let slotEndHour = currentHour + Math.floor((startMinutes + durationMinutes) / 60);
          let slotEndMinute = (startMinutes + durationMinutes) % 60;

          // Don't create slot if it goes beyond end time of day
          if (slotEndHour > endHours || (slotEndHour === endHours && slotEndMinute > endMinutes)) {
            break;
          }

          const slotEndStr = `${String(slotEndHour).padStart(2, "0")}:${String(slotEndMinute).padStart(2, "0")}`;

          try {
            // Insert slot instance
            if (hasPublishedAt) {
              const insertRes = await db.query(
                `
                INSERT INTO slot_instances (user_id, template_id, calendar_type, slot_date, start_time, end_time, status, published_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING *
                `,
                [userId, template.id, calendarType, dateStr, slotStartStr, slotEndStr, "APPROVED"]
              );
              if (insertRes.rows.length > 0) instancesInserted++;
            } else {
              const insertRes = await db.query(
                `
                INSERT INTO slot_instances (user_id, template_id, calendar_type, slot_date, start_time, end_time, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
                `,
                [userId, template.id, calendarType, dateStr, slotStartStr, slotEndStr, "APPROVED"]
              );
              if (insertRes.rows.length > 0) instancesInserted++;
            }
          } catch (err) {
            console.error(`Error inserting slot on ${dateStr}:`, err.message);
            // Continue with next slot
          }

          // Move to next hourly slot
          currentHour++;
        }
      }
    }

    console.log("Slot creation complete:", { instancesInserted, templateId: template.id });

    res.json({
      success: true,
      slotsCreated: instancesInserted,
      instancesCount: instancesInserted,
      message: `Successfully created ${instancesInserted} slots`,
    });
  } catch (err) {
    console.error("Error creating slots:", err.message);
    res.status(500).json({ error: "Failed to create slots", details: err.message });
  }
});


// Master Calendar Endpoint - Get all trainer slots including blocked times
router.get("/master-calendar-slots", async (req, res) => {
  console.log("[MASTER-CALENDAR-SLOTS] Endpoint hit!");
  try {
    // Get ALL slots from all trainers (including blocked/unavailable times)
    const query = `
      SELECT 
        si.id, 
        si.user_id as trainer_id, 
        si.slot_date,
        si.start_time, 
        si.end_time, 
        si.status,
        si.calendar_type,
        u.first_name,
        u.last_name
      FROM slot_instances si
      JOIN users u ON si.user_id = u.id
      WHERE u.role_id = (SELECT id FROM roles WHERE role_name = 'TRAINER')
        AND si.status != 'REMOVED'
      ORDER BY si.user_id, si.slot_date, si.start_time
    `;

    const result = await db.query(query);
    console.log("[MASTER-CALENDAR-SLOTS] Query returned", result.rows.length, "rows");

    const slots = result.rows.map((slot) => {
      // Format dates and times
      let formattedDate = slot.slot_date;
      if (typeof slot.slot_date === 'string') {
        formattedDate = slot.slot_date.split('T')[0];
      } else if (slot.slot_date instanceof Date) {
        const year = slot.slot_date.getFullYear();
        const month = String(slot.slot_date.getMonth() + 1).padStart(2, '0');
        const day = String(slot.slot_date.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }

      const formatTime = (timeStr) => {
        if (typeof timeStr === 'string') {
          return timeStr.substring(0, 5);
        }
        return timeStr;
      };

      // Map status for display
      const displayStatus = slot.status === 'APPROVED' ? slot.calendar_type : slot.status;

      return {
        id: slot.id,
        trainerId: slot.trainer_id,
        trainerName: `${slot.first_name} ${slot.last_name}`,
        slotDate: formattedDate,
        startTime: formatTime(slot.start_time),
        endTime: formatTime(slot.end_time),
        status: displayStatus,
        calendarType: slot.calendar_type,
      };
    });

    console.log("[MASTER-CALENDAR-SLOTS] Mapped", slots.length, "slots");
    res.json({ slots });
  } catch (err) {
    console.error("Error fetching master calendar slots:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer slots." });
  }
});

module.exports = router;
