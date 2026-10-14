const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken } = require("../middleware/authMiddleware");
const crypto = require("crypto");

// Card encryption/decryption utilities
const ENCRYPTION_KEY = process.env.CARD_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function encryptCardNumber(cardNumber) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(cardNumber, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptCardNumber(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

router.post("/process", async (req, res) => {
  const { cardNumber, expDate, cvc, zip, amount, planId, userId, promoCode } =
    req.body;

  try {
    const normalizedCard = String(cardNumber || "").replace(/\s/g, "");
    const testCardNumber =
      process.env.TEST_CARD_NUMBER ||
      process.env.REACT_APP_TEST_CARD_NUMBER ||
      "4539148273410928";
    const testCardExp =
      process.env.TEST_CARD_EXP || process.env.REACT_APP_TEST_CARD_EXP || "12/28";
    const testCardCvc =
      process.env.TEST_CARD_CVC || process.env.REACT_APP_TEST_CARD_CVC || "123";
    const testCardZip =
      process.env.TEST_CARD_ZIP || process.env.REACT_APP_TEST_CARD_ZIP || "10001";

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
        LIMIT 1
      `,
        [String(promoCode).toUpperCase()],
      );

      if (promoRes.rows.length > 0) {
        const promo = promoRes.rows[0];
        if (promo.discount_type === "AMOUNT") {
          discountAmount = Number(promo.discount_value);
        } else {
          discountAmount = (Number(amount) * Number(promo.discount_value)) / 100;
        }
      }
    }

    // Development/Test Card Bypass Mode
    const isTestCard =
      normalizedCard === testCardNumber &&
      expDate === testCardExp &&
      cvc === testCardCvc &&
      zip === testCardZip;

    if (process.env.NODE_ENV !== "production" && isTestCard) {
      const paidAmount = Math.max(Number(amount) - discountAmount, 0);

      // Record Subscription
      if (userId) {
        await db.query(
          `
          INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
          VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + INTERVAL '1 MONTH')
        `,
          [userId, planId],
        );
      }

      return res.json({
        success: true,
        message: "Payment processed successfully (Mock Test Mode).",
        paidAmount,
        transactionId: `TX-MOCK-${Date.now()}`,
      });
    }

    // Live Payment Gateway Integration Logic Here
    res
      .status(400)
      .json({
        error: "Payment failed, review your information and try again.",
      });
  } catch (err) {
    res.status(500).json({ error: "Internal Payment Processing Error" });
  }
});

// Get saved credit card for a student
router.get("/credit-card/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

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

// Save new credit card for a student
router.post("/credit-card", authenticateToken, async (req, res) => {
  const { cardholder_name, card_number, expiry_month, expiry_year, cvv } = req.body;
  const studentId = req.user?.userId;

  if (!studentId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!cardholder_name || !card_number || !expiry_month || !expiry_year || !cvv) {
    return res.status(400).json({ error: "Missing required fields" });
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

    const last4 = normalizedCard.slice(-4);

    // Encrypt card number
    const encryptedCardNumber = encryptCardNumber(normalizedCard);

    // Deactivate previous cards
    await db.query(
      `UPDATE student_credit_cards SET is_active = FALSE WHERE student_id = $1`,
      [studentId]
    );

    // Insert new card with encrypted card number
    const result = await db.query(
      `INSERT INTO student_credit_cards (student_id, cardholder_name, card_number_encrypted, card_number_last_4, card_type, expiry_month, expiry_year, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING cardholder_name, card_number_last_4, card_type, expiry_month, expiry_year`,
      [studentId, cardholder_name, encryptedCardNumber, last4, cardType, expiry_month, expiry_year]
    );

    const card = result.rows[0];
    res.json({
      success: true,
      message: "Card saved successfully",
      card: {
        cardholder_name: card.cardholder_name,
        card_number_masked: 'XXXX XXXX XXXX ' + card.card_number_last_4,
        card_type: card.card_type,
        expiry_month: String(card.expiry_month).padStart(2, '0'),
        expiry_year: card.expiry_year,
      }
    });
  } catch (err) {
    console.error("Error saving credit card:", err);
    res.status(500).json({ error: "Failed to save credit card" });
  }
});

module.exports = router;
