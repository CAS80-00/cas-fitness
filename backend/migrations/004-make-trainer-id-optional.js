const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function runMigration() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Starting migration: Make trainer_id optional...');

    // Drop the NOT NULL constraint on trainer_id
    await db.query(`
      ALTER TABLE student_trainer_sessions
      ALTER COLUMN trainer_id DROP NOT NULL;
    `);

    console.log('✓ trainer_id is now nullable');

    // Update ON DELETE behavior to SET NULL instead of CASCADE
    await db.query(`
      ALTER TABLE student_trainer_sessions
      DROP CONSTRAINT student_trainer_sessions_trainer_id_fkey,
      ADD CONSTRAINT student_trainer_sessions_trainer_id_fkey 
      FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE SET NULL;
    `);

    console.log('✓ Updated foreign key to ON DELETE SET NULL');
    console.log('✓ Migration completed successfully!');
    
    await db.end();

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
