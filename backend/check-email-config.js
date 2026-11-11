const db = require('./db/client');

async function checkEmailConfig() {
  try {
    const result = await db.query(`
      SELECT id, gmail_user, is_active, superuser_email
      FROM email_config
    `);
    
    console.log('Email Config Records:');
    if (result.rows.length === 0) {
      console.log('NO EMAIL CONFIGURATION FOUND IN DATABASE!');
    } else {
      result.rows.forEach(row => {
        console.log(`- ID: ${row.id}`);
        console.log(`  Gmail User: ${row.gmail_user}`);
        console.log(`  Active: ${row.is_active}`);
        console.log(`  Superuser Email: ${row.superuser_email}`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkEmailConfig();
