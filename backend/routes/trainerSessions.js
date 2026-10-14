const express = require('express');
const router = express.Router();
const db = require('../db/client');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// ============================================================================
// TRAINERS - List Available Trainers (Superuser/Staff Only)
// ============================================================================

// Get all trainers (users with TRAINER role) for dropdown selection
router.get('/trainers', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone, u.status
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE r.role_name = 'TRAINER'
      ORDER BY u.first_name, u.last_name
    `);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status
    })));
  } catch (err) {
    console.error('Error fetching trainers:', err.message);
    res.status(500).json({ error: 'Failed to fetch trainers.' });
  }
});

// ============================================================================
// TRAINER SESSION PACKAGES - Management (Superuser/Staff Only)
// ============================================================================

// Get all trainer session packages
router.get('/packages', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, name, description, session_count, duration_minutes, price,
        is_active, created_by, created_at, updated_at
      FROM trainer_session_packages
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trainer session packages:', err);
    res.status(500).json({ error: 'Failed to fetch trainer session packages' });
  }
});

// Get single trainer session package
router.get('/packages/:packageId', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  try {
    const { packageId } = req.params;
    const result = await db.query(`
      SELECT 
        id, name, description, session_count, duration_minutes, price,
        is_active, created_by, created_at, updated_at
      FROM trainer_session_packages
      WHERE id = $1
    `, [packageId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching trainer session package:', err);
    res.status(500).json({ error: 'Failed to fetch trainer session package' });
  }
});

// Create new trainer session package
router.post('/packages', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  const { name, description, session_count, duration_minutes, price, is_active } = req.body;

  if (!name || !session_count || !price) {
    return res.status(400).json({ error: 'Missing required fields: name, session_count, price' });
  }

  try {
    const result = await db.query(`
      INSERT INTO trainer_session_packages 
      (name, description, session_count, duration_minutes, price, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, description, session_count, duration_minutes, price, is_active, created_by, created_at, updated_at
    `, [name, description, session_count, duration_minutes || 60, price, is_active !== false, req.user.userId]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating trainer session package:', err);
    res.status(500).json({ error: 'Failed to create trainer session package' });
  }
});

// Update trainer session package
router.put('/packages/:packageId', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  const { packageId } = req.params;
  const { name, description, session_count, duration_minutes, price, is_active } = req.body;

  try {
    const result = await db.query(`
      UPDATE trainer_session_packages
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        session_count = COALESCE($3, session_count),
        duration_minutes = COALESCE($4, duration_minutes),
        price = COALESCE($5, price),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $7
      RETURNING id, name, description, session_count, duration_minutes, price, is_active, created_by, created_at, updated_at
    `, [name, description, session_count, duration_minutes, price, is_active, packageId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating trainer session package:', err);
    res.status(500).json({ error: 'Failed to update trainer session package' });
  }
});

// ============================================================================
// STUDENT TRAINER SESSIONS - Management
// ============================================================================

// Get all trainer sessions for a student (Admin/Superuser view OR student viewing their own)
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  const { studentId } = req.params;

  console.log('[TRAINER-SESSIONS] Student sessions request - req.user:', req.user);
  console.log('[TRAINER-SESSIONS] Looking for student:', studentId);

  // Allow a student to view their own sessions, or allow SUPERUSER/STAFF to view any student's
  if (req.user.userId !== studentId) {
    console.log('[TRAINER-SESSIONS] User is not viewing their own profile, checking role...');
    // Not their own profile, check if they have admin role
    try {
      const roleRes = await db.query(
        "SELECT role_name FROM roles WHERE id = $1",
        [req.user.roleId]
      );
      
      if (roleRes.rows.length === 0) {
        console.log('[TRAINER-SESSIONS] Role not found for roleId:', req.user.roleId);
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const roleName = roleRes.rows[0].role_name;
      console.log('[TRAINER-SESSIONS] User role:', roleName);
      if (!['SUPERUSER', 'STAFF'].includes(roleName)) {
        console.log('[TRAINER-SESSIONS] User role not authorized');
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch (err) {
      console.error('[TRAINER-SESSIONS] Error checking role:', err);
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  try {
    const result = await db.query(`
      SELECT 
        sts.id, sts.student_id, sts.trainer_id, sts.package_id,
        sts.total_sessions, sts.remaining_sessions,
        sts.start_date, sts.expiration_date, sts.status,
        sts.notes, sts.created_at, sts.updated_at,
        tsp.name as package_name,
        trainer.first_name as trainer_first_name, trainer.last_name as trainer_last_name,
        assigned.first_name as assigned_by_first_name, assigned.last_name as assigned_by_last_name
      FROM student_trainer_sessions sts
      LEFT JOIN trainer_session_packages tsp ON sts.package_id = tsp.id
      LEFT JOIN users trainer ON sts.trainer_id = trainer.id
      LEFT JOIN users assigned ON sts.assigned_by = assigned.id
      WHERE sts.student_id = $1
      ORDER BY sts.created_at DESC
    `, [studentId]);
    
    console.log('[TRAINER-SESSIONS] Returning', result.rows.length, 'sessions');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching student trainer sessions:', err);
    res.status(500).json({ error: 'Failed to fetch student trainer sessions' });
  }
});

// Get single student trainer session with all session logs
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionResult = await db.query(`
      SELECT 
        sts.id, sts.student_id, sts.trainer_id, sts.package_id,
        sts.total_sessions, sts.remaining_sessions,
        sts.start_date, sts.expiration_date, sts.status,
        sts.notes, sts.created_at, sts.updated_at,
        tsp.name as package_name,
        trainer.first_name as trainer_first_name, trainer.last_name as trainer_last_name,
        student.first_name as student_first_name, student.last_name as student_last_name
      FROM student_trainer_sessions sts
      LEFT JOIN trainer_session_packages tsp ON sts.package_id = tsp.id
      LEFT JOIN users trainer ON sts.trainer_id = trainer.id
      LEFT JOIN users student ON sts.student_id = student.id
      WHERE sts.id = $1
    `, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer session not found' });
    }

    const logsResult = await db.query(`
      SELECT id, session_number, scheduled_date, completed_date, status, location_format, notes, created_at, updated_at
      FROM student_trainer_session_logs
      WHERE student_trainer_session_id = $1
      ORDER BY session_number ASC
    `, [sessionId]);

    // Count sessions by status
    const scheduled = logsResult.rows.filter(log => log.status === 'SCHEDULED').length;
    const used = logsResult.rows.filter(log => log.status === 'COMPLETED').length;
    const purchased = sessionResult.rows[0].total_sessions;
    
    // Check if package has expired
    const expirationDate = new Date(sessionResult.rows[0].expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);
    const isExpired = today > expirationDate;
    
    // If expired, remaining is 0; otherwise calculate it
    const remaining = isExpired ? 0 : (purchased - scheduled - used);

    res.json({
      ...sessionResult.rows[0],
      scheduled_sessions: scheduled,
      used_sessions: used,
      remaining_sessions: remaining,
      purchased_sessions: purchased,
      is_expired: isExpired,
      session_logs: logsResult.rows
    });
  } catch (err) {
    console.error('Error fetching trainer session:', err);
    res.status(500).json({ error: 'Failed to fetch trainer session' });
  }
});

// Create new student trainer session package assignment
router.post('/assign', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  const { student_id, trainer_id, package_id, total_sessions, start_date, expiration_date, notes } = req.body;

  console.log('POST /assign received full body:', JSON.stringify(req.body, null, 2));
  console.log('Parsed values:', { student_id, total_sessions, start_date, expiration_date });

  if (!student_id || !total_sessions || !start_date || !expiration_date) {
    console.log('Validation failed - missing fields');
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR_v2: Missing required fields: student_id, total_sessions, start_date, expiration_date' 
    });
  }

  try {
    // Begin transaction
    await db.query('BEGIN');

    // Create main session record
    const sessionResult = await db.query(`
      INSERT INTO student_trainer_sessions 
      (student_id, trainer_id, package_id, total_sessions, remaining_sessions, 
       start_date, expiration_date, status, assigned_by, notes)
      VALUES ($1, $2, $3, $4, $4, $5, $6, 'ACTIVE', $7, $8)
      RETURNING id, student_id, trainer_id, package_id, total_sessions, remaining_sessions,
                start_date, expiration_date, status, created_at, updated_at
    `, [student_id, trainer_id || null, package_id || null, total_sessions, start_date, expiration_date, req.user.userId, notes]);

    const sessionId = sessionResult.rows[0].id;

    // Create individual session logs
    const logInserts = [];
    for (let i = 1; i <= total_sessions; i++) {
      logInserts.push([sessionId, i, null, null, 'PENDING', null, null]);
    }

    for (const logData of logInserts) {
      await db.query(`
        INSERT INTO student_trainer_session_logs 
        (student_trainer_session_id, session_number, scheduled_date, completed_date, status, location_format, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, logData);
    }

    await db.query('COMMIT');

    res.status(201).json({
      ...sessionResult.rows[0],
      message: `Successfully created ${total_sessions} sessions for student`
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error assigning trainer sessions:', err);
    res.status(500).json({ error: 'Failed to assign trainer sessions' });
  }
});

