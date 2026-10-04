const { Pool } = require('pg');

async function migrate() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Running migration: add published_at column...');

    // Add published_at column if it doesn't exist
    await db.query(`
      ALTER TABLE slot_instances
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
    `);
    console.log('✓ Added published_at column');

    // Update status for existing slots to APPROVED if they are PENDING
    await db.query(`
      UPDATE slot_instances
      SET status = 'APPROVED'
      WHERE status = 'PENDING';
    `);
    console.log('✓ Updated old PENDING slots to APPROVED');

    // Add the index if it doesn't exist
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_slot_instances_status_published ON slot_instances(status, published_at);
    `);
    console.log('✓ Created index');

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
