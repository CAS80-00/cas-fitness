const db = require('./db/client');
const crypto = require('crypto');

function decryptPassword(encrypted) {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Error decrypting password:', err.message);
    return null;
  }
}

async function testEmailConfig() {
  try {
    console.log('Testing Email Configuration...\n');
    
    const result = await db.query(`
      SELECT id, gmail_user, gmail_password_encrypted, is_active, superuser_email
      FROM email_config
      WHERE is_active = TRUE
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No active email configuration found!');
      process.exit(1);
    }
    
    const config = result.rows[0];
    console.log('✓ Email config found:');
    console.log(`  Gmail User: ${config.gmail_user}`);
    console.log(`  Superuser Email: ${config.superuser_email}`);
    console.log(`  Active: ${config.is_active}`);
    
    // Try to decrypt the password
    const decrypted = decryptPassword(config.gmail_password_encrypted);
    if (decrypted) {
      console.log(`  Password Decrypted: YES (length: ${decrypted.length} chars)`);
      console.log(`  Password Preview: ${decrypted.substring(0, 5)}***${decrypted.substring(decrypted.length - 5)}`);
    } else {
      console.log(`  ❌ Password Decryption: FAILED`);
      process.exit(1);
    }
    
    // Test nodemailer connection
    console.log('\nTesting Nodemailer Connection...\n');
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmail_user,
        pass: decrypted,
      },
    });
    
    // Verify connection
    transporter.verify((err, success) => {
      if (err) {
        console.log('❌ Nodemailer Connection Failed:');
        console.log(`   Error: ${err.message}`);
        if (err.response) {
          console.log(`   Response: ${err.response}`);
        }
        process.exit(1);
      } else {
        console.log('✓ Nodemailer Connection Successful');
        console.log(`  Can send email from: ${config.gmail_user}`);
        process.exit(0);
      }
    });
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testEmailConfig();
