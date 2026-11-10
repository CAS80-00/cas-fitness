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
const sendUserConfirmationEmail = async (email, student_name, cartItems = [], totalAmount = 0) => {
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

  // Build items table HTML
  let itemsTableHTML = '';
  if (cartItems && cartItems.length > 0) {
    itemsTableHTML = cartItems.map((item, idx) => `
      <tr style="${idx % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
        <td style="padding: 10px; border: 1px solid #bdc3c7;">${item.title}</td>
        <td style="padding: 10px; border: 1px solid #bdc3c7; text-align: right;">$${Number(item.activePrice || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }

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
            
            <h3 style="color: #34495e; margin-top: 20px;">Order Details:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #2c3e50; color: white;">
                  <th style="padding: 10px; border: 1px solid #bdc3c7; text-align: left;">Plan</th>
                  <th style="padding: 10px; border: 1px solid #bdc3c7; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsTableHTML}
                <tr style="background-color: #34495e; color: white; font-weight: bold;">
                  <td style="padding: 10px; border: 1px solid #bdc3c7;">TOTAL</td>
                  <td style="padding: 10px; border: 1px solid #bdc3c7; text-align: right;">$${Number(totalAmount || 0).toFixed(2)}</td>
                </tr>
              </tbody>
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

  // Build items table HTML for cart items if present
  let purchaseDetailsHTML = '';
  if (purchaseData.cartItems && purchaseData.cartItems.length > 0) {
    purchaseDetailsHTML = `
      <h3 style="color: #34495e; margin-top: 20px;">Order Items:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #2c3e50; color: white;">
            <th style="padding: 10px; border: 1px solid #bdc3c7; text-align: left;">Plan</th>
            <th style="padding: 10px; border: 1px solid #bdc3c7; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${purchaseData.cartItems.map((item, idx) => `
            <tr style="${idx % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
              <td style="padding: 10px; border: 1px solid #bdc3c7;">${item.title}</td>
              <td style="padding: 10px; border: 1px solid #bdc3c7; text-align: right;">$${Number(item.activePrice || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr style="background-color: #34495e; color: white; font-weight: bold;">
            <td style="padding: 10px; border: 1px solid #bdc3c7;">TOTAL</td>
            <td style="padding: 10px; border: 1px solid #bdc3c7; text-align: right;">$${purchaseData.planPrice}</td>
          </tr>
        </tbody>
      </table>
    `;
  } else {
    purchaseDetailsHTML = `
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
        ${purchaseData.billingCycle ? `
          <tr style="background-color: #ecf0f1;">
            <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Billing Cycle:</strong></td>
            <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.billingCycle}</td>
          </tr>
        ` : ''}
      </table>
    `;
  }

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
              ${purchaseData.phone ? `
                <tr style="background-color: #ecf0f1;">
                  <td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>Phone:</strong></td>
                  <td style="padding: 10px; border: 1px solid #bdc3c7;">${purchaseData.phone}</td>
                </tr>
              ` : ''}
            </table>
            
            ${purchaseDetailsHTML}
            
            ${purchaseData.address ? `
              <h3 style="color: #34495e; margin-top: 20px;">Billing Address:</h3>
              <p style="padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
                ${purchaseData.address}
              </p>
            ` : ''}
            
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

// Send payment receipt to user after successful payment
const sendPaymentReceipt = async (userEmail, studentName, planTitle, amount, stripeTransactionId, paymentType = 'purchase') => {
  const config = await getEmailConfig();
  if (!config) {
    console.warn('Email configuration not available, skipping receipt email');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const paymentTypeLabel = paymentType === 'renewal' ? 'Subscription Renewal' : 'Payment';
  const receiptDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const mailOptions = {
    from: config.user,
    to: userEmail,
    subject: `CAS Fitness - ${paymentTypeLabel} Receipt #${stripeTransactionId.substring(0, 8)}`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px; background-color: #2c3e50; color: white; border-radius: 4px 4px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">✓ ${paymentTypeLabel}</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px;">CAS Fitness</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
              <p>Dear <strong>${studentName}</strong>,</p>
              
              <p style="color: #27ae60; font-weight: bold;">Your payment has been received and processed successfully.</p>
              
              <h3 style="color: #2c3e50; margin-top: 30px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Receipt Details</h3>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 12px; background-color: #ecf0f1; font-weight: bold; width: 40%;">Receipt Date:</td>
                  <td style="padding: 12px;">${receiptDate}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; background-color: white; font-weight: bold;">Payment Type:</td>
                  <td style="padding: 12px;">${paymentTypeLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; background-color: #ecf0f1; font-weight: bold;">Transaction ID:</td>
                  <td style="padding: 12px; font-family: monospace; color: #7f8c8d;">${stripeTransactionId}</td>
                </tr>
              </table>
              
              <h3 style="color: #2c3e50; margin-top: 30px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Payment Summary</h3>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 12px; background-color: white;">
                    <strong>${planTitle}</strong>
                  </td>
                  <td style="padding: 12px; text-align: right; font-weight: bold;">
                    $${Number(amount).toFixed(2)}
                  </td>
                </tr>
                <tr style="border-top: 2px solid #3498db;">
                  <td style="padding: 15px; background-color: #34495e; color: white; font-weight: bold; font-size: 16px;">
                    TOTAL
                  </td>
                  <td style="padding: 15px; background-color: #34495e; color: white; font-weight: bold; font-size: 16px; text-align: right;">
                    $${Number(amount).toFixed(2)}
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 30px; padding: 15px; background-color: #e8f4f8; border-left: 4px solid #3498db; border-radius: 4px;">
                <p style="margin: 0;"><strong>📧 Receipt Information:</strong></p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">
                  This is an automated receipt for your payment. For any questions or disputes regarding this transaction, 
                  please contact our support team or reply to this email.
                </p>
              </div>
              
              <p style="margin-top: 30px; color: #7f8c8d; font-size: 12px; text-align: center;">
                Transaction processed at ${new Date().toLocaleString()}<br>
                For support, contact: ${config.superuserEmail}
              </p>
            </div>
            
            <div style="padding: 20px; background-color: #2c3e50; color: white; text-align: center; border-radius: 0 0 4px 4px; font-size: 12px;">
              <p style="margin: 0;">© 2026 CAS Fitness. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Payment receipt sent to ${userEmail} (Transaction: ${stripeTransactionId})`);
  } catch (error) {
    console.error('Error sending payment receipt:', error);
    throw error;
  }
};

module.exports = {
  sendUserConfirmationEmail,
  sendSuperuserNotificationEmail,
  sendPaymentReceipt,
};
