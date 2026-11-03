const nodemailer = require('nodemailer');
const crypto = require('crypto');
const db = require('../db/client');

// Helper: Decrypt password with JWT secret (matches admin.js encryption)
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

// Get email config from database
async function getEmailConfig() {
  try {
    const result = await db.query(
      `SELECT gmail_user, gmail_password_encrypted, superuser_email
       FROM email_config
       WHERE is_active = TRUE
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.warn('No email configuration found in database');
      return null;
    }

    const config = result.rows[0];
    const decryptedPassword = decryptPassword(config.gmail_password_encrypted);

    if (!decryptedPassword) {
      console.error('Failed to decrypt email password');
      return null;
    }

    return {
      user: config.gmail_user,
      pass: decryptedPassword,
      superuserEmail: config.superuser_email
    };
  } catch (err) {
    console.error('Error fetching email config from database:', err);
    return null;
  }
}

// Send confirmation email to user
const sendUserConfirmationEmail = async (email, student_name, planDetails) => {
  const config = await getEmailConfig();
  if (!config) {
    console.warn('Email configuration not available, skipping confirmation email');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const mailOptions = {
    from: config.user,
    to: email,
    subject: 'CAS Fitness - Purchase Confirmation',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Purchase Confirmation</h2>
            <p>Dear <strong>${student_name}</strong>,</p>
            
            <p>Thank you for your purchase! Your order has been received and is being processed.</p>
            
            <h3 style="color: #34495e; margin-top: 20px;">Purchase Details:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #ecf0f1;">
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Plan:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${planDetails.title}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Amount:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">$${planDetails.price}</td>
              </tr>
              <tr style="background-color: #ecf0f1;">
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Billing Cycle:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${planDetails.billing_cycle}</td>
              </tr>
            </table>
            
            <p style="margin-top: 20px; padding: 15px; background-color: #e8f4f8; border-left: 4px solid #3498db;">
              <strong>📌 Next Steps:</strong><br>
              A member of our team will contact you within <strong>24 hours</strong> with instructions to activate your account. 
              Please keep an eye on your email and phone for our contact.
            </p>
            
            <p style="margin-top: 20px;">If you have any questions, please don't hesitate to reach out.</p>
            
            <p>Best regards,<br>
            <strong>CAS Fitness Team</strong></p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
};

// Send purchase notification to superuser
const sendSuperuserNotificationEmail = async (purchaseData) => {
  const config = await getEmailConfig();
  if (!config) {
    console.warn('Email configuration not available, skipping superuser notification');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const mailOptions = {
    from: config.user,
    to: config.superuserEmail,
    subject: 'New Plan Purchase - CAS Fitness',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">🎉 New Purchase Notification</h2>
            
            <h3 style="color: #34495e; margin-top: 20px;">Customer Information:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #ecf0f1;">
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Name:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.student_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Email:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.email}</td>
              </tr>
              <tr style="background-color: #ecf0f1;">
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Phone:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.phone}</td>
              </tr>
            </table>
            
            <h3 style="color: #34495e; margin-top: 20px;">Purchase Details:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #ecf0f1;">
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Plan:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.planTitle}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Amount:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">$${purchaseData.planPrice}</td>
              </tr>
              <tr style="background-color: #ecf0f1;">
                <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Billing Cycle:</strong></td>
                <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.billingCycle}</td>
              </tr>
            </table>
            
            <h3 style="color: #34495e; margin-top: 20px;">Billing Address:</h3>
            <p style="padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
              ${purchaseData.address}
            </p>
            
            <p style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
              <strong>⚠️ Action Required:</strong><br>
              Please contact the customer within <strong>24 hours</strong> with account activation instructions.
            </p>
            
            <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
              Timestamp: ${new Date().toLocaleString()}
            </p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Superuser notification sent to ${config.superuserEmail}`);
  } catch (error) {
    console.error('Error sending superuser notification email:', error);
    throw error;
  }
};

module.exports = {
  sendUserConfirmationEmail,
  sendSuperuserNotificationEmail,
};
