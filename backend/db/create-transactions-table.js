const db = require('./client');

async function createTransactionsTable() {
  try {
    const result = await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        plan_id INT,
        amount DECIMAL(10, 2) NOT NULL,
        stripe_transaction_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_email ON transactions(user_email);
      CREATE INDEX IF NOT EXISTS idx_transactions_stripe_id ON transactions(stripe_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    `);
    
    console.log('✅ Transactions table created successfully');
  } catch (err) {
    console.error('Error creating transactions table:', err);
  } finally {
    process.exit(0);
  }
}

createTransactionsTable();