// Update student trainer session
router.put('/session/:sessionId', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  const sessionId = parseInt(req.params.sessionId);
  const { total_sessions, start_date, expiration_date, status, notes } = req.body;

  try {
    // When total_sessions changes, reset remaining_sessions to match
    const result = await db.query(
      `UPDATE student_trainer_sessions
       SET total_sessions = $1, 
           remaining_sessions = $1,
           start_date = COALESCE($2, start_date),
           expiration_date = COALESCE($3, expiration_date),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, student_id, trainer_id, total_sessions, remaining_sessions, start_date, expiration_date, status, created_at, updated_at`,
      [total_sessions, start_date, expiration_date, status, notes, sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT] Error updating session:', err.message);
    res.status(500).json({ error: 'Failed to update session', details: err.message });
  }
});

// Delete student trainer session (cascade deletes related logs)
router.delete('/session/:sessionId', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  const { sessionId } = req.params;

  try {
    // The cascade delete in the schema will handle related logs
    const result = await db.query(`
      DELETE FROM student_trainer_sessions
      WHERE id = $1
      RETURNING id
    `, [sessionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer session not found' });
    }
    res.json({ message: 'Trainer session deleted successfully' });
  } catch (err) {
    console.error('Error deleting trainer session:', err);
    res.status(500).json({ error: 'Failed to delete trainer session' });
  }
});

