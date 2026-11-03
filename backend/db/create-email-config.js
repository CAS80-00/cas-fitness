const db = require("./client");

async function createEmailConfigTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS email_config (
        id SERIAL PRIMARY KEY,
        gmail_user VARCHAR(255) NOT NULL,
        gmail_password_encrypted TEXT NOT NULL,
        superuser_email VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_email_config_active ON email_config(is_active);
    `;

    const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      await db.query(statement);
      console.log("✓ Executed:", statement.substring(0, 50) + "...");
    }

    console.log("\n✓ email_config table created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

createEmailConfigTable();
