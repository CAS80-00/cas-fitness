const db = require('./db/client');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

async function sendDirectTest() {
  try {
    console.log('Sending Direct Test Email...\n');
    
    const result = await db.query(`
      SELECT gmail_user, gmail_password_encrypted
      FROM email_config
      WHERE is_active = TRUE
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No email configuration found');
      process.exit(1);
    }
    
    const config = result.rows[0];
    const decrypted = decryptPassword(config.gmail_password_encrypted);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmail_user,
        pass: decrypted,
      },
    });
    
    const mailOptions = {
      from: config.gmail_user,
      to: 'castech2222@gmail.com',
      subject: 'Test Email - CAS Fitness',
      html: '<h1>Test Email</h1><p>This is a direct test email from the CAS Fitness system.</p><p>If you received this, email delivery is working!</p>'
    };
    
    console.log(`Sending email from: ${mailOptions.from}`);
    console.log(`Sending email to: ${mailOptions.to}`);
    console.log(`Subject: ${mailOptions.subject}\n`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✓ Email Sent Successfully!');
    console.log(`  Message ID: ${info.messageId}`);
    console.log(`  Response: ${info.response}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error Sending Email:');
    console.error(`  ${err.message}`);
    if (err.response) {
      console.error(`  Response: ${err.response}`);
    }
    console.error('\nFull Error:', err);
    process.exit(1);
  }
}

sendDirectTest();
