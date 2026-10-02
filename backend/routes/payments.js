const express = require("express");
const router = express.Router();
const db = require("../db/client");

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

module.exports = router;
