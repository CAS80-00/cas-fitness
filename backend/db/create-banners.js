const db = require('./client');

async function createBannersTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS banners (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        background_color VARCHAR(20) DEFAULT '#3B82F6' CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
        text_color VARCHAR(20) DEFAULT '#FFFFFF' CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$'),
        start_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_date DATE NOT NULL,
        end_time TIME NOT NULL,
        pages JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
      CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date);
    `;

    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

    for (const statement of statements) {
      await db.query(statement);
      console.log('✓ Executed:', statement.substring(0, 50) + '...');
    }

    console.log('\n✓ banners table created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createBannersTable();
