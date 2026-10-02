const express = require("express");
const router = express.Router();
const db = require("../db/client");

/**
 * Public, read-only view of currently-live promotions, keyed by plan so the
 * Plans page can automatically show discounted prices without a promo code.
 * A NULL plan_id promotion applies to every plan card.
 */
router.get("/active", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, code, campaign_name, plan_id, discount_type, discount_value, start_time, end_time
      FROM promotions
      WHERE is_active = TRUE
        AND start_time <= NOW()
        AND end_time >= NOW()
      ORDER BY start_time DESC
    `,
    );

    res.json({
      promotions: result.rows.map((row) => ({
        id: row.id,
        code: row.code,
        campaignName: row.campaign_name,
        planId: row.plan_id,
        discountType: row.discount_type,
        discountValue: Number(row.discount_value),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load active promotions." });
  }
});

module.exports = router;
