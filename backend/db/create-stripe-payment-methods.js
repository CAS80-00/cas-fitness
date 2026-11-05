const db = require("./client");

async function createStripePaymentMethodsTable() {
  try {
    console.log("Creating stripe_payment_methods table...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS stripe_payment_methods (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
        card_brand VARCHAR(50),
        card_last_4 VARCHAR(4),
        expiry_month INT,
        expiry_year INT,
        cardholder_name VARCHAR(255),
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_user_id 
      ON stripe_payment_methods(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_default 
      ON stripe_payment_methods(user_id, is_default);
    `);

    console.log("✓ stripe_payment_methods table created successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error creating table:", err.message);
    process.exit(1);
  }
}

createStripePaymentMethodsTable();
