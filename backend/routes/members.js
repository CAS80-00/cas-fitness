const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/generate-pass", authenticateToken, async (req, res) => {
  const userId = req.body.userId || req.user.userId;

  try {
    const subscriptionRes = await db.query(
      `
      SELECT id
      FROM user_subscriptions
      WHERE user_id = $1
        AND status = 'ACTIVE'
      ORDER BY start_date DESC
      LIMIT 1
    `,
      [userId],
    );

    if (subscriptionRes.rows.length === 0) {
      return res.status(403).json({ error: "No active subscription found for this user." });
    }

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30s" });
    res.json({ token, expiresInSeconds: 30 });
  } catch (err) {
    res.status(500).json({ error: "Unable to generate access pass." });
  }
});

router.post("/verify-scan", async (req, res) => {
  const token = req.body.token;

  if (!token) {
    return res.status(400).json({ error: "Scan token is required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await db.query(
      `
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      JOIN user_subscriptions s ON s.user_id = u.id
      WHERE u.id = $1
        AND s.status = 'ACTIVE'
      ORDER BY s.start_date DESC
      LIMIT 1
    `,
      [decoded.userId],
    );

    if (userRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: "Inactive subscription." });
    }

    await db.query("INSERT INTO door_access_logs (user_id) VALUES ($1)", [decoded.userId]);
    res.json({
      success: true,
      user: {
        firstName: userRes.rows[0].first_name,
        lastName: userRes.rows[0].last_name,
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, error: "Invalid or expired scan token." });
  }
});

router.get("/scan-history/:userId", authenticateToken, async (req, res) => {
  try {
    const history = await db.query(
      `
      SELECT scanned_at
      FROM door_access_logs
      WHERE user_id = $1
        AND scanned_at >= NOW() - INTERVAL '30 days'
      ORDER BY scanned_at DESC
      LIMIT 200
    `,
      [req.params.userId],
    );

    res.json({ entries: history.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch access history." });
  }
});

module.exports = router;
