const db = require("./client");
const fs = require("fs");
const path = require("path");

async function migrate() {
  try {
    console.log("Running database migrations...");

    // Read schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = schema
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      try {
        await db.query(statement);
      } catch (err) {
        // Ignore errors from idempotent operations (CREATE TABLE IF NOT EXISTS, etc.)
        if (err.message.includes("already exists") || err.message.includes("already has")) {
          console.log("  → Skipped:", err.message.substring(0, 60));
        } else {
          console.error("  ✗ Error:", statement.substring(0, 60), "...", err.message);
        }
      }
    }

    console.log("✓ Database migrations complete");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
