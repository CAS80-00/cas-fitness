const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function migrate() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Running migration: Add trainer session management tables...');

    // Create trainer_session_packages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS trainer_session_packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        session_count INT NOT NULL CHECK (session_count > 0),
        duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
        price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        created_by UUID NOT NULL REFERENCES users(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created trainer_session_packages table');

    // Create student_trainer_sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_trainer_sessions (
        id SERIAL PRIMARY KEY,
        student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        package_id INT REFERENCES trainer_session_packages(id) ON DELETE SET NULL,
        total_sessions INT NOT NULL CHECK (total_sessions > 0),
        remaining_sessions INT NOT NULL CHECK (remaining_sessions >= 0),
        start_date TIMESTAMPTZ NOT NULL,
        expiration_date TIMESTAMPTZ NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED')),
        assigned_by UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created student_trainer_sessions table');

    // Create student_trainer_session_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_trainer_session_logs (
        id SERIAL PRIMARY KEY,
        student_trainer_session_id INT NOT NULL REFERENCES student_trainer_sessions(id) ON DELETE CASCADE,
        session_number INT NOT NULL,
        scheduled_date TIMESTAMPTZ,
        completed_date TIMESTAMPTZ,
        status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW')),
        location_format VARCHAR(30) CHECK (location_format IN ('IN_PERSON', 'VIDEO')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ Created student_trainer_session_logs table');

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_trainer_session_packages_created_by ON trainer_session_packages(created_by);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_trainer_session_packages_active ON trainer_session_packages(is_active);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_student ON student_trainer_sessions(student_id);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_trainer ON student_trainer_sessions(trainer_id);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_status ON student_trainer_sessions(status);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_student_trainer_sessions_dates ON student_trainer_sessions(start_date, expiration_date);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_student_trainer_session_logs_session ON student_trainer_session_logs(student_trainer_session_id);
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_student_trainer_session_logs_status ON student_trainer_session_logs(status);
    `);
    console.log('✓ Created indexes');

    const count = await db.query('SELECT COUNT(*) FROM trainer_session_packages');
    console.log(`✓ Database migration complete. Total trainer packages: ${count.rows[0].count}`);
    
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.error(err);
    await db.end();
    process.exit(1);
  }
}

migrate();