// ============================================================================
// SESSION LOGS - Management
// ============================================================================

// Update individual session log (mark as completed, scheduled, cancelled, etc.)
router.put('/session-log/:logId', authenticateToken, requireRole(['SUPERUSER', 'STAFF', 'TRAINER']), async (req, res) => {
  const { logId } = req.params;
  const { scheduled_date, completed_date, status, location_format, notes } = req.body;

  try {
    const result = await db.query(`
      UPDATE student_trainer_session_logs
      SET 
        scheduled_date = COALESCE($1, scheduled_date),
        completed_date = COALESCE($2, completed_date),
        status = COALESCE($3, status),
        location_format = COALESCE($4, location_format),
        notes = COALESCE($5, notes),
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, student_trainer_session_id, session_number, scheduled_date, 
                completed_date, status, location_format, notes
    `, [scheduled_date, completed_date, status, location_format, notes, logId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session log not found' });
    }

    // If session is completed, decrement remaining_sessions count
    if (status === 'COMPLETED') {
      const logData = result.rows[0];
      await db.query(`
        UPDATE student_trainer_sessions
        SET remaining_sessions = remaining_sessions - 1
        WHERE id = $1 AND remaining_sessions > 0
      `, [logData.student_trainer_session_id]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating session log:', err);
    res.status(500).json({ error: 'Failed to update session log' });
  }
});

// Bulk update session logs status
router.put('/session/:sessionId/logs-status', authenticateToken, requireRole(['SUPERUSER', 'STAFF']), async (req, res) => {
  const { sessionId } = req.params;
  const { status, scheduled_dates } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const result = await db.query(`
      UPDATE student_trainer_session_logs
      SET status = $1, updated_at = NOW()
      WHERE student_trainer_session_id = $2
      RETURNING id, session_number, status
    `, [status, sessionId]);

    res.json({
      message: `Updated ${result.rows.length} session logs`,
      updated_logs: result.rows
    });
  } catch (err) {
    console.error('Error bulk updating session logs:', err);
    res.status(500).json({ error: 'Failed to update session logs' });
  }
});

// ============================================================================
// STUDENT BOOKING FLOW - View Available Trainers and Schedule Sessions
// ============================================================================

// Get available trainers for student booking (trainers with WORKOUT slots in calendar)
router.get('/available-trainers', authenticateToken, async (req, res) => {
  try {
    // Get trainers who have at least one WORKOUT slot in the master calendar
    const result = await db.query(`
      SELECT DISTINCT
        u.id, u.first_name, u.last_name, u.email, u.phone, u.status,
        COUNT(DISTINCT si.id) as available_slots
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      INNER JOIN slot_instances si ON u.id = si.user_id
      WHERE r.role_name = 'TRAINER'
        AND u.status = 'ACTIVE'
        AND si.calendar_type = 'WORKOUT'
        AND si.status IN ('WORKOUT', 'APPROVED')
        AND si.slot_date >= CURRENT_DATE
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.status
      ORDER BY u.first_name, u.last_name
    `);
    
    console.log(`[TRAINER-SESSIONS] Available trainers query returned ${result.rows.length} trainers`);
    
    if (result.rows.length === 0) {
      console.log('[TRAINER-SESSIONS] DEBUG: No trainers found. Checking database:');
      
      // Debug: Check if there are any trainers at all
      const allTrainers = await db.query(`
        SELECT u.id, u.first_name, COUNT(si.id) as slot_count, COUNT(si.id) FILTER (WHERE si.status = 'WORKOUT') as workout_slots, COUNT(si.id) FILTER (WHERE si.status = 'APPROVED') as approved_slots
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN slot_instances si ON u.id = si.user_id AND si.calendar_type = 'WORKOUT' AND si.slot_date >= CURRENT_DATE
        WHERE r.role_name = 'TRAINER'
        GROUP BY u.id, u.first_name
      `);
      console.log('[TRAINER-SESSIONS] All trainers with WORKOUT slot count:', allTrainers.rows);
    }
    
    res.json(result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      availableSlots: parseInt(row.available_slots) || 0
    })));
  } catch (err) {
    console.error('[TRAINER-SESSIONS] Error fetching available trainers:', err.message);
    res.status(500).json({ error: 'Failed to fetch available trainers.' });
  }
});

