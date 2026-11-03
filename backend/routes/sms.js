const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db/client");

// The webhook has no user session, so callers must present a shared secret.
function hasValidWebhookSecret(req) {
  const expected = process.env.SMS_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";

  const provided = Buffer.from(String(req.headers["x-webhook-secret"] || ""));
  const expectedBuffer = Buffer.from(expected);
  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
}

router.post("/reply", async (req, res) => {
  if (!hasValidWebhookSecret(req)) {
    return res.status(401).json({ error: "Invalid webhook credentials." });
  }

  const messageBody = String(req.body.Body || req.body.body || "").trim().toUpperCase();
  const appointmentId = req.body.appointmentId;

  if (!appointmentId || !messageBody) {
    return res.status(400).json({ error: "appointmentId and message body are required." });
  }

  try {
    if (messageBody === "Y") {
      await db.query(
        "UPDATE consultation_appointments SET status = 'CONFIRMED' WHERE id = $1",
        [appointmentId],
      );
    } else if (messageBody === "N") {
      await db.query(
        `
        UPDATE consultation_appointments
        SET status = 'CANCELED',
            reserved_until = NULL
        WHERE id = $1
      `,
        [appointmentId],
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to process SMS reply webhook." });
  }
});

module.exports = router;
