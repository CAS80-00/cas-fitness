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
    const result = await db.query(
      `
      SELECT id, trainer_id, student_id, start_time, end_time, status
      FROM workout_sessions
      WHERE start_time >= NOW() - INTERVAL '7 days'
      ORDER BY start_time ASC
    `,
    );

    res.json({ sessions: result.rows });
  } catch (err) {
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

module.exports = router;
