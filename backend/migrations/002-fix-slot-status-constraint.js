const { Pool } = require('pg');

async function migrate() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Running migration: fix slot_instances status CHECK constraint...');

    // Drop the old constraint if it exists
    await db.query(`
      ALTER TABLE IF EXISTS slot_instances
      DROP CONSTRAINT IF EXISTS slot_instances_status_check;
    `);
    console.log('✓ Dropped old status constraint');

    // Add the correct constraint that includes WORKOUT and CONSULTATION
    await db.query(`
      ALTER TABLE slot_instances
      ADD CONSTRAINT slot_instances_status_check CHECK (
        status IN ('APPROVED', 'CONSULTATION', 'WORKOUT', 'BREAK', 'LUNCH', 'SICK', 'NO_SHOW', 'VACATION', 'PERSONAL_TIME', 'REMOVED')
      );
    `);
    console.log('✓ Added corrected status constraint with WORKOUT and CONSULTATION');

    const count = await db.query('SELECT COUNT(*) FROM slot_instances');
    console.log(`✓ Database migration complete. Total slots: ${count.rows[0].count}`);
    
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
