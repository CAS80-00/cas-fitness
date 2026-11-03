const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db/client");
const { authenticateToken, optionalAuthenticate, canAccessUser } = require("../middleware/authMiddleware");
const { sendUserConfirmationEmail, sendSuperuserNotificationEmail } = require("../services/emailService");

const isProduction = process.env.NODE_ENV === "production";

// Card numbers are stored with AES-256-GCM. Production must provide its own
// 32-byte (64 hex chars) key; outside production a key derived from JWT_SECRET
// keeps local data readable across restarts.
function getEncryptionKey() {
  const configured = process.env.CARD_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "hex");
    if (key.length !== 32) {
      throw new Error("CARD_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
    }
    return key;
  }
  if (isProduction) {
    throw new Error("CARD_ENCRYPTION_KEY is not configured.");
  }
  return crypto.createHash("sha256").update(String(process.env.JWT_SECRET)).digest();
}

function encryptCardNumber(cardNumber) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(cardNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("hex")).join(":");
}

// Mock gateway: only the configured test card is accepted, and never in production.
const TEST_CARD = {
  number: process.env.TEST_CARD_NUMBER || "4539148273410928",
  exp: process.env.TEST_CARD_EXP || "12/28",
  cvc: process.env.TEST_CARD_CVC || "123",
  zip: process.env.TEST_CARD_ZIP || "10001",
};

// Public so guests can check out, but the subscription is only recorded for
// the authenticated caller; a userId in the body is never trusted.
router.post("/process", optionalAuthenticate, async (req, res) => {
  const { cardNumber, expDate, cvc, zip, planId, promoCode } = req.body;

  try {
    const planRes = await db.query("SELECT id, price FROM plans WHERE id = $1", [planId]);
    if (planRes.rows.length === 0) {
      return res.status(400).json({ error: "Selected plan does not exist." });
    }
    const planPrice = Number(planRes.rows[0].price);

    let discountAmount = 0;
    if (promoCode) {
      const promoRes = await db.query(
        `
        SELECT discount_type, discount_value
        FROM promotions
        WHERE code = $1
          AND is_active = TRUE
          AND start_time <= NOW()
          AND end_time >= NOW()
          AND (plan_id IS NULL OR plan_id = $2)
        LIMIT 1
      `,
        [String(promoCode).toUpperCase(), planId],
      );

      if (promoRes.rows.length > 0) {
        const promo = promoRes.rows[0];
        discountAmount =
          promo.discount_type === "AMOUNT"
            ? Number(promo.discount_value)
            : (planPrice * Number(promo.discount_value)) / 100;
      }
    }

    const isTestCard =
      String(cardNumber || "").replace(/\s/g, "") === TEST_CARD.number &&
      expDate === TEST_CARD.exp &&
      cvc === TEST_CARD.cvc &&
      zip === TEST_CARD.zip;

    if (!isProduction && isTestCard) {
      const paidAmount = Math.max(planPrice - discountAmount, 0);

      if (req.user) {
        await db.query(
          `
          INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
          VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + INTERVAL '1 MONTH')
        `,
          [req.user.userId, planId],
        );
      }

      return res.json({
        success: true,
        message: "Payment processed successfully (Mock Test Mode).",
        paidAmount,
        transactionId: `TX-MOCK-${Date.now()}`,
      });
    }

    // Live payment gateway integration goes here.
    res.status(400).json({
      error: "Payment failed, review your information and try again.",
    });
  } catch (err) {
    console.error("Payment processing error:", err.message);
    res.status(500).json({ error: "Internal Payment Processing Error" });
  }
});