// Get trainer's published workout schedule for a specific date range
router.get('/trainer-schedule/:trainerId', authenticateToken, async (req, res) => {
  const { trainerId } = req.params;
  const { startDate, endDate } = req.query;
  
  try {
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Get trainer info
    const trainerResult = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND r.role_name = 'TRAINER' AND u.status = 'ACTIVE'
    `, [trainerId]);

    if (trainerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    const trainer = trainerResult.rows[0];

    console.log(`[TRAINER-SESSIONS] Fetching slots for trainer ${trainerId} from ${startDate} to ${endDate}`);

    // Get WORKOUT and BOOKED slots for the date range from master calendar
    // Available slots (WORKOUT, APPROVED) show as available
    // BOOKED slots show as occupied with student details
    const slotsResult = await db.query(`
      SELECT 
        si.id, 
        si.slot_date, 
        si.start_time::TEXT as start_time, 
        si.end_time::TEXT as end_time, 
        si.status,
        stsl.student_trainer_session_id,
        u_student.first_name as student_first_name,
        u_student.last_name as student_last_name
      FROM slot_instances si
      LEFT JOIN student_trainer_session_logs stsl ON si.id = stsl.slot_instance_id
      LEFT JOIN student_trainer_sessions sts ON stsl.student_trainer_session_id = sts.id
      LEFT JOIN users u_student ON sts.student_id = u_student.id
      WHERE si.user_id = $1
        AND si.calendar_type = 'WORKOUT'
        AND si.status IN ('WORKOUT', 'APPROVED', 'BOOKED')
        AND slot_date BETWEEN $2 AND $3
      ORDER BY slot_date, start_time
    `, [trainerId, startDate, endDate]);

    console.log(`[TRAINER-SESSIONS] Found ${slotsResult.rows.length} slots for trainer ${trainerId}`);

    res.json({
      trainer: {
        id: trainer.id,
        firstName: trainer.first_name,
        lastName: trainer.last_name,
        email: trainer.email,
        phone: trainer.phone
      },
      availableSlots: slotsResult.rows.map(row => ({
        id: String(row.id),
        date: row.slot_date,
        startTime: String(row.start_time).substring(0, 5),
        endTime: String(row.end_time).substring(0, 5),
        status: row.status,
        isBooked: row.status === 'BOOKED',
        bookedBy: row.status === 'BOOKED' ? `${row.student_first_name} ${row.student_last_name}` : null,
        sessionId: row.student_trainer_session_id
      }))
    });
  } catch (err) {
    console.error('[TRAINER-SESSIONS] Error fetching trainer schedule:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch trainer schedule', details: err.message });
  }
});

// Student books a session slot - creates session log entry
router.post('/book-session', authenticateToken, async (req, res) => {
  const { sessionPackageId, trainerId, slotInstanceId } = req.body;
  const studentId = req.user.userId;

  if (!sessionPackageId || !trainerId || !slotInstanceId) {
    return res.status(400).json({ error: 'Missing required fields: sessionPackageId, trainerId, slotInstanceId' });
  }

  try {
    // Verify the student has an active session package
    const packageResult = await db.query(`
      SELECT sts.id, sts.trainer_id, sts.remaining_sessions, sts.expiration_date, sts.start_date
      FROM student_trainer_sessions sts
      WHERE sts.id = $1 
        AND sts.student_id = $2 
        AND sts.status = 'ACTIVE'
        AND sts.remaining_sessions > 0
        AND CURRENT_DATE >= DATE(sts.start_date)
        AND CURRENT_DATE <= DATE(sts.expiration_date)
    `, [sessionPackageId, studentId]);

    if (packageResult.rows.length === 0) {
      return res.status(403).json({ error: 'No active session package found for this student' });
    }

    const sessionPackage = packageResult.rows[0];

    // Update session package with trainer_id if not already set
    if (!sessionPackage.trainer_id) {
      await db.query(`
        UPDATE student_trainer_sessions
        SET trainer_id = $1
        WHERE id = $2
      `, [trainerId, sessionPackageId]);
      
      console.log('[TRAINER-SESSIONS] Updated session package with trainer_id:', trainerId);
    }

    // Verify the slot instance exists and is available (from master calendar)
    const slotResult = await db.query(`
      SELECT si.id, si.slot_date, si.start_time::TEXT as start_time, si.end_time, si.user_id
      FROM slot_instances si
      WHERE si.id = $1
        AND si.user_id = $2
        AND si.calendar_type = 'WORKOUT'
        AND si.status IN ('WORKOUT', 'APPROVED')
    `, [slotInstanceId, trainerId]);

    console.log('[TRAINER-SESSIONS] Slot check result:', slotResult.rows.length, 'found for slotInstanceId:', slotInstanceId, 'trainerId:', trainerId);
    if (slotResult.rows.length > 0) {
      console.log('[TRAINER-SESSIONS] Slot details:', slotResult.rows[0]);
    }

    if (slotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Slot instance not found or not available' });
    }

    const slot = slotResult.rows[0];

    // Verify slot date is within session package validity
    const slotDate = new Date(slot.slot_date);
    const startDate = new Date(sessionPackage.start_date);
    const expirationDate = new Date(sessionPackage.expiration_date);

    if (slotDate < startDate || slotDate > expirationDate) {
      return res.status(400).json({ error: 'Slot date is outside your session package validity period' });
    }

    // Create session log
    // Parse slot_date - it could be a Date or ISO string
    let slotDatePart;
    if (typeof slot.slot_date === 'string') {
      slotDatePart = slot.slot_date.split('T')[0];
    } else if (slot.slot_date instanceof Date) {
      slotDatePart = slot.slot_date.toISOString().split('T')[0];
    } else {
      slotDatePart = new Date(slot.slot_date).toISOString().split('T')[0];
    }
    
    // Combine slot_date and start_time into ISO format timestamp
    // start_time is already in HH:MM:SS format from the TIME column
    const scheduledDateTime = `${slotDatePart}T${slot.start_time}`;
    
    console.log('[TRAINER-SESSIONS] Input scheduledDateTime:', scheduledDateTime);

    // Create session log with slot_instance_id link
    // When JavaScript parses "2026-10-16T13:00:00" (without timezone marker),
    // it automatically interprets as LOCAL time. Since the backend runs in EDT,
    // this correctly converts: 1 PM EDT -> "2026-10-16T17:00:00Z" (5 PM UTC)
    // We just need to convert to ISO string and store as-is
    const dateObj = new Date(scheduledDateTime);
    const utcDateString = dateObj.toISOString().split('.')[0];  // Remove milliseconds
    
    console.log('[TRAINER-SESSIONS] Timezone handling:');
    console.log('[TRAINER-SESSIONS]   Input (user\'s local time):', scheduledDateTime);
    console.log('[TRAINER-SESSIONS]   Converted to UTC for storage:', utcDateString);

    const logResult = await db.query(`
      INSERT INTO student_trainer_session_logs (
        student_trainer_session_id, slot_instance_id, session_number, scheduled_date, location_format, status
      ) VALUES (
        $1, 
        $4,
        ($2 - (
          SELECT COUNT(*) FROM student_trainer_session_logs 
          WHERE student_trainer_session_id = $1
        )),
        $3::TIMESTAMPTZ,
        'IN_PERSON',
        'SCHEDULED'
      )
      RETURNING id, session_number, status, scheduled_date, slot_instance_id
    `, [sessionPackageId, sessionPackage.remaining_sessions, utcDateString, slotInstanceId]);

    // Log what was actually stored in the database
    const storedDate = logResult.rows[0].scheduled_date;
    const storedSlotId = logResult.rows[0].slot_instance_id;
    console.log('[TRAINER-SESSIONS] Stored session log:', {
      id: logResult.rows[0].id,
      slot_instance_id: storedSlotId,
      scheduled_date: storedDate,
      sessionNumber: logResult.rows[0].session_number
    });

    // Mark the slot as BOOKED in the master calendar
    await db.query(`
      UPDATE slot_instances
      SET status = 'BOOKED', modified_by = $2, modified_at = NOW()
      WHERE id = $1
    `, [slotInstanceId, studentId]);

    // Update remaining sessions
    await db.query(`
      UPDATE student_trainer_sessions
      SET remaining_sessions = remaining_sessions - 1, updated_at = NOW()
      WHERE id = $1
    `, [sessionPackageId]);

    res.json({
      success: true,
      message: 'Session booked successfully',
      sessionLog: {
        id: logResult.rows[0].id,
        sessionNumber: logResult.rows[0].session_number,
        status: logResult.rows[0].status,
        scheduledDate: logResult.rows[0].scheduled_date.toISOString ? logResult.rows[0].scheduled_date.toISOString() : logResult.rows[0].scheduled_date
      }
    });
  } catch (err) {
    console.error('[TRAINER-SESSIONS] Error booking session:', err.message);
    console.error('[TRAINER-SESSIONS] Full error:', err.stack);
    res.status(500).json({ error: `Failed to book session: ${err.message}` });
  }
});

// Cancel a booked trainer session (students can cancel if 24+ hours away)
router.post('/session-log/:logId/cancel', authenticateToken, async (req, res) => {
  const { logId } = req.params;
  const studentId = req.user.userId;

  try {
    // Get the session log details
    const logResult = await db.query(`
      SELECT 
        stsl.id, stsl.student_trainer_session_id, stsl.scheduled_date, stsl.status,
        stsl.slot_instance_id,
        sts.student_id, sts.trainer_id
      FROM student_trainer_session_logs stsl
      JOIN student_trainer_sessions sts ON stsl.student_trainer_session_id = sts.id
      WHERE stsl.id = $1
    `, [logId]);

    if (logResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const log = logResult.rows[0];
    
    console.log('[TRAINER-SESSIONS] Cancellation request details:', {
      logId: logId,
      status: log.status,
      slotInstanceId: log.slot_instance_id,
      trainerId: log.trainer_id,
      studentId: log.student_id,
      scheduledDate: log.scheduled_date
    });

    // Verify this is the student's session
    if (log.student_id !== studentId) {
      return res.status(403).json({ error: 'Unauthorized - this is not your session' });
    }

    // Check if session is already cancelled
    if (log.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Session is already cancelled' });
    }

    // Check if session is more than 24 hours away
    const scheduledDate = new Date(log.scheduled_date);
    const hoursUntilSession = (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilSession < 24) {
      return res.status(400).json({ 
        error: 'Cannot cancel within 24 hours of session start',
        hoursUntilSession: hoursUntilSession.toFixed(2)
      });
    }

    // Cancel the session log
    await db.query(`
      UPDATE student_trainer_session_logs
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1
    `, [logId]);
    
    console.log('[TRAINER-SESSIONS] Updated session log to CANCELLED:', logId);

    // Release the slot back to available in trainer's calendar
    // This makes it show as WORKOUT (available) instead of BOOKED
    if (log.slot_instance_id) {
      const slotUpdateResult = await db.query(`
        UPDATE slot_instances
        SET status = 'WORKOUT', modified_by = $2, modified_at = NOW()
        WHERE id = $1
        RETURNING id, status, slot_date, start_time, user_id
      `, [log.slot_instance_id, studentId]);
      
      if (slotUpdateResult.rows.length > 0) {
        const updatedSlot = slotUpdateResult.rows[0];
        console.log('[TRAINER-SESSIONS] ✅ Released slot back to WORKOUT:', {
          slotId: log.slot_instance_id,
          trainerId: updatedSlot.user_id,
          status: updatedSlot.status,
          date: updatedSlot.slot_date,
          time: updatedSlot.start_time
        });
      } else {
        console.log('[TRAINER-SESSIONS] ⚠️ Slot update query returned no rows. Checking if slot exists...');
        const checkSlot = await db.query('SELECT id, status FROM slot_instances WHERE id = $1', [log.slot_instance_id]);
        if (checkSlot.rows.length === 0) {
          console.log('[TRAINER-SESSIONS] ❌ Slot ID not found in database:', log.slot_instance_id);
        } else {
          console.log('[TRAINER-SESSIONS] Slot exists but update failed:', checkSlot.rows[0]);
        }
      }
    } else {
      console.log('[TRAINER-SESSIONS] ❌ CRITICAL: No slot_instance_id found for session log:', logId);
      console.log('[TRAINER-SESSIONS] Session log details:', log);
    }

    // Restore remaining sessions
    await db.query(`
      UPDATE student_trainer_sessions
      SET remaining_sessions = remaining_sessions + 1, updated_at = NOW()
      WHERE id = $1
    `, [log.student_trainer_session_id]);

    console.log('[TRAINER-SESSIONS] Session cancelled:', logId, 'Trainer:', log.trainer_id);

    res.json({
      success: true,
      message: 'Session cancelled successfully - availability restored',
      remainingSessionsRestored: 1,
      slotReleased: !!log.slot_instance_id
    });
  } catch (err) {
    console.error('[TRAINER-SESSIONS] Error cancelling session:', err.message);
    res.status(500).json({ error: `Failed to cancel session: ${err.message}` });
  }
});

// ============================================================================
// TRAINER/SUPERUSER SESSION MANAGEMENT - Update Session Status
// ============================================================================

// Update trainer session status (COMPLETE, ABSENT, or CANCEL)
router.put('/session-log/:logId/manage-status', authenticateToken, async (req, res) => {
  const { logId } = req.params;
  const { newStatus } = req.body;
  const userId = req.user.userId;
  const userRoleId = req.user.roleId;

  console.log(`[/trainer-sessions/manage-status] Received request for logId: ${logId}, newStatus: ${newStatus}, userRoleId: ${userRoleId}`);

  // Validate status - database accepts: SCHEDULED, COMPLETED, FAILED, ABSENT, CANCELLED
  if (!['COMPLETED', 'ABSENT', 'CANCELLED'].includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status. Must be COMPLETED, ABSENT, or CANCELLED.' });
  }

  try {
    // Get session log and related data
    const logResult = await db.query(`
      SELECT 
        stsl.id, stsl.student_trainer_session_id, stsl.scheduled_date, stsl.status,
        sts.student_id, sts.trainer_id, sts.remaining_sessions,
        si.id as slot_instance_id
      FROM student_trainer_session_logs stsl
      JOIN student_trainer_sessions sts ON stsl.student_trainer_session_id = sts.id
      LEFT JOIN slot_instances si ON stsl.slot_instance_id = si.id
      WHERE stsl.id = $1
    `, [logId]);

    console.log(`[/trainer-sessions/manage-status] Query result for logId ${logId}:`, logResult.rows);

    if (logResult.rows.length === 0) {
      console.log(`[/trainer-sessions/manage-status] No session log found for ID ${logId}`);
      return res.status(404).json({ error: 'Session log not found' });
    }

    const log = logResult.rows[0];
    console.log(`[/trainer-sessions/manage-status] Found session log:`, log);

    // Permission check: only trainer, superuser (roleId=1), or staff can manage sessions
    // roleId: 1=SUPERUSER, 2=TRAINER, 3=STAFF, 4=STUDENT
    const isTrainer = userRoleId === 2 && log.trainer_id === userId;
    const isSuperuserOrStaff = userRoleId === 1 || userRoleId === 3;

    console.log(`[/trainer-sessions/manage-status] Permission check - isTrainer: ${isTrainer}, isSuperuserOrStaff: ${isSuperuserOrStaff}`);

    if (!isTrainer && !isSuperuserOrStaff) {
      return res.status(403).json({ error: 'You do not have permission to manage this session.' });
    }

    // For trainers, check if CANCEL is within 24-hour window
    if (newStatus === 'CANCELLED' && isTrainer && !isSuperuserOrStaff) {
      const scheduledTime = new Date(log.scheduled_date);
      const currentTime = new Date();
      const hoursDifference = (scheduledTime - currentTime) / (1000 * 60 * 60);

      if (hoursDifference < 24) {
        return res.status(403).json({ 
          error: 'Trainers can only cancel sessions more than 24 hours in advance.' 
        });
      }
    }

    // Update the session status
    const updateResult = await db.query(`
      UPDATE student_trainer_session_logs
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, status, scheduled_date
    `, [newStatus, logId]);

    console.log(`[/trainer-sessions/manage-status] Updated session log:`, updateResult.rows);

    // Update the slot_instances status to match
    if (log.slot_instance_id) {
      console.log(`[/trainer-sessions/manage-status] Updating slot_instances status for slot ${log.slot_instance_id} to ${newStatus}`);
      const slotUpdateResult = await db.query(`
        UPDATE slot_instances
        SET status = $1
        WHERE id = $2
        RETURNING id, status
      `, [newStatus, log.slot_instance_id]);
      console.log(`[/trainer-sessions/manage-status] Slot update result:`, slotUpdateResult.rows);
    } else {
      console.log(`[/trainer-sessions/manage-status] WARNING: No slot_instance_id found for session log ${logId}`);
    }

    // If status is COMPLETED or ABSENT, decrement remaining_sessions
    if ((newStatus === 'COMPLETED' || newStatus === 'ABSENT') && log.remaining_sessions > 0) {
      console.log(`[/trainer-sessions/manage-status] Decrementing remaining_sessions for session ${log.student_trainer_session_id}`);
      const decrementResult = await db.query(`
        UPDATE student_trainer_sessions
        SET remaining_sessions = remaining_sessions - 1
        WHERE id = $1
        RETURNING id, remaining_sessions
      `, [log.student_trainer_session_id]);
      console.log(`[/trainer-sessions/manage-status] After decrement:`, decrementResult.rows);
    }

    // If status is CANCELLED, restore the slot and remaining sessions
    if (newStatus === 'CANCELLED' && log.slot_instance_id) {
      console.log(`[/trainer-sessions/manage-status] Restoring slot ${log.slot_instance_id}`);
      await db.query(`
        UPDATE slot_instances
        SET status = 'WORKOUT'
        WHERE id = $1
      `, [log.slot_instance_id]);

      console.log(`[/trainer-sessions/manage-status] Incrementing remaining_sessions for session ${log.student_trainer_session_id}`);
      const incrementResult = await db.query(`
        UPDATE student_trainer_sessions
        SET remaining_sessions = remaining_sessions + 1
        WHERE id = $1
        RETURNING id, remaining_sessions
      `, [log.student_trainer_session_id]);
      console.log(`[/trainer-sessions/manage-status] After increment:`, incrementResult.rows);
    }

    const updatedLog = updateResult.rows[0];

    console.log(`[TRAINER-SESSIONS] Session status updated by roleId ${userRoleId}:`, {
      logId: logId,
      newStatus: newStatus,
      userId: userId,
      trainerId: log.trainer_id,
      studentId: log.student_id
    });

    res.json({
      success: true,
      message: `Session marked as ${newStatus}`,
      sessionLog: updatedLog
    });
  } catch (err) {
    console.error('[TRAINER-SESSIONS] Error updating session status:', err.message);
    res.status(500).json({ error: `Failed to update session status: ${err.message}` });
  }
});

module.exports = router;
