const db = require("./client");

async function addStripeCustomerId() {
  try {
    console.log("Adding stripe_customer_id column to users table...");

    // Check if column already exists
    const result = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='stripe_customer_id';
    `);

    if (result.rows.length > 0) {
      console.log("✓ stripe_customer_id column already exists");
      process.exit(0);
      return;
    }

    // Add the column
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN stripe_customer_id VARCHAR(255);
    `);

    console.log("✓ stripe_customer_id column added successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error adding column:", err.message);
    process.exit(1);
  }
}

addStripeCustomerId();