// Get saved credit card for a student
router.get("/credit-card/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  if (!canAccessUser(req, userId)) {
    return res.status(403).json({ error: "Access denied." });
  }

  try {
    const result = await db.query(
      `SELECT id, cardholder_name, card_number_last_4, card_type, expiry_month, expiry_year
       FROM student_credit_cards
       WHERE student_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ card: null });
    }

    const card = result.rows[0];
    res.json({
      card: {
        cardholder_name: card.cardholder_name,
        card_number_masked: 'XXXX XXXX XXXX ' + card.card_number_last_4,
        card_type: card.card_type,
        expiry_month: String(card.expiry_month).padStart(2, '0'),
        expiry_year: card.expiry_year,
      }
    });
  } catch (err) {
    console.error("Error fetching credit card:", err);
    res.status(500).json({ error: "Failed to fetch credit card" });
  }
});

// Save new credit card for a student or guest
router.post("/credit-card", optionalAuthenticate, async (req, res) => {
  const { student_name, email, phone, card_number, cardholder_name, expiry_month, expiry_year, cvv, country, street, city, state, zip_code, planTitle, planPrice, billingCycle } = req.body;
  const studentId = req.user?.userId;

  // Validate required fields
  if (!student_name || !email || !phone || !card_number || !cardholder_name || !expiry_month || !expiry_year || !cvv || !country || !street || !city || !zip_code) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // State is required for US addresses
  if (country === 'US' && !state) {
    return res.status(400).json({ error: "State is required for US addresses" });
  }

  try {
    // Validate card number (basic check - must be 16 digits)
    const normalizedCard = String(card_number).replace(/\s/g, '');
    if (!/^\d{16}$/.test(normalizedCard)) {
      return res.status(400).json({ error: "Invalid card number format" });
    }

    // Validate CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      return res.status(400).json({ error: "Invalid CVV format" });
    }

    // Validate expiry
    if (!/^\d{2}$/.test(expiry_month) || parseInt(expiry_month) < 1 || parseInt(expiry_month) > 12) {
      return res.status(400).json({ error: "Invalid expiry month" });
    }

    const currentYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(expiry_year) || parseInt(expiry_year) < currentYear) {
      return res.status(400).json({ error: "Invalid expiry year" });
    }

    // Determine card type
    let cardType = 'OT';
    if (/^4/.test(normalizedCard)) cardType = 'VI'; // Visa
    if (/^5[1-5]/.test(normalizedCard)) cardType = 'MC'; // Mastercard
    if (/^3[47]/.test(normalizedCard)) cardType = 'AX'; // American Express
    if (/^6(?:011|5)/.test(normalizedCard)) cardType = 'DI'; // Discover

    // Construct full address
    const address = `${street}, ${city}, ${state ? state + ', ' : ''}${zip_code}, ${country}`;

    // Encrypt card number
    const encryptedCardNumber = encryptCardNumber(normalizedCard);

    // If authenticated user, save card to their profile
    if (studentId) {
      // Deactivate previous cards
      await db.query(
        `UPDATE student_credit_cards SET is_active = FALSE WHERE student_id = $1`,
        [studentId]
      );

      // Insert new card with encrypted card number
      const result = await db.query(
        `INSERT INTO student_credit_cards (student_id, cardholder_name, card_number_encrypted, card_number_last_4, card_type, expiry_month, expiry_year, address, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING cardholder_name, card_number_last_4, card_type, expiry_month, expiry_year`,
        [studentId, cardholder_name, encryptedCardNumber, last4, cardType, expiry_month, expiry_year, address]
      );

      const card = result.rows[0];
      
      // Send confirmation emails
      try {
        await sendUserConfirmationEmail(email, student_name, {
          title: planTitle || 'Membership Plan',
          price: planPrice || '0.00',
          billing_cycle: billingCycle || 'Monthly',
        });

        await sendSuperuserNotificationEmail({
          student_name,
          email,
          phone,
          planTitle: planTitle || 'Membership Plan',
          planPrice: planPrice || '0.00',
          billingCycle: billingCycle || 'Monthly',
          address,
        });
      } catch (emailError) {
        console.error('Email sending error (non-blocking):', emailError);
      }

      res.json({
        success: true,
        message: "Payment processed successfully",
        card: {
          cardholder_name: card.cardholder_name,
          card_number_masked: card.card_number_last_4,
          card_type: card.card_type,
          expiry_month: String(card.expiry_month).padStart(2, '0'),
          expiry_year: card.expiry_year,
        }
      });
    } else {
      // For guest users, process payment without saving card
      // Send confirmation emails
      try {
        await sendUserConfirmationEmail(email, student_name, {
          title: planTitle || 'Membership Plan',
          price: planPrice || '0.00',
          billing_cycle: billingCycle || 'Monthly',
        });

        await sendSuperuserNotificationEmail({
          student_name,
          email,
          phone,
          planTitle: planTitle || 'Membership Plan',
          planPrice: planPrice || '0.00',
          billingCycle: billingCycle || 'Monthly',
          address,
        });
      } catch (emailError) {
        console.error('Email sending error (non-blocking):', emailError);
      }

      res.json({
        success: true,
        message: "Payment processed successfully",
        card: {
          cardholder_name: cardholder_name,
          card_type: cardType,
          expiry_month: String(expiry_month).padStart(2, '0'),
          expiry_year: expiry_year,
        }
      });
    }
  } catch (err) {
    console.error("Error saving credit card:", err);
    res.status(500).json({ error: "Failed to save credit card" });
  }
});

module.exports = router;
