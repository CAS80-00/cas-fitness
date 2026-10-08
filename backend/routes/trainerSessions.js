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

    res.json({
      ...sessionResult.rows[0],
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
  const { sessionId } = req.params;
  const { trainer_id, start_date, expiration_date, status, notes } = req.body;

  try {
    const result = await db.query(`
      UPDATE student_trainer_sessions
      SET 
        trainer_id = COALESCE($1, trainer_id),
        start_date = COALESCE($2, start_date),
        expiration_date = COALESCE($3, expiration_date),
        status = COALESCE($4, status),
        notes = COALESCE($5, notes),
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, student_id, trainer_id, total_sessions, remaining_sessions,
                start_date, expiration_date, status, created_at, updated_at
    `, [trainer_id, start_date, expiration_date, status, notes, sessionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer session not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating trainer session:', err);
    res.status(500).json({ error: 'Failed to update trainer session' });
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

// Get available trainers for student booking (trainers with active availability)
router.get('/available-trainers', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT
        u.id, u.first_name, u.last_name, u.email, u.phone, u.status,
        COUNT(DISTINCT ta.id) as availability_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN trainer_availability ta ON u.id = ta.trainer_id
      WHERE r.role_name = 'TRAINER' AND u.status = 'ACTIVE'
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.status
      ORDER BY u.first_name, u.last_name
    `);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      availabilityCount: parseInt(row.availability_count) || 0
    })));
  } catch (err) {
    console.error('Error fetching available trainers:', err.message);
    res.status(500).json({ error: 'Failed to fetch available trainers.' });
  }
});

// Get trainer availability schedule for student booking
router.get('/trainer-schedule/:trainerId', authenticateToken, async (req, res) => {
  const { trainerId } = req.params;
  
  try {
    const availabilityResult = await db.query(`
      SELECT 
        id, trainer_id, day_of_week, start_time, end_time, location_format
      FROM trainer_availability
      WHERE trainer_id = $1
      ORDER BY day_of_week, start_time
    `, [trainerId]);

    const vacationsResult = await db.query(`
      SELECT start_date, end_date
      FROM trainer_vacations
      WHERE trainer_id = $1
      ORDER BY start_date
    `, [trainerId]);

    const trainerResult = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone
      FROM users u
      WHERE u.id = $1
    `, [trainerId]);

    if (trainerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json({
      trainer: {
        id: trainerResult.rows[0].id,
        firstName: trainerResult.rows[0].first_name,
        lastName: trainerResult.rows[0].last_name,
        email: trainerResult.rows[0].email,
        phone: trainerResult.rows[0].phone
      },
      availability: availabilityResult.rows.map(row => ({
        id: row.id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        locationFormat: row.location_format
      })),
      vacations: vacationsResult.rows.map(row => ({
        startDate: row.start_date,
        endDate: row.end_date
      }))
    });
  } catch (err) {
    console.error('Error fetching trainer schedule:', err.message);
    res.status(500).json({ error: 'Failed to fetch trainer schedule.' });
  }
});

// Student books a session - creates/updates session log
router.post('/book-session', authenticateToken, async (req, res) => {
  const { sessionId, sessionLogId, trainerId, scheduledDate, locationFormat } = req.body;
  const studentId = req.user.userId;

  if (!sessionId || !sessionLogId || !trainerId || !scheduledDate || !locationFormat) {
    return res.status(400).json({ 
      error: 'Missing required fields: sessionId, sessionLogId, trainerId, scheduledDate, locationFormat' 
    });
  }

  if (!['IN_PERSON', 'VIDEO'].includes(locationFormat)) {
    return res.status(400).json({ error: 'Invalid location format' });
  }

  try {
    // Verify the session belongs to the student
    const sessionCheck = await db.query(`
      SELECT id, student_id, remaining_sessions, expiration_date, status
      FROM student_trainer_sessions
      WHERE id = $1 AND student_id = $2
    `, [sessionId, studentId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Session not found or does not belong to this student' });
    }

    const session = sessionCheck.rows[0];
    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    if (session.remaining_sessions <= 0) {
      return res.status(400).json({ error: 'No remaining sessions available' });
    }

    // Check if scheduled date is before expiration
    const scheduledDateTime = new Date(scheduledDate);
    const expirationDate = new Date(session.expiration_date);
    if (scheduledDateTime > expirationDate) {
      return res.status(400).json({ error: 'Scheduled date is after session expiration date' });
    }

    // Update the session log
    const logResult = await db.query(`
      UPDATE student_trainer_session_logs
      SET 
        scheduled_date = $1,
        location_format = $2,
        status = 'SCHEDULED',
        updated_at = NOW()
      WHERE id = $3 AND student_trainer_session_id = $4
      RETURNING id, session_number, scheduled_date, location_format, status
    `, [scheduledDate, locationFormat, sessionLogId, sessionId]);

    if (logResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session log not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Session booked successfully',
      sessionLog: logResult.rows[0]
    });
  } catch (err) {
    console.error('Error booking session:', err);
    res.status(500).json({ error: 'Failed to book session' });
  }
});

module.exports = router;
