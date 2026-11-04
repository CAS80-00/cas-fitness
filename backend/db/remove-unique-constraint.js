const db = require('./client');

async function removeUniqueConstraint() {
  try {
    // Drop the unique constraint on stripe_transaction_id
    await db.query(`
      ALTER TABLE transactions
      DROP CONSTRAINT IF EXISTS transactions_stripe_transaction_id_key;
    `);
    
    console.log('✅ Unique constraint on stripe_transaction_id removed successfully');
  } catch (err) {
    console.error('Error removing unique constraint:', err);
  } finally {
    process.exit(0);
  }
}

removeUniqueConstraint();
